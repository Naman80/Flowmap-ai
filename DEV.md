# FlowMap — Developer Guide

> Last updated: May 2026 · v0.1

---

## Table of Contents
1. [Project Structure](#1-project-structure)
2. [Running Locally](#2-running-locally)
3. [Architecture Overview](#3-architecture-overview)
4. [API Reference](#4-api-reference)
5. [Known Issues & Bugs](#5-known-issues--bugs)
6. [Extension Guide](#6-extension-guide)
7. [v1 Progress](#7-v1-progress)
8. [What to Build Next](#8-what-to-build-next)

---

## 1. Project Structure

```
flowmap-ai/
├── .env                        # API keys + config (gitignored)
├── .env.example                # Template
├── flowmap.db                  # SQLite DB (gitignored, auto-created)
├── packages/
│   ├── shared/                 # Pure TypeScript types, no deps
│   │   └── src/types.ts        # All domain types: Flow, Node, Edge, FlowGraph, Run, etc.
│   ├── server/                 # Express backend
│   │   └── src/
│   │       ├── index.ts        # Entry point — dotenv, initAI, init DB, mount routes
│   │       ├── ai/
│   │       │   ├── provider.ts     # AIProvider interface + initAIProvider() factory
│   │       │   ├── anthropic.ts    # Claude integration
│   │       │   ├── openai.ts       # OpenAI integration
│   │       │   └── gemini.ts       # Gemini integration (currently active)
│   │       ├── db/
│   │       │   ├── schema.ts       # SQLite schema + additive migrations
│   │       │   └── client.ts       # Singleton DB instance
│   │       ├── scanner/
│   │       │   ├── infraScanner.ts # AI infra scan (queues/workers/tables/topics)
│   │       │   └── flowBuilder.ts  # 2-pass AI flow + FlowGraph builder
│   │       ├── engine/
│   │       │   └── runner.ts       # Run dispatcher (webhook HTTP + BullMQ queue)
│   │       └── routes/
│   │           ├── projects.ts     # /api/projects
│   │           ├── flows.ts        # /api/flows
│   │           └── runs.ts         # /api/runs
│   └── ui/                     # React + Vite frontend
│       └── src/
│           ├── App.tsx             # Routes: /projects, /projects/:id, /projects/:id/flows/:id
│           ├── api/client.ts       # Typed fetch wrapper for all server endpoints
│           ├── pages/
│           │   ├── ProjectsPage.tsx    # Connect a repo, list projects
│           │   ├── ProjectPage.tsx     # Infra scan, build flows
│           │   └── FlowPage.tsx        # ReactFlow canvas + edge observation + triggers
│           └── components/
│               └── FlowNode.tsx        # Custom ReactFlow node (type colors, DB ops, etc.)
```

---

## 2. Running Locally

### Prerequisites
- Node.js 20+
- npm 9+
- A Gemini API key (or Anthropic/OpenAI)

### Setup

```bash
# 1. Install all workspace dependencies
npm install

# 2. Create .env at repo root
cp .env.example .env
# Edit .env — set AI_PROVIDER and the matching API key

# 3. Run everything
npm run dev          # server :3001 + UI :5173

# Or individually:
npm run dev -w packages/server   # server only
npm run dev -w packages/ui       # UI only
```

### Key env vars

| Variable | Required | Default | Notes |
|---|---|---|---|
| `AI_PROVIDER` | yes | `anthropic` | `anthropic` \| `openai` \| `gemini` |
| `ANTHROPIC_API_KEY` | if anthropic | — | |
| `ANTHROPIC_MODEL` | no | `claude-sonnet-4-6` | |
| `OPENAI_API_KEY` | if openai | — | |
| `OPENAI_MODEL` | no | `gpt-4o` | |
| `GEMINI_API_KEY` | if gemini | — | |
| `GEMINI_MODEL` | no | `gemini-2.0-flash` | Use `gemini-2.5-flash` for best results |
| `PORT` | no | `3001` | |
| `DB_PATH` | no | `./flowmap.db` | Relative to server CWD (`packages/server/`) |

> **Important:** `.env` must be at the **repo root** (`flowmap-ai/.env`), not inside `packages/server/`. The server resolves it via `path.resolve(__dirname, "../../../.env")`.

### Build shared before typechecking server

```bash
npm run build -w packages/shared   # generates packages/shared/dist/
npm run typecheck -w packages/server
npm run typecheck -w packages/ui
```

---

## 3. Architecture Overview

### Data flow

```
User connects repo
      ↓
POST /api/projects              → Project row in SQLite
      ↓
POST /api/projects/:id/scan-infra
      → infraScanner.ts reads source files (priority: queues/, workers/, prisma/)
      → AI extracts: queues, workers, topics, tables
      → InfraIndex stored as JSON blob in infra_index table
      ↓
POST /api/flows/build
      → flowBuilder.ts — 2-pass for user-requested, 1-pass for auto
      → Pass 1: AI selects relevant files from directory listing
      → Pass 2: AI reads those files fully, builds Flow JSON (nodes, edges, meta)
      → Flow stored as JSON blob in flows table
      ↓
POST /api/flows/graph/build
      → flowBuilder.buildFlowGraph() — AI connects flows via queues/webhooks
      → FlowGraph stored in flow_graphs table
      ↓
POST /api/runs
      → AI generates input (if trigger_mode=ai)
      → Run record created (status: pending)
      → Response returned immediately
      → runner.ts dispatches async:
          webhook → fetch() to app_url + path
          queue   → BullMQ Queue.add() to redis_url
```

### Database schema

```sql
projects       (id, name, repo_path, app_url, redis_url, infra_scanned, ...)
infra_index    (id, project_id, data JSON, scanned_at)
flows          (id, project_id, name, description, data JSON, created_at)
flow_graphs    (id, project_id, name, data JSON, created_at)
runs           (id, flow_id, project_id, status, trigger_mode, input JSON, ...)
run_events     (id, run_id, type, node_id, payload JSON, timestamp)
```

All complex objects (Flow, InfraIndex, FlowGraph) are stored as JSON blobs. This keeps the schema simple but means schema migrations require rewriting blob content if types change.

### AI provider abstraction

Every provider implements:
```typescript
interface AIProvider {
  name: string;
  complete(system: string, messages: AIMessage[], opts?: { json?: boolean; maxTokens?: number }): Promise<string>;
}
```

Switch providers by setting `AI_PROVIDER` in `.env`. Currently tested and working: **Gemini (`gemini-2.5-flash`)**.

---

## 4. API Reference

### Projects

| Method | Path | Body | Description |
|---|---|---|---|
| GET | `/api/projects` | — | List all projects |
| POST | `/api/projects` | `{ name?, repo_path }` | Connect a repo |
| GET | `/api/projects/:id` | — | Get project details |
| PATCH | `/api/projects/:id` | `{ name?, app_url?, redis_url? }` | Update execution config |
| POST | `/api/projects/:id/scan-infra` | — | Run AI infra scan |
| GET | `/api/projects/:id/infra` | — | Get last infra scan result |

### Flows

| Method | Path | Body | Description |
|---|---|---|---|
| GET | `/api/flows?projectId=` | — | List flows for a project |
| POST | `/api/flows/build` | `{ project_id, request? }` | Build flows (omit request = auto-scan) |
| GET | `/api/flows/:id` | — | Get a single flow |
| DELETE | `/api/flows/:id` | — | Delete a flow |
| PATCH | `/api/flows/:flowId/edges/:edgeId/observe` | `{ observed? }` | Toggle edge observation |
| GET | `/api/flows/graph/:projectId` | — | Get flow graph |
| POST | `/api/flows/graph/build` | `{ project_id }` | (Re)build flow graph |

### Runs

| Method | Path | Body | Description |
|---|---|---|---|
| GET | `/api/runs?flowId=` | — | List runs for a flow |
| POST | `/api/runs` | `{ flow_id, trigger_mode, input? }` | Trigger a run |
| GET | `/api/runs/:id` | — | Get run details |
| GET | `/api/runs/:id/events` | — | Get run events (node_start, node_end, etc.) |
| PATCH | `/api/runs/:id/complete` | `{ status, error? }` | Mark run complete (called by target app) |

### All responses

```typescript
{ ok: true,  data: T }     // success
{ ok: false, error: string } // failure
```

---

## 5. Known Issues & Bugs

### Critical (fix before using in production)

| # | Location | Issue |
|---|---|---|
| 1 | `db/schema.ts:44` | `runs` table has no FK to `projects` — deleting a project leaves orphaned runs |
| 2 | `ai/gemini.ts:24-33` | Gemini requires strictly alternating user/model roles. If messages end on an assistant turn, the chat API rejects it silently |
| 3 | `pages/FlowPage.tsx:61-74` | Edge observed toggle: UI state updates before API call — if API fails, UI is out of sync with DB |

### High priority

| # | Location | Issue |
|---|---|---|
| 4 | `routes/*.ts` | No input validation — route bodies aren't schema-validated (no zod, no checks) |
| 5 | `index.ts` | Env vars aren't validated at startup — missing API key fails on first AI call, not boot |
| 6 | `scanner/infraScanner.ts:127` | Files truncated at 25k chars — if infra declarations are past that offset, AI misses them |
| 7 | `routes/flows.ts, runs.ts` | No pagination — list endpoints return all rows unbounded |
| 8 | `db/schema.ts` | No indexes on FK columns (`project_id`, `flow_id`) — queries do full table scans |

### Medium priority

| # | Location | Issue |
|---|---|---|
| 9 | `server/package.json` | `zod` is listed as a dependency but never imported — dead weight |
| 10 | `engine/runner.ts:93` | Redis URL parsing via `new URL()` — will throw if url is malformed, no validation |
| 11 | `scanner/flowBuilder.ts` | Two AI calls are sequential — Pass 1 then Pass 2 blocks for 30-60s total |
| 12 | `db/schema.ts` | `runMigration()` silently swallows all errors — real DB issues are hidden |
| 13 | `vite.config.ts:9` | Backend URL hardcoded to `localhost:3001` — production builds break |

---

## 6. Extension Guide

### Adding a new AI provider

1. Create `packages/server/src/ai/myprovider.ts` implementing `AIProvider`
2. Add a case to `initAIProvider()` in `provider.ts`
3. Add env vars to `.env.example`

```typescript
// ai/myprovider.ts
import type { AIMessage, AIProvider } from "./provider.js";

export function createMyProvider(): AIProvider {
  return {
    name: "myprovider",
    async complete(system, messages, opts = {}) {
      // call your API, return response text
      return "...";
    },
  };
}
```

### Adding a new route

1. Create `packages/server/src/routes/myroute.ts`
2. Export a `Router` and mount it in `index.ts`
3. Add typed API methods to `packages/ui/src/api/client.ts`

### Adding a new node type

1. Add the string to `NodeType` union in `packages/shared/src/types.ts`
2. Run `npm run build -w packages/shared`
3. Add a color and icon in `packages/ui/src/components/FlowNode.tsx` (`NODE_TYPE_COLORS`, `NODE_TYPE_ICONS`)
4. Add the new type to the AI prompt in `scanner/flowBuilder.ts` `FLOW_BUILD_PROMPT`

### Adding a new trigger type

1. Add to `FlowTrigger` union in `shared/src/types.ts`
2. Add a dispatch case in `engine/runner.ts` `dispatch()` function
3. Update `toRFEdges()` in `FlowPage.tsx` if the trigger needs visual treatment

### Database schema changes

Add an additive migration in `db/schema.ts`:

```typescript
// At the bottom of initDb()
runMigration(db, "ALTER TABLE flows ADD COLUMN my_new_column TEXT");
```

For new tables use `CREATE TABLE IF NOT EXISTS` in `db.exec()`. Never use `ALTER TABLE` for renaming or dropping — create a new table and migrate data in a script.

---

## 7. v1 Progress

| Feature | Status | Notes |
|---|---|---|
| Infra scan | ✅ Done | Queues, workers, topics, tables extracted from Zyaro correctly |
| Flow building (auto) | ✅ Done | 1-pass, heuristic file priority |
| Flow building (user-requested) | ✅ Done | 2-pass — AI picks files, then reads fully |
| FlowGraph | ✅ Done | AI connects flows via queue/webhook/event mechanisms |
| Triggering (webhook) | ✅ Done | HTTP fetch to `app_url` + trigger path |
| Triggering (queue) | ✅ Done | BullMQ enqueue to `redis_url` |
| Triggering (AI-generated input) | ✅ Done | Gemini generates realistic payloads |
| Edge observation toggle | ✅ Done | Persists `observed: true` on edges in DB |
| Run event capture | ❌ Not built | DB table exists, endpoint missing, target app integration undefined |
| Edge snapshot capture | ❌ Not built | Type defined, UI panel ready, capture logic missing |
| FlowGraph UI view | ❌ Not built | Data exists, no dedicated canvas view yet |
| Live run streaming (SSE) | ❌ Not built | Design doc specifies this |

---

## 8. What to Build Next

Ordered by impact:

### 1. Fix critical bugs (< 1 day)
- Add `REFERENCES projects(id)` FK to `runs` table migration
- Fix Gemini role handling in `gemini.ts`
- Add optimistic-rollback to edge observe toggle in `FlowPage.tsx`

### 2. Run event capture (2-3 days)
- Define `POST /api/runs/:id/events` endpoint to receive events from target app
- Target app needs a thin SDK/middleware that POSTs `node_start`, `node_end`, `data_in`, `data_out` back to FlowMap
- OR: implement a lightweight polling-based approach (target app writes logs, FlowMap polls)

### 3. Edge snapshot capture (1-2 days)
- When a run completes, check for edges with `observed: true`
- If target app POSTed `data_out` events for those edges, store as `snapshot`
- Reset `observed` to false after capture (per design doc: one run = one snapshot)

### 4. FlowGraph canvas view (1-2 days)
- New page or tab in `FlowPage.tsx` showing the macro graph
- Nodes = flows, edges = FlowConnections
- Clicking a node navigates to that flow's canvas

### 5. UI: DAG auto-layout (1 day)
- `FlowPage.tsx` currently places nodes in a grid
- Use `dagre` or `@xyflow/react`'s built-in layout to arrange nodes top-to-bottom following edges
- Install: `npm install dagre @types/dagre -w packages/ui`

### 6. Input validation + startup checks (1 day)
- Add `zod` schemas for all route bodies (it's already a listed dependency, just unused)
- Add env validation in `index.ts` `main()` before starting server

### 7. DB indexes + pagination (< 1 day)
```sql
CREATE INDEX IF NOT EXISTS idx_flows_project ON flows(project_id);
CREATE INDEX IF NOT EXISTS idx_runs_flow ON runs(flow_id);
CREATE INDEX IF NOT EXISTS idx_run_events_run ON run_events(run_id);
```
Add `?limit=&offset=` to list endpoints.

---

*Design doc: `/Users/namangoel/Downloads/flowmap-design-doc.md`*
*Zyaro project ID in local DB: `c5b099d4-404b-4bc2-8f69-237fa98aff80`*
*Zyaro repo path: `/Users/namangoel/Desktop/projects/zyaro/zyaro-service`*
