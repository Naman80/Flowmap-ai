import { Router } from "express";
import { v4 as uuid } from "uuid";
import { getDb } from "../db/client.js";
import { getAIProvider } from "../ai/provider.js";
import type { Run, RunEvent, Flow, ApiResponse } from "@flowmap/shared";

export const runsRouter = Router();

// List runs for a flow
runsRouter.get("/", (req, res) => {
  const { flowId } = req.query as { flowId?: string };
  const db = getDb();
  const rows = flowId
    ? (db.prepare("SELECT * FROM runs WHERE flow_id = ? ORDER BY started_at DESC").all(flowId) as any[])
    : (db.prepare("SELECT * FROM runs ORDER BY started_at DESC LIMIT 50").all() as any[]);
  res.json({ ok: true, data: rows.map(dbRowToRun) });
});

// Get a single run
runsRouter.get("/:id", (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM runs WHERE id = ?").get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ ok: false, error: "Run not found" });
    return;
  }
  res.json({ ok: true, data: dbRowToRun(row) });
});

// Get events for a run
runsRouter.get("/:id/events", (req, res) => {
  const db = getDb();
  const events = db.prepare("SELECT * FROM run_events WHERE run_id = ? ORDER BY id ASC").all(req.params.id) as any[];
  res.json({
    ok: true,
    data: events.map((e) => ({
      type: e.type,
      run_id: e.run_id,
      node_id: e.node_id,
      payload: JSON.parse(e.payload),
      timestamp: e.timestamp,
    })) as RunEvent[],
  });
});

// Trigger a run
runsRouter.post("/", async (req, res) => {
  const { flow_id, trigger_mode, input } = req.body as {
    flow_id?: string;
    trigger_mode?: "ai" | "manual";
    input?: unknown;
  };

  if (!flow_id) {
    res.status(400).json({ ok: false, error: "flow_id is required" });
    return;
  }

  const db = getDb();
  const flowRow = db.prepare("SELECT * FROM flows WHERE id = ?").get(flow_id) as any;
  if (!flowRow) {
    res.status(404).json({ ok: false, error: "Flow not found" });
    return;
  }

  const flow: Flow = JSON.parse(flowRow.data);
  const mode = trigger_mode ?? "manual";
  let resolvedInput = input;

  // If AI trigger mode and no input provided, generate one
  if (mode === "ai" && !resolvedInput) {
    const ai = getAIProvider();
    const raw = await ai.complete(
      "You are a test data generator. Given a flow definition, generate a realistic input payload that matches the flow's trigger. Return only JSON.",
      [{ role: "user", content: `Flow: ${JSON.stringify(flow, null, 2)}` }],
      { json: true }
    );
    try {
      resolvedInput = JSON.parse(raw);
    } catch {
      resolvedInput = { _raw: raw };
    }
  }

  const runId = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO runs (id, flow_id, project_id, status, trigger_mode, input, started_at)
    VALUES (?, ?, ?, 'pending', ?, ?, ?)
  `).run(runId, flow_id, flowRow.project_id, mode, JSON.stringify(resolvedInput), now);

  const run = dbRowToRun(db.prepare("SELECT * FROM runs WHERE id = ?").get(runId) as any);

  // TODO: In a later iteration, this is where the actual flow execution engine plugs in.
  // For v1 scaffold, we return the run immediately in pending state.

  res.status(201).json({ ok: true, data: run } satisfies ApiResponse<Run>);
});

function dbRowToRun(row: any): Run {
  return {
    id: row.id,
    flow_id: row.flow_id,
    project_id: row.project_id,
    status: row.status,
    trigger_mode: row.trigger_mode,
    input: row.input ? JSON.parse(row.input) : null,
    started_at: row.started_at,
    completed_at: row.completed_at ?? null,
    error: row.error ?? null,
  };
}
