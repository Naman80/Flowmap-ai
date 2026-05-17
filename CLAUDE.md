# FlowMap — Claude Code Context

## What this is
FlowMap is a standalone developer server that connects to a backend repo and makes its feature flows visible, executable, and observable — using AI static analysis, no instrumentation required.

**Full design doc:** `/Users/namangoel/Downloads/flowmap-design-doc.md`
**Full dev guide:** `DEV.md` in repo root — API reference, architecture, extension guide, bug list

---

## Stack
- **Monorepo:** npm workspaces (`packages/shared`, `packages/server`, `packages/ui`)
- **Backend:** Express + better-sqlite3 + tsx watch
- **Frontend:** React + Vite + @xyflow/react (React Flow v12)
- **AI:** Gemini (`gemini-2.5-flash`) via `AI_PROVIDER=gemini` in `.env`
- **DB:** SQLite — auto-created at `flowmap.db` relative to server CWD

---

## Key commands
```bash
npm run dev                        # server :3001 + UI :5173
npm run dev -w packages/server     # server only
npm run dev -w packages/ui         # UI only

npm run build -w packages/shared   # required before typechecking server
npm run typecheck -w packages/server
npm run typecheck -w packages/ui
```

---

## Critical rules
1. `.env` lives at **repo root** — server resolves it via `path.resolve(__dirname, "../../../.env")`. Never rely on CWD-relative dotenv.
2. **Always build shared** (`npm run build -w packages/shared`) before typechecking server — server references `../shared/dist/index.d.ts`.
3. **AI provider is Gemini** — don't switch without asking. `gemini-2.5-flash` is the tested model.
4. **Test with curl** against the running server, not just typecheck.
5. **Ask before assuming** what to build next.

---

## Current state (v0.1)

| Feature | Status |
|---|---|
| Infra scan (queues, workers, topics, tables) | ✅ Done |
| Flow building — auto-scan | ✅ Done |
| Flow building — user-requested (2-pass AI) | ✅ Done |
| FlowGraph (inter-flow connections) | ✅ Done |
| Run engine — webhook (HTTP) trigger | ✅ Done |
| Run engine — queue (BullMQ) trigger | ✅ Done |
| Run engine — AI-generated input | ✅ Done |
| Edge observation toggle (persisted) | ✅ Done |
| Run event capture | ❌ Not built |
| Edge snapshot capture | ❌ Not built |
| FlowGraph UI canvas view | ❌ Not built |
| Live run streaming (SSE) | ❌ Not built |
| DAG auto-layout for flow canvas | ❌ Not built |

---

## Top bugs to fix first

1. **`runs` table missing FK to `projects`** — deleting a project leaves orphaned runs (`db/schema.ts:44`)
2. **Gemini silent failure** — chat API requires strictly alternating user/model roles; fails silently if messages end on assistant turn (`ai/gemini.ts:24-33`)
3. **Edge observe toggle desyncs UI** — UI state mutates before API call; no rollback on failure (`pages/FlowPage.tsx:61-74`)
4. **No input validation** on any route body — zod is listed in dependencies but never used
5. **No env validation at startup** — missing API key fails on first AI call, not on boot

---

## Key files to know

| File | Purpose |
|---|---|
| `packages/server/src/scanner/infraScanner.ts` | AI infra scan — walks repo, extracts queues/workers/tables |
| `packages/server/src/scanner/flowBuilder.ts` | 2-pass AI flow + FlowGraph builder |
| `packages/server/src/engine/runner.ts` | Run dispatcher — webhook HTTP + BullMQ queue |
| `packages/server/src/ai/gemini.ts` | Active AI provider |
| `packages/server/src/ai/provider.ts` | AIProvider interface + factory |
| `packages/server/src/db/schema.ts` | SQLite schema + additive migrations |
| `packages/ui/src/pages/FlowPage.tsx` | Flow canvas, edge observation, run triggers |
| `packages/ui/src/api/client.ts` | Typed fetch wrapper for all server endpoints |

---

## Test project (Zyaro)
- **Project ID in local DB:** `c5b099d4-404b-4bc2-8f69-237fa98aff80`
- **Repo path:** `/Users/namangoel/Desktop/projects/zyaro/zyaro-service`
- **Infra scanned:** yes — 13 queues, 11 workers, 3 topics, 34 tables
- **Flows built:** processEngagementJob (7 nodes, 6 edges, 0.8 confidence)

---

## How to start a new session
> "Continue building FlowMap. Read CLAUDE.md and DEV.md, then [specific task]."

The memory system at `~/.claude/projects/.../memory/` fills in additional context on relevant queries.
