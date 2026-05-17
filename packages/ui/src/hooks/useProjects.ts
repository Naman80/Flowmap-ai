import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.ts";
import type { Project } from "@flowmap/shared";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => api.listProjects(),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => api.getProject(id!),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, repo_path }: { name: string; repo_path: string }) =>
      api.createProject(name, repo_path),
    onSuccess: (project: Project) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.setQueryData(["project", project.id], project);
    },
  });
}

export function useScanInfra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.scanInfra(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["infra", id] });
    },
  });
}

export function usePatchProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...patch
    }: {
      id: string;
      name?: string;
      app_url?: string;
      redis_url?: string;
    }) => api.patchProject(id, patch),
    onSuccess: (project: Project) => {
      qc.setQueryData(["project", project.id], project);
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useInfra(projectId: string | undefined) {
  return useQuery({
    queryKey: ["infra", projectId],
    queryFn: () => api.getInfra(projectId!),
    enabled: !!projectId,
  });
}
