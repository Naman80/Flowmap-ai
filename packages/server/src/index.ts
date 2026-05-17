import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Walk up to monorepo root to find .env regardless of CWD
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

async function main() {
  await initAIProvider();
  getDb(); // initialise DB + run migrations

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api/projects", projectsRouter);
  app.use("/api/flows", flowsRouter);
  app.use("/api/runs", runsRouter);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, version: "0.1.0" });
  });

  app.listen(PORT, () => {
    console.log(`FlowMap server running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
