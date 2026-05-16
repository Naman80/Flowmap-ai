import fs from "fs";
import path from "path";
import type { Flow, FlowGraph, InfraIndex } from "@flowmap/shared";
import { getAIProvider } from "../ai/provider.js";

const FLOW_BUILD_SYSTEM_PROMPT = `You are a backend code analyst. Your job is to trace a specific feature flow through a TypeScript/JavaScript backend codebase.

You will be given:
1. An infrastructure index (queues, topics, workers, tables already identified)
2. Source code files
3. A user's request describing the flow to trace (or "auto" for automatic discovery)

Return a JSON object matching this TypeScript type exactly:
{
  "flows": [
    {
      "id": string,
      "name": string,
      "description": string,
      "trigger": FlowTrigger,
      "nodes": Node[],
      "edges": Edge[],
      "meta": FlowMeta
    }
  ]
}

Where:
- FlowTrigger: { type: "queue", queue_name, job_name } | { type: "webhook", path, method } | { type: "manual" } | { type: "scheduled" }
- Node: { id, label, type (queue_consumer|guard|aggregator|llm_call|transform|queue_producer|external_api), file, function, db_ops: [{table,operation,description}], emits_to?, spawns_flow?, calls_external? }
- Edge: { id, from, to, data_type, key_fields: string[], observed: false, snapshot: null }
- FlowMeta: { created_at, last_run_at: null, confidence (0-1), source ("auto_scan"|"user_requested"), tags: string[] }

Only return the JSON. No explanation, no markdown fences.`;

export async function buildFlows(
  projectId: string,
  repoPath: string,
  infraIndex: InfraIndex,
  request?: string
): Promise<Flow[]> {
  const files = collectSourceFiles(repoPath);
  const fileContext = buildFileContext(repoPath, files);
  const infraContext = JSON.stringify(infraIndex, null, 2);
  const userPrompt = request ?? "Auto-discover all detectable flows in this codebase.";

  const ai = getAIProvider();
  const raw = await ai.complete(FLOW_BUILD_SYSTEM_PROMPT, [
    {
      role: "user",
      content: `INFRA INDEX:\n${infraContext}\n\nSOURCE CODE:\n${fileContext}\n\nREQUEST: ${userPrompt}`,
    },
  ], { json: true, maxTokens: 32000 });

  let parsed: { flows: Flow[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`AI returned invalid JSON during flow build: ${raw.slice(0, 200)}`);
  }

  return (parsed.flows ?? []).map((f) => ({ ...f, project_id: projectId }));
}

export async function buildFlowGraph(
  projectId: string,
  flows: Flow[],
  infraIndex: InfraIndex
): Promise<FlowGraph> {
  const GRAPH_SYSTEM_PROMPT = `You are a backend code analyst. Given a set of flows and an infra index, identify how the flows connect to each other — which flow triggers which, through what mechanism, under what condition.

Return a JSON object:
{
  "connections": [
    {
      "id": string,
      "from_flow": string,
      "from_node": string,
      "to_flow": string,
      "via": ConnectionMechanism,
      "condition": Condition,
      "behaviour": ConnectionBehaviour | null,
      "confidence": number
    }
  ]
}

ConnectionMechanism: { type: "queue", queue_name } | { type: "webhook", event } | { type: "event", event_name } | { type: "direct" }
Condition: { type: "always" } | { type: "simple", field, operator, value } | { type: "compound", operator, conditions }
ConnectionBehaviour: { debounce_ms?, delay_formula?, max_concurrency? }

Only return the JSON. No explanation.`;

  const ai = getAIProvider();
  const raw = await ai.complete(GRAPH_SYSTEM_PROMPT, [
    {
      role: "user",
      content: `FLOWS:\n${JSON.stringify(flows, null, 2)}\n\nINFRA:\n${JSON.stringify(infraIndex, null, 2)}`,
    },
  ], { json: true, maxTokens: 8192 });

  let parsed: { connections: FlowGraph["connections"] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`AI returned invalid JSON during graph build: ${raw.slice(0, 200)}`);
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

function collectSourceFiles(repoPath: string): string[] {
  const results: string[] = [];
  const ignored = new Set(["node_modules", "dist", ".git", "coverage", ".next", "build"]);

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (/\.(ts|tsx|js|jsx|prisma)$/.test(entry.name)) results.push(fullPath);
    }
  }

  walk(repoPath);
  return results;
}

function buildFileContext(repoPath: string, files: string[]): string {
  const MAX_CHARS = 180_000;
  const parts: string[] = [];
  let total = 0;

  for (const file of files) {
    const rel = path.relative(repoPath, file);
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const entry = `\n\n=== ${rel} ===\n${content}`;
    if (total + entry.length > MAX_CHARS) break;
    parts.push(entry);
    total += entry.length;
  }

  return parts.join("");
}
