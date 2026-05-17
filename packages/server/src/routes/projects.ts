import { Router } from "express";
import { v4 as uuid } from "uuid";
import fs from "fs";
import { getDb } from "../db/client.js";
import { scanInfra } from "../scanner/infraScanner.js";
import { validate, ProjectCreateSchema, ProjectPatchSchema } from "../lib/validate.js";
import type { Project, InfraIndex, ApiResponse } from "@flowmap/shared";

export const projectsRouter = Router();

// List all projects
projectsRouter.get("/", (_req, res) => {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all() as any[];
  const projects: Project[] = rows.map(dbRowToProject);
  res.json({ ok: true, data: projects } satisfies ApiResponse<Project[]>);
});

// Create a project (connect a repo)
projectsRouter.post("/", validate(ProjectCreateSchema), (req, res) => {
  const { name, repo_path } = req.body as { name?: string; repo_path: string };

  if (!fs.existsSync(repo_path)) {
    res.status(400).json({ ok: false, error: `Path does not exist: ${repo_path}` });
    return;
  }

  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  const projectName = name ?? repo_path.split("/").at(-1) ?? repo_path;

  try {
    db.prepare(
      "INSERT INTO projects (id, name, repo_path, created_at, infra_scanned) VALUES (?, ?, ?, ?, 0)"
    ).run(id, projectName, repo_path, now);
  } catch (err: any) {
    if (err.message?.includes("UNIQUE")) {
      res.status(409).json({ ok: false, error: "A project with this repo path already exists" });
      return;
    }
    throw err;
  }

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as any;
  res.status(201).json({ ok: true, data: dbRowToProject(project) } satisfies ApiResponse<Project>);
});

// Get a single project
projectsRouter.get("/:id", (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ ok: false, error: "Project not found" });
    return;
  }
  res.json({ ok: true, data: dbRowToProject(row) });
});

// Trigger infra scan
projectsRouter.post("/:id/scan-infra", async (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ ok: false, error: "Project not found" });
    return;
  }

  try {
    const infra = await scanInfra(row.id, row.repo_path);
    const now = new Date().toISOString();

    db.prepare("DELETE FROM infra_index WHERE project_id = ?").run(row.id);
    db.prepare("INSERT INTO infra_index (id, project_id, data, scanned_at) VALUES (?, ?, ?, ?)")
      .run(uuid(), row.id, JSON.stringify(infra), now);

    db.prepare(
      "UPDATE projects SET infra_scanned = 1, last_scanned_at = ? WHERE id = ?"
    ).run(now, row.id);

    res.json({ ok: true, data: infra } satisfies ApiResponse<InfraIndex>);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Update execution config (app_url, redis_url)
projectsRouter.patch("/:id", validate(ProjectPatchSchema), (req, res) => {
  const { name, app_url, redis_url } = req.body as {
    name?: string;
    app_url?: string;
    redis_url?: string;
  };
  const db = getDb();
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ ok: false, error: "Project not found" });
    return;
  }
  if (name !== undefined) db.prepare("UPDATE projects SET name = ? WHERE id = ?").run(name, row.id);
  if (app_url !== undefined) db.prepare("UPDATE projects SET app_url = ? WHERE id = ?").run(app_url, row.id);
  if (redis_url !== undefined) db.prepare("UPDATE projects SET redis_url = ? WHERE id = ?").run(redis_url, row.id);
  const updated = db.prepare("SELECT * FROM projects WHERE id = ?").get(row.id) as any;
  res.json({ ok: true, data: dbRowToProject(updated) });
});

// Get infra index for a project
projectsRouter.get("/:id/infra", (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM infra_index WHERE project_id = ?").get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ ok: false, error: "Infra not scanned yet" });
    return;
  }
  res.json({ ok: true, data: JSON.parse(row.data) as InfraIndex });
});

function dbRowToProject(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    repo_path: row.repo_path,
    created_at: row.created_at,
    last_scanned_at: row.last_scanned_at ?? null,
    infra_scanned: Boolean(row.infra_scanned),
    app_url: row.app_url ?? null,
    redis_url: row.redis_url ?? null,
  };
}
