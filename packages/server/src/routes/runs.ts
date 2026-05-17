import { Router } from "express";
import { v4 as uuid } from "uuid";
import { getDb } from "../db/client.js";
import { executeRun, generateRunInput } from "../engine/runner.js";
import type { Run, RunEvent, Flow, ApiResponse } from "@flowmap/shared";

export const runsRouter = Router();

// List runs for a flow
runsRouter.get("/", (req, res) => {
  const { flowId } = req.query as { flowId?: string };
  const db = getDb();
  const rows = flowId
    ? (db
        .prepare("SELECT * FROM runs WHERE flow_id = ? ORDER BY started_at DESC LIMIT 50")
        .all(flowId) as any[])
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
  const events = db
    .prepare("SELECT * FROM run_events WHERE run_id = ? ORDER BY id ASC")
    .all(req.params.id) as any[];
  res.json({
    ok: true,
    data: events.map(
      (e): RunEvent => ({
        type: e.type,
        run_id: e.run_id,
        node_id: e.node_id,
        payload: JSON.parse(e.payload),
        timestamp: e.timestamp,
      })
    ),
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

  const projectRow = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(flowRow.project_id) as any;

  const mode = trigger_mode ?? "manual";
  let resolvedInput: unknown = input ?? null;

  // AI mode: generate a realistic input payload
  if (mode === "ai" && resolvedInput === null) {
    try {
      resolvedInput = await generateRunInput(flow);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: `Failed to generate AI input: ${err.message}` });
      return;
    }
  }

  // Create run record
  const runId = uuid();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO runs (id, flow_id, project_id, status, trigger_mode, input, started_at) VALUES (?, ?, ?, 'pending', ?, ?, ?)"
  ).run(runId, flow_id, flowRow.project_id, mode, JSON.stringify(resolvedInput), now);

  const run = dbRowToRun(db.prepare("SELECT * FROM runs WHERE id = ?").get(runId) as any);

  // Dispatch — don't await; respond immediately with pending run, then execute async
  res.status(201).json({ ok: true, data: run } satisfies ApiResponse<Run>);

  // Fire the trigger after responding
  executeRun(run, flow, projectRow?.app_url ?? null, projectRow?.redis_url ?? null).catch(
    (err) => console.error(`[runner] Unhandled error for run ${runId}:`, err)
  );
});

// Mark a run as completed (called by the target app or manually)
runsRouter.patch("/:id/complete", (req, res) => {
  const { status, error } = req.body as { status?: "completed" | "failed"; error?: string };
  const db = getDb();
  const row = db.prepare("SELECT * FROM runs WHERE id = ?").get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ ok: false, error: "Run not found" });
    return;
  }
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE runs SET status = ?, error = ?, completed_at = ? WHERE id = ?"
  ).run(status ?? "completed", error ?? null, now, row.id);
  res.json({ ok: true, data: dbRowToRun(db.prepare("SELECT * FROM runs WHERE id = ?").get(row.id) as any) });
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
