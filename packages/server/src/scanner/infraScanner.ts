import fs from "fs";
import path from "path";
import type { InfraIndex, QueueDef, TopicDef, WorkerDef, TableDef } from "@flowmap/shared";
import { getAIProvider } from "../ai/provider.js";

const INFRA_SYSTEM_PROMPT = `You are a backend code analyst. Your job is to scan a TypeScript/JavaScript backend codebase and extract infrastructure definitions.

You will be given the content of multiple files. Extract:
1. Queue definitions — any queue/job infrastructure (BullMQ, Bull, etc.)
2. Topic/event definitions — pub/sub topics, event emitters
3. Worker definitions — queue consumers, job processors
4. Database tables — Prisma models, Drizzle schema tables, raw SQL CREATE TABLE statements

Return a JSON object with this exact shape:
{
  "queues": [{ "name": string, "file": string, "job_names": string[] }],
  "topics": [{ "name": string, "file": string, "pattern": string | null }],
  "workers": [{ "queue_name": string, "file": string, "function": string }],
  "tables": [{ "name": string, "file": string }]
}

Only return the JSON. No explanation, no markdown fences.`;

// Directory names that are likely to contain infra definitions — scanned first
const HIGH_PRIORITY_DIRS = new Set([
  "queues", "queue", "workers", "worker", "jobs", "job",
  "database", "db", "schema", "schemas", "models", "model",
  "events", "topics", "pubsub", "config", "prisma",
]);

// File name patterns that almost certainly contain infra
const HIGH_PRIORITY_PATTERNS = /queue|worker|job|schema|model|prisma|bull|redis|event|topic/i;

export async function scanInfra(
  projectId: string,
  repoPath: string
): Promise<InfraIndex> {
  const { high, normal } = collectSourceFiles(repoPath);

  // Always include high-priority files; add normal files until we hit the budget
  const fileContext = buildFileContext(repoPath, high, normal);

  const ai = getAIProvider();
  const raw = await ai.complete(INFRA_SYSTEM_PROMPT, [
    { role: "user", content: fileContext },
  ], { json: true, maxTokens: 8192 });

  let parsed: {
    queues: QueueDef[];
    topics: TopicDef[];
    workers: WorkerDef[];
    tables: TableDef[];
  };

  try {
    // Strip markdown fences if the model adds them despite instructions
    const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON during infra scan:\n${raw.slice(0, 400)}`);
  }

  return {
    project_id: projectId,
    queues: parsed.queues ?? [],
    topics: parsed.topics ?? [],
    workers: parsed.workers ?? [],
    tables: parsed.tables ?? [],
    scanned_at: new Date().toISOString(),
  };
}

function collectSourceFiles(repoPath: string): { high: string[]; normal: string[] } {
  const high: string[] = [];
  const normal: string[] = [];
  const ignored = new Set(["node_modules", "dist", ".git", "coverage", ".next", "build", "test", "__tests__", "spec"]);

  function walk(dir: string, isHighPriority = false) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const childIsHigh = isHighPriority || HIGH_PRIORITY_DIRS.has(entry.name.toLowerCase());
        walk(fullPath, childIsHigh);
      } else if (/\.(ts|tsx|js|jsx|prisma)$/.test(entry.name)) {
        const inHighDir = isHighPriority;
        const nameMatches = HIGH_PRIORITY_PATTERNS.test(entry.name);
        if (inHighDir || nameMatches) {
          high.push(fullPath);
        } else {
          normal.push(fullPath);
        }
      }
    }
  }

  walk(repoPath);
  return { high, normal };
}

function buildFileContext(repoPath: string, high: string[], normal: string[]): string {
  const TOTAL_BUDGET = 500_000;
  const MAX_FILE_CHARS = 25_000; // truncate any single large file
  const parts: string[] = [];
  const included: string[] = [];
  let total = 0;

  function addFiles(files: string[]) {
    for (const file of files) {
      if (total >= TOTAL_BUDGET) break;
      const rel = path.relative(repoPath, file);
      let content: string;
      try {
        content = fs.readFileSync(file, "utf-8");
      } catch {
        continue;
      }
      // Truncate oversized files — infra declarations are almost always near the top
      if (content.length > MAX_FILE_CHARS) {
        content = content.slice(0, MAX_FILE_CHARS) + "\n// ... (truncated)";
      }
      const entry = `\n\n=== ${rel} ===\n${content}`;
      if (total + entry.length > TOTAL_BUDGET) break;
      parts.push(entry);
      included.push(rel);
      total += entry.length;
    }
  }

  addFiles(high);
  addFiles(normal);

  console.log(`[infra-scan] ${parts.length} files (~${Math.round(total / 1000)}k chars) | high=${high.length} normal=${normal.length}`);
  console.log(`[infra-scan] Files: ${included.join(", ")}`);
  return parts.join("");
}
