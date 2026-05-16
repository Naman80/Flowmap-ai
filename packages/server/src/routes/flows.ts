import { Router } from "express";
import { v4 as uuid } from "uuid";
import { getDb } from "../db/client.js";
import { buildFlows, buildFlowGraph } from "../scanner/flowBuilder.js";
import type { Flow, FlowGraph, ApiResponse } from "@flowmap/shared";

export const flowsRouter = Router();

// List flows for a project
flowsRouter.get("/", (req, res) => {
  const { projectId } = req.query as { projectId?: string };
  const db = getDb();
  const rows = projectId
    ? (db.prepare("SELECT * FROM flows WHERE project_id = ? ORDER BY created_at DESC").all(projectId) as any[])
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

// Build flows for a project (auto scan or user-requested)
flowsRouter.post("/build", async (req, res) => {
  const { project_id, request } = req.body as { project_id?: string; request?: string };
  if (!project_id) {
    res.status(400).json({ ok: false, error: "project_id is required" });
    return;
  }

  const db = getDb();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(project_id) as any;
  if (!project) {
    res.status(404).json({ ok: false, error: "Project not found" });
    return;
  }

  const infraRow = db.prepare("SELECT * FROM infra_index WHERE project_id = ?").get(project_id) as any;
  if (!infraRow) {
    res.status(400).json({ ok: false, error: "Run infra scan first (POST /projects/:id/scan-infra)" });
    return;
  }

  const infraIndex = JSON.parse(infraRow.data);

  try {
    const flows = await buildFlows(project_id, project.repo_path, infraIndex, request);
    const now = new Date().toISOString();

    for (const flow of flows) {
      const id = uuid();
      db.prepare(`
        INSERT INTO flows (id, project_id, name, description, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, project_id, flow.name, flow.description, JSON.stringify({ ...flow, id }), now);
      flow.id = id;
    }

    res.status(201).json({ ok: true, data: flows } satisfies ApiResponse<Flow[]>);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Update edge observation flag
flowsRouter.patch("/:flowId/edges/:edgeId/observe", (req, res) => {
  const { observed } = req.body as { observed?: boolean };
  const db = getDb();
  const row = db.prepare("SELECT * FROM flows WHERE id = ?").get(req.params.flowId) as any;
  if (!row) {
    res.status(404).json({ ok: false, error: "Flow not found" });
    return;
  }

  const flow: Flow = JSON.parse(row.data);
  const edge = flow.edges.find((e: { id: string }) => e.id === req.params.edgeId);
  if (!edge) {
    res.status(404).json({ ok: false, error: "Edge not found" });
    return;
  }

  edge.observed = observed ?? !edge.observed;
  db.prepare("UPDATE flows SET data = ? WHERE id = ?").run(JSON.stringify(flow), row.id);
  res.json({ ok: true, data: edge });
});

// Get flow graph for a project
flowsRouter.get("/graph/:projectId", (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM flow_graphs WHERE project_id = ? ORDER BY created_at DESC LIMIT 1").get(req.params.projectId) as any;
  if (!row) {
    res.status(404).json({ ok: false, error: "No flow graph yet. Build flows first." });
    return;
  }
  res.json({ ok: true, data: JSON.parse(row.data) as FlowGraph });
});

// Build flow graph for a project
flowsRouter.post("/graph/build", async (req, res) => {
  const { project_id } = req.body as { project_id?: string };
  if (!project_id) {
    res.status(400).json({ ok: false, error: "project_id is required" });
    return;
  }

  const db = getDb();
  const flows = (db.prepare("SELECT * FROM flows WHERE project_id = ?").all(project_id) as any[]).map(dbRowToFlow);
  if (!flows.length) {
    res.status(400).json({ ok: false, error: "No flows found. Build flows first." });
    return;
  }

  const infraRow = db.prepare("SELECT * FROM infra_index WHERE project_id = ?").get(project_id) as any;
  const infraIndex = infraRow ? JSON.parse(infraRow.data) : { queues: [], topics: [], workers: [], tables: [] };

  try {
    const graph = await buildFlowGraph(project_id, flows, infraIndex);
    const now = new Date().toISOString();
    db.prepare("INSERT INTO flow_graphs (id, project_id, name, data, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(uuid(), project_id, graph.name, JSON.stringify(graph), now);
    res.status(201).json({ ok: true, data: graph } satisfies ApiResponse<FlowGraph>);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

function dbRowToFlow(row: any): Flow {
  return JSON.parse(row.data) as Flow;
}
