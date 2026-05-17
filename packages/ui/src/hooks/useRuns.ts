import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.ts";
import type { Run } from "@flowmap/shared";

export function useRuns(flowId: string | undefined) {
  return useQuery({
    queryKey: ["runs", flowId],
    queryFn: () => api.listRuns(flowId!),
    enabled: !!flowId,
    refetchInterval: 5000,
  });
}

export function useRunEvents(runId: string | undefined) {
  return useQuery({
    queryKey: ["runEvents", runId],
    queryFn: () => api.getRunEvents(runId!),
    enabled: !!runId,
  });
}

export function useTriggerRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      flow_id,
      trigger_mode,
      input,
    }: {
      flow_id: string;
      trigger_mode: "ai" | "manual";
      input?: unknown;
    }) => api.triggerRun(flow_id, trigger_mode, input),
    onSuccess: (run: Run) => {
      qc.setQueryData<Run[]>(["runs", run.flow_id], (prev) =>
        prev ? [run, ...prev] : [run]
      );
    },
  });
}
