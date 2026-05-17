import fs from "fs";
import path from "path";
import type { Flow, FlowGraph, InfraIndex } from "@flowmap/shared";
import { getAIProvider } from "../ai/provider.js";

// ─────────────────────────────────────────────
// Pass 1 — identify relevant files
// ─────────────────────────────────────────────

const FILE_SELECTION_PROMPT = `You are a backend code analyst. Given a directory listing of a TypeScript/JavaScript codebase and an infrastructure index, identify which files are most relevant for building the requested flow.

Return a JSON array of relative file paths (strings only). Include:
- The main worker/processor file for this flow
- Any modules it calls (context builders, orchestrators, executors, etc.)
- Queue/job definition files for queues this flow produces to
- Any shared utility files that contain core business logic used by this flow

Exclude: test files, type-only files, config files, migration files, unrelated workers.

Return ONLY a JSON array of strings. No explanation, no markdown fences. Max 20 files.`;

async function selectRelevantFiles(
  repoPath: string,
  infraIndex: InfraIndex,
  request: string
): Promise<string[]> {
  const allFiles = walkAllFiles(repoPath);
  const listing = allFiles.map((f) => path.relative(repoPath, f)).join("\n");

  const ai = getAIProvider();
  const raw = await ai.complete(FILE_SELECTION_PROMPT, [
    {
      role: "user",
      content: `INFRA INDEX:\n${JSON.stringify(infraIndex, null, 2)}\n\nDIRECTORY LISTING:\n${listing}\n\nFLOW REQUEST: ${request}`,
    },
  ], { json: true, maxTokens: 2048 });

  let files: string[];
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
    files = JSON.parse(cleaned);
    if (!Array.isArray(files)) throw new Error("not an array");
  } catch {
    console.warn("[flow-builder] File selection returned invalid JSON, falling back to heuristic");
    files = heuristicFileSelect(allFiles, repoPath, request);
  }

  // Resolve to absolute paths and filter to files that actually exist
  return files
    .map((f) => path.resolve(repoPath, f))
    .filter((f) => fs.existsSync(f) && fs.statSync(f).isFile());
}

function heuristicFileSelect(allFiles: string[], repoPath: string, request: string): string[] {
  const terms = request.toLowerCase().split(/\W+/).filter((t) => t.length > 3);
  return allFiles
    .filter((f) => {
      const rel = path.relative(repoPath, f).toLowerCase();
      return terms.some((t) => rel.includes(t));
    })
    .map((f) => path.relative(repoPath, f))
    .slice(0, 20);
}

// ─────────────────────────────────────────────
// Pass 2 — build the flow
// ─────────────────────────────────────────────

const FLOW_BUILD_PROMPT = `You are a backend code analyst. Trace a complete feature flow through a TypeScript/JavaScript backend codebase.

You will be given:
1. An infrastructure index (queues, topics, workers, tables)
2. Full source code of the relevant files
3. A specific flow to trace

Build a thorough flow by identifying EVERY meaningful function call in the chain — including:
- Entry point (queue consumer, webhook handler, etc.)
- Guard/validation functions that can exit early
- Context aggregator functions that do multiple DB reads
- LLM/AI calls
- Data transform functions
- Queue producers that dispatch to downstream queues
- External API calls

For each node, identify ALL database operations it performs (read/write/read_write, which table, what specifically).

Return a JSON object with this exact shape:
{
  "flows": [
    {
      "id": "flow_<snake_case_name>",
      "name": "<Human readable name>",
      "description": "<One sentence description>",
      "trigger": <FlowTrigger>,
      "nodes": <Node[]>,
      "edges": <Edge[]>,
      "meta": <FlowMeta>
    }
  ]
}

Types:
FlowTrigger: { type: "queue", queue_name: string, job_name: string } | { type: "webhook", path: string, method: string } | { type: "manual" } | { type: "scheduled" }

Node: {
  id: string,
  label: string,
  type: "queue_consumer" | "guard" | "aggregator" | "llm_call" | "transform" | "queue_producer" | "external_api",
  file: string,         // relative path from repo root
  function: string,     // exact function name
  db_ops: [{ table: string, operation: "read"|"write"|"read_write", description: string }],
  emits_to?: string,    // queue name if this node pushes to a queue
  spawns_flow?: string, // flow id if this triggers another flow
  calls_external?: boolean
}

Edge: {
  id: string,
  from: string,         // node id
  to: string,           // node id
  data_type: string,    // TypeScript type name flowing through this edge
  key_fields: string[], // dot-notation paths of the most important fields to observe
  observed: false,
  snapshot: null
}

FlowMeta: {
  created_at: string,   // ISO 8601 now
  last_run_at: null,
  confidence: number,   // 0-1, how confident are you in this flow's accuracy
  source: "user_requested",
  tags: string[]
}

ONLY return the JSON. No explanation, no markdown fences.`;

