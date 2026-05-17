import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Resolve .env from monorepo root regardless of CWD
const __dirname = fileURLToPath(new URL(".", import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import express from "express";
import cors from "cors";
import { initAIProvider } from "./ai/provider.js";
import { getDb } from "./db/client.js";
import { projectsRouter } from "./routes/projects.js";
import { flowsRouter } from "./routes/flows.js";
import { runsRouter } from "./routes/runs.js";

const PORT = Number(process.env.PORT ?? 3001);

// ─── Env validation ───────────────────────────────────────────────────────────

const PROVIDER = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();

const REQUIRED_KEYS: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
};

function validateEnv(): void {
  const required = REQUIRED_KEYS[PROVIDER];
  if (!required) {
    console.error(`[env] Unknown AI_PROVIDER "${PROVIDER}". Must be: anthropic | openai | gemini`);
    process.exit(1);
  }
  if (!process.env[required]) {
    console.error(`[env] ${required} is not set. Add it to .env at the repo root.`);
    process.exit(1);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  validateEnv();

  await initAIProvider();
  getDb(); // initialise DB schema + run migrations

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api/projects", projectsRouter);
  app.use("/api/flows", flowsRouter);
  app.use("/api/runs", runsRouter);

  app.get("/api/health", (_req, res) => {
    const db = getDb();
    // Verify DB is reachable
    const dbOk = !!db.prepare("SELECT 1").get();
    res.json({ ok: true, version: "0.1.0", ai_provider: PROVIDER, db: dbOk ? "ok" : "error" });
  });

  app.listen(PORT, () => {
    console.log(`FlowMap server running on http://localhost:${PORT} (AI: ${PROVIDER})`);
  });
}

main().catch((err) => {
  console.error("[startup]", err);
  process.exit(1);
});
