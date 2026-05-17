import { Queue } from "bullmq";
import { getDb } from "../db/client.js";
import { getAIProvider } from "../ai/provider.js";
import type { Flow, Run, FlowTrigger } from "@flowmap/shared";

export type RunResult = {
  run_id: string;
  status: "running" | "failed";
  error?: string;
};

/**
 * Execute a flow. Returns immediately — the actual job runs in the target app.
 * FlowMap's role: dispatch the trigger (HTTP or queue) with the right payload.
 */
export async function executeRun(
  run: Run,
  flow: Flow,
  appUrl: string | null,
  redisUrl: string | null
): Promise<RunResult> {
  const db = getDb();

  try {
    await dispatch(flow.trigger, run.input, appUrl, redisUrl);
    db.prepare("UPDATE runs SET status = 'running' WHERE id = ?").run(run.id);
    return { run_id: run.id, status: "running" };
  } catch (err: any) {
    db.prepare("UPDATE runs SET status = 'failed', error = ?, completed_at = ? WHERE id = ?")
      .run(err.message, new Date().toISOString(), run.id);
    return { run_id: run.id, status: "failed", error: err.message };
  }
}

async function dispatch(
  trigger: FlowTrigger,
  input: unknown,
  appUrl: string | null,
  redisUrl: string | null
): Promise<void> {
  switch (trigger.type) {
    case "webhook":
      await dispatchWebhook(trigger.path, trigger.method, input, appUrl);
      break;
    case "queue":
      await dispatchQueue(trigger.queue_name, trigger.job_name, input, redisUrl);
      break;
    case "manual":
    case "scheduled":
      // Manual flows don't auto-execute — the run is recorded as-is
      break;
  }
}

async function dispatchWebhook(
  path: string,
  method: string,
  input: unknown,
  appUrl: string | null
): Promise<void> {
  if (!appUrl) {
    throw new Error(
      "app_url is not configured for this project. Set it via PATCH /api/projects/:id."
    );
  }

  const url = `${appUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    method: method.toUpperCase(),
    headers: { "Content-Type": "application/json" },
    body: input != null ? JSON.stringify(input) : undefined,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Webhook ${method} ${url} returned ${res.status}: ${body.slice(0, 200)}`);
  }
}

async function dispatchQueue(
  queueName: string,
  jobName: string,
  input: unknown,
  redisUrl: string | null
): Promise<void> {
  if (!redisUrl) {
    throw new Error(
      "redis_url is not configured for this project. Set it via PATCH /api/projects/:id."
    );
  }

  // Parse the Redis URL into ioredis connection options
  const parsed = new URL(redisUrl);
  const connection = {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    db: parsed.pathname ? Number(parsed.pathname.slice(1)) || 0 : 0,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
  };

  const queue = new Queue(queueName, { connection });
  try {
    await queue.add(jobName, input ?? {});
  } finally {
    await queue.close();
  }
}

export async function generateRunInput(flow: Flow): Promise<unknown> {
  const ai = getAIProvider();
  const raw = await ai.complete(
    "You are a test data generator. Given a flow definition, generate a realistic input payload that matches the flow's trigger. Return only a valid JSON object — no explanation, no markdown fences.",
    [{ role: "user", content: `Flow:\n${JSON.stringify(flow, null, 2)}` }],
    { json: true, maxTokens: 1024 }
  );
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { _raw: raw };
  }
}
