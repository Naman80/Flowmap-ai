import Database from "better-sqlite3";
import path from "path";
import { initDb } from "./schema.js";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), "flowmap.db");
    _db = new Database(dbPath);
    initDb(_db);
  }
  return _db;
}
