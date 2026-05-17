import { Router } from "express";
import { v4 as uuid } from "uuid";
import { getDb } from "../db/client.js";
import { buildFlows, buildFlowGraph } from "../scanner/flowBuilder.js";
import { validate, FlowBuildSchema, FlowGraphBuildSchema, EdgeObserveSchema } from "../lib/validate.js";
import type { Flow, FlowGraph, Edge, ApiResponse } from "@flowmap/shared";

export const flowsRouter = Router();

// ─── FlowGraph routes (must come before /:id to avoid shadowing) ───

// Get flow graph for a project
flowsRouter.get("/graph/:projectId", (req, res) => {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM flow_graphs WHERE project_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(req.params.projectId) as any;
  if (!row) {
    res.status(404).json({ ok: false, error: "No flow graph yet. Build flows first then call POST /flows/graph/build." });
    return;
  }
  res.json({ ok: true, data: JSON.parse(row.data) as FlowGraph });
});

// Build flow graph for a project
flowsRouter.post("/graph/build", validate(FlowGraphBuildSchema), async (req, res) => {
  const { project_id } = req.body as { project_id: string };
  const db = getDb();
  const flows = (db
    .prepare("SELECT * FROM flows WHERE project_id = ?")
    .all(project_id) as any[]).map(dbRowToFlow);

  if (!flows.length) {
    res.status(400).json({ ok: false, error: "No flows found. Build flows first." });
    return;
  }

  const infraRow = db
    .prepare("SELECT * FROM infra_index WHERE project_id = ?")
    .get(project_id) as any;
  const infraIndex = infraRow
    ? JSON.parse(infraRow.data)
    : { project_id, queues: [], topics: [], workers: [], tables: [], scanned_at: new Date().toISOString() };

  try {
    const graph = await buildFlowGraph(project_id, flows, infraIndex);
    const now = new Date().toISOString();
    // Replace any existing graph for this project
    db.prepare("DELETE FROM flow_graphs WHERE project_id = ?").run(project_id);
    db.prepare(
      "INSERT INTO flow_graphs (id, project_id, name, data, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(uuid(), project_id, graph.name, JSON.stringify(graph), now);
    res.status(201).json({ ok: true, data: graph } satisfies ApiResponse<FlowGraph>);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Flow CRUD ───

// List flows for a project
flowsRouter.get("/", (req, res) => {
  const { projectId } = req.query as { projectId?: string };
  const db = getDb();
  const rows = projectId
    ? (db
        .prepare("SELECT * FROM flows WHERE project_id = ? ORDER BY created_at DESC")
        .all(projectId) as any[])
    : (db.prepare("SELECT * FROM flows ORDER BY created_at DESC").all() as any[]);
  res.json({ ok: true, data: rows.map(dbRowToFlow) });
});

// Get a single flow
flowsRouter.get("/:id", (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM flows WHERE id = ?").get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ ok: false, error: "Flow not found" });
    return;
  }
  res.json({ ok: true, data: dbRowToFlow(row) });
});

// Build flows (auto-scan or user-requested)
flowsRouter.post("/build", validate(FlowBuildSchema), async (req, res) => {
  const { project_id, request } = req.body as { project_id: string; request?: string };
  const db = getDb();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(project_id) as any;
  if (!project) {
    res.status(404).json({ ok: false, error: "Project not found" });
    return;
  }

  const infraRow = db.prepare("SELECT * FROM infra_index WHERE project_id = ?").get(project_id) as any;
  if (!infraRow) {
    res.status(400).json({
      ok: false,
      error: "Run infra scan first (POST /api/projects/:id/scan-infra)",
    });
    return;
  }

  const infraIndex = JSON.parse(infraRow.data);

  try {
    const flows = await buildFlows(project_id, project.repo_path, infraIndex, request);
    const now = new Date().toISOString();

    const saved: Flow[] = [];
    for (const flow of flows) {
      const id = uuid();
      const withId = { ...flow, id, project_id };
      db.prepare(
        "INSERT INTO flows (id, project_id, name, description, data, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, project_id, withId.name, withId.description, JSON.stringify(withId), now);
      saved.push(withId);
    }

    res.status(201).json({ ok: true, data: saved } satisfies ApiResponse<Flow[]>);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Delete a flow
flowsRouter.delete("/:id", (req, res) => {
  const db = getDb();
  const info = db.prepare("DELETE FROM flows WHERE id = ?").run(req.params.id);
  if (info.changes === 0) {
    res.status(404).json({ ok: false, error: "Flow not found" });
    return;
  }
  res.json({ ok: true, data: null });
});

// Toggle edge observation
flowsRouter.patch("/:flowId/edges/:edgeId/observe", validate(EdgeObserveSchema), (req, res) => {
  const { observed } = req.body as { observed?: boolean };
  const db = getDb();
  const row = db.prepare("SELECT * FROM flows WHERE id = ?").get(req.params.flowId) as any;
  if (!row) {
    res.status(404).json({ ok: false, error: "Flow not found" });
    return;
  }

  const flow: Flow = JSON.parse(row.data);
  const edge = flow.edges.find((e: Edge) => e.id === req.params.edgeId);
  if (!edge) {
    res.status(404).json({ ok: false, error: "Edge not found" });
    return;
  }

  edge.observed = observed ?? !edge.observed;
  db.prepare("UPDATE flows SET data = ? WHERE id = ?").run(JSON.stringify(flow), row.id);
  res.json({ ok: true, data: edge });
});

function dbRowToFlow(row: any): Flow {
  return JSON.parse(row.data) as Flow;
}
