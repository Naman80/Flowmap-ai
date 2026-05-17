import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.ts";
import type { Flow } from "@flowmap/shared";

export function useFlows(projectId: string | undefined) {
  return useQuery({
    queryKey: ["flows", projectId],
    queryFn: () => api.listFlows(projectId!),
    enabled: !!projectId,
  });
}

export function useFlow(flowId: string | undefined) {
  return useQuery({
    queryKey: ["flow", flowId],
    queryFn: () => api.getFlow(flowId!),
    enabled: !!flowId,
  });
}

export function useBuildFlows() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ project_id, request }: { project_id: string; request?: string }) =>
      api.buildFlows(project_id, request),
    onSuccess: (_data, { project_id }) => {
      qc.invalidateQueries({ queryKey: ["flows", project_id] });
    },
  });
}

export function useDeleteFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteFlow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flows"] });
    },
  });
}

export function useSetEdgeObserved() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      flowId,
      edgeId,
      observed,
    }: {
      flowId: string;
      edgeId: string;
      observed: boolean;
    }) => api.setEdgeObserved(flowId, edgeId, observed),
    onMutate: async ({ flowId, edgeId, observed }) => {
      await qc.cancelQueries({ queryKey: ["flow", flowId] });
      const prev = qc.getQueryData<Flow>(["flow", flowId]);
      qc.setQueryData<Flow>(["flow", flowId], (old) =>
        old
          ? { ...old, edges: old.edges.map((e) => (e.id === edgeId ? { ...e, observed } : e)) }
          : old!
      );
      return { prev };
    },
    onError: (_err, { flowId }, ctx) => {
      if (ctx?.prev) qc.setQueryData(["flow", flowId], ctx.prev);
    },
    onSettled: (_d, _e, { flowId }) => {
      qc.invalidateQueries({ queryKey: ["flow", flowId] });
    },
  });
}

export function useFlowGraph(projectId: string | undefined) {
  return useQuery({
    queryKey: ["flowGraph", projectId],
    queryFn: () => api.getFlowGraph(projectId!),
    enabled: !!projectId,
    retry: false,
  });
}

export function useBuildFlowGraph() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (project_id: string) => api.buildFlowGraph(project_id),
    onSuccess: (data) => {
      qc.setQueryData(["flowGraph", data.id], data);
    },
  });
}
