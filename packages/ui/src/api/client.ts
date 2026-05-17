import type {
  Project,
  InfraIndex,
  Flow,
  FlowGraph,
  Run,
  RunEvent,
  ApiResponse,
} from "@flowmap/shared";

const BASE = "/api";

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const json: ApiResponse<T> = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

export const api = {
  // Projects
  listProjects: () => request<Project[]>("GET", "/projects"),
  createProject: (name: string, repo_path: string) =>
    request<Project>("POST", "/projects", { name, repo_path }),
  getProject: (id: string) => request<Project>("GET", `/projects/${id}`),
  patchProject: (id: string, patch: { name?: string; app_url?: string; redis_url?: string }) =>
    request<Project>("PATCH", `/projects/${id}`, patch),
  scanInfra: (id: string) => request<InfraIndex>("POST", `/projects/${id}/scan-infra`),
  getInfra: (id: string) => request<InfraIndex>("GET", `/projects/${id}/infra`),

  // Flows
  listFlows: (projectId: string) =>
    request<Flow[]>("GET", `/flows?projectId=${projectId}`),
  getFlow: (id: string) => request<Flow>("GET", `/flows/${id}`),
  buildFlows: (project_id: string, req?: string) =>
    request<Flow[]>("POST", "/flows/build", { project_id, request: req }),
  deleteFlow: (id: string) => request<null>("DELETE", `/flows/${id}`),
  setEdgeObserved: (flowId: string, edgeId: string, observed: boolean) =>
    request("PATCH", `/flows/${flowId}/edges/${edgeId}/observe`, { observed }),
  getFlowGraph: (projectId: string) =>
    request<FlowGraph>("GET", `/flows/graph/${projectId}`),
  buildFlowGraph: (project_id: string) =>
    request<FlowGraph>("POST", "/flows/graph/build", { project_id }),

  // Runs
  listRuns: (flowId: string) =>
    request<Run[]>("GET", `/runs?flowId=${flowId}`),
  getRun: (id: string) => request<Run>("GET", `/runs/${id}`),
  getRunEvents: (id: string) => request<RunEvent[]>("GET", `/runs/${id}/events`),
  triggerRun: (flow_id: string, trigger_mode: "ai" | "manual", input?: unknown) =>
    request<Run>("POST", "/runs", { flow_id, trigger_mode, input }),
};
