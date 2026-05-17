import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderGit2, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import { useProjects, useCreateProject } from "../hooks/useProjects.ts";

export default function ProjectsPage() {
  const [repoPath, setRepoPath] = useState("");
  const [name, setName] = useState("");
  const navigate = useNavigate();

  const { data: projects, isLoading } = useProjects();
  const { mutate: createProject, isPending: creating, error: createError } = useCreateProject();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!repoPath.trim()) return;
    createProject(
      { name: name.trim() || repoPath.split("/").at(-1) || repoPath, repo_path: repoPath.trim() },
      { onSuccess: (p) => navigate(`/projects/${p.id}`) }
    );
  }

  return (
    <div className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-[#e5e5e5]">FlowMap</h1>
        <p className="text-[#666] mt-1 text-sm">Make your backend flows visible</p>
      </div>

      {/* Connect form */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold text-[#999] uppercase tracking-widest mb-4">
          Connect a repository
        </h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <input
            className="bg-[#0a0a0a] border border-[#333] rounded-lg px-4 py-2.5 text-[#e5e5e5] text-sm outline-none focus:border-[#555] transition-colors placeholder:text-[#444]"
            placeholder="/Users/you/myapp  (absolute path)"
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
          />
          <input
            className="bg-[#0a0a0a] border border-[#333] rounded-lg px-4 py-2.5 text-[#e5e5e5] text-sm outline-none focus:border-[#555] transition-colors placeholder:text-[#444]"
            placeholder="Project name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {createError && (
            <p className="text-[#f87171] text-xs">{(createError as Error).message}</p>
          )}
          <button
            type="submit"
            disabled={creating || !repoPath.trim()}
            className="flex items-center justify-center gap-2 bg-white text-black font-semibold text-sm rounded-lg px-4 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <FolderGit2 size={14} />}
            {creating ? "Connecting…" : "Connect repo"}
          </button>
        </form>
      </div>

      {/* Projects list */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-[#555] text-sm">
          <Loader2 size={14} className="animate-spin" />
          Loading projects…
        </div>
      ) : !projects?.length ? (
        <p className="text-[#444] text-sm">No projects yet. Connect a repo above.</p>
      ) : (
        <div>
          <h2 className="text-xs font-semibold text-[#555] uppercase tracking-widest mb-3">
            Projects
          </h2>
          <div className="flex flex-col gap-2">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="group bg-[#111] border border-[#1f1f1f] hover:border-[#333] rounded-xl px-5 py-4 text-left transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[15px] text-[#e5e5e5]">{p.name}</span>
                  <ChevronRight
                    size={16}
                    className="text-[#333] group-hover:text-[#666] transition-colors"
                  />
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="font-mono text-[11px] text-[#444] truncate">{p.repo_path}</span>
                  {p.infra_scanned && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-[#4ade80] shrink-0">
                      <CheckCircle2 size={10} />
                      scanned
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
