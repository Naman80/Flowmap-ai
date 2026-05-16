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

export async function scanInfra(
  projectId: string,
  repoPath: string
): Promise<InfraIndex> {
  const files = collectSourceFiles(repoPath);
  const fileContents = buildFileContext(repoPath, files);

  const ai = getAIProvider();
  const raw = await ai.complete(INFRA_SYSTEM_PROMPT, [
    { role: "user", content: fileContents },
  ], { json: true, maxTokens: 16000 });

  let parsed: {
    queues: QueueDef[];
    topics: TopicDef[];
    workers: WorkerDef[];
    tables: TableDef[];
  };

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`AI returned invalid JSON during infra scan: ${raw.slice(0, 200)}`);
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
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(ts|tsx|js|jsx|prisma)$/.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  walk(repoPath);
  return results;
}

function buildFileContext(repoPath: string, files: string[]): string {
  const MAX_CHARS = 180_000; // keep well within context limits
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
