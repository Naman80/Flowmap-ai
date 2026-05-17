import Database from "better-sqlite3";

export function initDb(db: Database.Database): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS projects (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      repo_path   TEXT NOT NULL UNIQUE,
      created_at  TEXT NOT NULL,
      last_scanned_at TEXT,
      infra_scanned INTEGER NOT NULL DEFAULT 0,
      app_url     TEXT,
      redis_url   TEXT
    );

    CREATE TABLE IF NOT EXISTS infra_index (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      data        TEXT NOT NULL,
      scanned_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flows (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      data        TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      last_run_at TEXT
    );

    CREATE TABLE IF NOT EXISTS flow_graphs (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      data        TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id            TEXT PRIMARY KEY,
      flow_id       TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
      project_id    TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      trigger_mode  TEXT NOT NULL,
      input         TEXT,
      started_at    TEXT NOT NULL,
      completed_at  TEXT,
      error         TEXT
    );

    CREATE TABLE IF NOT EXISTS run_events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id     TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      type       TEXT NOT NULL,
      node_id    TEXT NOT NULL,
      payload    TEXT NOT NULL,
      timestamp  TEXT NOT NULL
    );
  `);

  // Additive migrations for columns added after initial schema
  runMigration(db, "ALTER TABLE projects ADD COLUMN app_url TEXT");
  runMigration(db, "ALTER TABLE projects ADD COLUMN redis_url TEXT");
}

function runMigration(db: Database.Database, sql: string): void {
  try {
    db.exec(sql);
  } catch {
    // Column already exists — safe to ignore
  }
}