export async function buildFlows(
  projectId: string,
  repoPath: string,
  infraIndex: InfraIndex,
  request?: string
): Promise<Flow[]> {
  const isAuto = !request;
  const effectiveRequest = request ?? "Auto-discover all detectable flows in this codebase.";

  let fileContext: string;

  if (isAuto) {
    // Auto-scan: use the same prioritised-files approach as infra scanner
    const { high, normal } = collectPrioritisedFiles(repoPath);
    fileContext = buildContextFromFiles(repoPath, [...high, ...normal], 300_000, 20_000);
  } else {
    // User-requested: 2-pass — identify files first, then read them completely
    console.log("[flow-builder] Pass 1: selecting relevant files...");
    const relevantFiles = await selectRelevantFiles(repoPath, infraIndex, effectiveRequest);
    console.log(`[flow-builder] Pass 1 selected ${relevantFiles.length} files: ${relevantFiles.map((f) => path.relative(repoPath, f)).join(", ")}`);

    // No per-file truncation for user-requested flows — read everything
    fileContext = buildContextFromFiles(repoPath, relevantFiles, 600_000, Infinity);
  }

  const ai = getAIProvider();
  const infraContext = JSON.stringify(infraIndex, null, 2);

  console.log(`[flow-builder] Pass 2: building flow (${Math.round(fileContext.length / 1000)}k chars to AI)...`);
  const raw = await ai.complete(FLOW_BUILD_PROMPT, [
    {
      role: "user",
      content: `INFRA INDEX:\n${infraContext}\n\nSOURCE CODE:\n${fileContext}\n\nFLOW REQUEST: ${effectiveRequest}`,
    },
  ], { json: true, maxTokens: 16000 });

  let parsed: { flows: Flow[] };
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON during flow build:\n${raw.slice(0, 500)}`);
  }

  return (parsed.flows ?? []).map((f) => ({ ...f, project_id: projectId }));
}

// ─────────────────────────────────────────────
// FlowGraph builder
// ─────────────────────────────────────────────

const FLOW_GRAPH_PROMPT = `You are a backend code analyst. Given a set of individual flows and an infrastructure index, identify how the flows connect to each other at a macro level.

For each connection between flows, determine:
- Which node in Flow A triggers Flow B
- The mechanism (queue name, webhook event, direct call, pub/sub event)
- The condition under which this connection fires (always, or based on data field values)
- Any timing behaviour (debounce, stagger delay, concurrency limit)

Return a JSON object:
{
  "connections": [
    {
      "id": "conn_<unique>",
      "from_flow": "<flow_id>",
      "from_node": "<node_id inside from_flow>",
      "to_flow": "<flow_id>",
      "via": <ConnectionMechanism>,
      "condition": <Condition>,
      "behaviour": <ConnectionBehaviour | null>,
      "confidence": <0-1>
    }
  ]
}

ConnectionMechanism: { type: "queue", queue_name: string } | { type: "webhook", event: string } | { type: "event", event_name: string } | { type: "direct" }
Condition: { type: "always" } | { type: "simple", field: string, operator: string, value: unknown } | { type: "compound", operator: "and"|"or"|"not", conditions: Condition[] }
ConnectionBehaviour: { debounce_ms?: number, delay_formula?: string, max_concurrency?: number }

ONLY return the JSON. No explanation, no markdown fences.`;

export async function buildFlowGraph(
  projectId: string,
  flows: Flow[],
  infraIndex: InfraIndex
): Promise<FlowGraph> {
  const ai = getAIProvider();
  console.log(`[flow-graph] Building graph for ${flows.length} flows...`);

  const raw = await ai.complete(FLOW_GRAPH_PROMPT, [
    {
      role: "user",
      content: `FLOWS:\n${JSON.stringify(flows, null, 2)}\n\nINFRA INDEX:\n${JSON.stringify(infraIndex, null, 2)}`,
    },
  ], { json: true, maxTokens: 8192 });

  let parsed: { connections: FlowGraph["connections"] };
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON during graph build:\n${raw.slice(0, 500)}`);
  }

  return {
    id: `graph_${projectId}`,
    project_id: projectId,
    name: "Flow Graph",
    flows: flows.map((f) => ({
      flow_id: f.id,
      name: f.name,
      trigger: f.trigger,
    })),
    connections: parsed.connections ?? [],
  };
}

// ─────────────────────────────────────────────
// File collection helpers
// ─────────────────────────────────────────────

const IGNORED_DIRS = new Set([
  "node_modules", "dist", ".git", "coverage", ".next", "build",
  "__tests__", "spec", "test", "tests", "migrations", "scripts",
]);

const HIGH_PRIORITY_DIRS = new Set([
  "queues", "queue", "workers", "worker", "jobs", "job",
  "database", "db", "schema", "schemas", "models", "model",
  "events", "topics", "pubsub", "config", "prisma", "modules",
  "services", "processors", "handlers", "platform",
]);

const HIGH_PRIORITY_FILE_PATTERN = /queue|worker|job|schema|model|prisma|bull|redis|event|topic|processor|handler/i;

function walkAllFiles(repoPath: string): string[] {
  const results: string[] = [];

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (IGNORED_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx|prisma)$/.test(e.name)) results.push(full);
    }
  }

  walk(repoPath);
  return results;
}

function collectPrioritisedFiles(repoPath: string): { high: string[]; normal: string[] } {
  const high: string[] = [];
  const normal: string[] = [];

  function walk(dir: string, parentIsHigh = false) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (IGNORED_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full, parentIsHigh || HIGH_PRIORITY_DIRS.has(e.name.toLowerCase()));
      } else if (/\.(ts|tsx|js|jsx|prisma)$/.test(e.name)) {
        (parentIsHigh || HIGH_PRIORITY_FILE_PATTERN.test(e.name) ? high : normal).push(full);
      }
    }
  }

  walk(repoPath);
  return { high, normal };
}

function buildContextFromFiles(
  repoPath: string,
  files: string[],
  totalBudget: number,
  maxPerFile: number
): string {
  const parts: string[] = [];
  let total = 0;

  for (const file of files) {
    if (total >= totalBudget) break;
    const rel = path.relative(repoPath, file);
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    if (content.length > maxPerFile) {
      content = content.slice(0, maxPerFile) + "\n// ... (truncated)";
    }
    const entry = `\n\n=== ${rel} ===\n${content}`;
    if (total + entry.length > totalBudget) break;
    parts.push(entry);
    total += entry.length;
  }

  console.log(`[flow-builder] Context: ${parts.length} files, ~${Math.round(total / 1000)}k chars`);
  return parts.join("");
}
