// ─────────────────────────────────────────────
// PROJECT — a connected repo FlowMap analyses
// ─────────────────────────────────────────────

export type Project = {
  id: string;
  name: string;
  repo_path: string; // absolute path to the target repo
  created_at: string;
  last_scanned_at: string | null;
  infra_scanned: boolean;
};

export type InfraIndex = {
  project_id: string;
  queues: QueueDef[];
  topics: TopicDef[];
  workers: WorkerDef[];
  tables: TableDef[];
  scanned_at: string;
};

export type QueueDef = {
  name: string;
  file: string;
  job_names: string[];
};

export type TopicDef = {
  name: string;
  file: string;
  pattern?: string; // e.g. "${entityType}.${action}"
};

export type WorkerDef = {
  queue_name: string;
  file: string;
  function: string;
};

export type TableDef = {
  name: string;
  file: string; // schema file where it's defined
};

// ─────────────────────────────────────────────
// FLOW GRAPH — macro level, how flows connect
// ─────────────────────────────────────────────

export type FlowGraph = {
  id: string;
  project_id: string;
  name: string;
  flows: FlowSummary[];
  connections: FlowConnection[];
};

export type FlowSummary = {
  flow_id: string;
  name: string;
  trigger: FlowTrigger;
};

export type FlowConnection = {
  id: string;
  from_flow: string;
  from_node: string;
  to_flow: string;
  via: ConnectionMechanism;
  condition: Condition;
  behaviour: ConnectionBehaviour | null;
  confidence: number;
};

export type ConnectionMechanism =
  | { type: "queue"; queue_name: string }
  | { type: "webhook"; event: string }
  | { type: "event"; event_name: string }
  | { type: "direct" };

export type ConnectionBehaviour = {
  debounce_ms?: number;
  delay_formula?: string;
  max_concurrency?: number;
};

// ─────────────────────────────────────────────
// CONDITION — gate logic for connections
// ─────────────────────────────────────────────

export type Condition = SimpleCondition | CompoundCondition | AlwaysCondition;

export type SimpleCondition = {
  type: "simple";
  field: string;
  operator: Operator;
  value: unknown;
};

export type Operator =
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "in"
  | "not_in"
  | "exists"
  | "not_exists";

export type CompoundCondition = {
  type: "compound";
  operator: "and" | "or" | "not";
  conditions: Condition[];
};

export type AlwaysCondition = {
  type: "always";
};

// ─────────────────────────────────────────────
// FLOW — one complete feature path
// ─────────────────────────────────────────────

export type Flow = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  trigger: FlowTrigger;
  nodes: Node[];
  edges: Edge[];
  meta: FlowMeta;
};

export type FlowTrigger =
  | { type: "queue"; queue_name: string; job_name: string }
  | { type: "webhook"; path: string; method: string }
  | { type: "manual" }
  | { type: "scheduled" };

export type FlowMeta = {
  created_at: string;
  last_run_at: string | null;
  confidence: number;
  source: "auto_scan" | "user_requested";
  tags: string[];
};

// ─────────────────────────────────────────────
// NODE — a function in the flow
// ─────────────────────────────────────────────

export type Node = {
  id: string;
  label: string;
  type: NodeType;
  file: string;
  function: string;
  db_ops: DbOp[];
  emits_to?: string;
  spawns_flow?: string;
  calls_external?: boolean;
};

export type NodeType =
  | "queue_consumer"
  | "guard"
  | "aggregator"
  | "llm_call"
  | "transform"
  | "queue_producer"
  | "external_api";

export type DbOp = {
  table: string;
  operation: "read" | "write" | "read_write";
  description: string;
};

// ─────────────────────────────────────────────
// EDGE — data flowing between two nodes
// ─────────────────────────────────────────────

export type Edge = {
  id: string;
  from: string;
  to: string;
  data_type: string;
  key_fields: string[];
  observed: boolean;
  snapshot: Snapshot | null;
};

export type Snapshot = {
  run_id: string;
  captured_at: string;
  values: Record<string, unknown>;
};

// ─────────────────────────────────────────────
// RUN — one execution of a flow
// ─────────────────────────────────────────────

export type Run = {
  id: string;
  flow_id: string;
  project_id: string;
  status: "pending" | "running" | "completed" | "failed";
  trigger_mode: "ai" | "manual";
  input: unknown;
  started_at: string;
  completed_at: string | null;
  error: string | null;
};

export type RunEvent = {
  type:
    | "node_start"
    | "node_end"
    | "data_in"
    | "data_out"
    | "db_query"
    | "error"
    | "duration_ms";
  run_id: string;
  node_id: string;
  payload: unknown;
  timestamp: string;
};

// ─────────────────────────────────────────────
// API response wrappers
// ─────────────────────────────────────────────

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: string };
export type ApiResponse<T> = ApiOk<T> | ApiErr;
