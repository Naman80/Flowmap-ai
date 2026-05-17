import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderGit2, ChevronRight, CheckCircle2, Loader2, GitBranch, Clock } from "lucide-react";
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
    <div className="min-h-screen bg-[#0d1117]">
      {/* Hero */}
      <div className="border-b border-[#21262d] bg-[#161b22]">
        <div className="max-w-3xl mx-auto px-8 py-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#7c3aed] rounded-xl flex items-center justify-center">
              <GitBranch size={20} color="#fff" />
            </div>
            <h1 className="text-[32px] font-bold text-[#e6edf3] tracking-tight">FlowMap</h1>
          </div>
          <p className="text-[17px] text-[#8b949e] leading-relaxed">
            Make your backend flows visible, executable, and observable — zero instrumentation.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-10">
        {/* Connect form */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 mb-10">
          <h2 className="text-[17px] font-semibold text-[#e6edf3] mb-1">Connect a repository</h2>
          <p className="text-[14px] text-[#8b949e] mb-5">Point FlowMap at a local repo path to start analysing flows.</p>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div>
              <label className="block text-[13px] text-[#8b949e] mb-1.5 font-medium">Repository path</label>
              <input
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[#7c3aed] rounded-xl px-4 py-3 text-[15px] text-[#e6edf3] outline-none transition-colors placeholder:text-[#444c56]"
                placeholder="/Users/you/myapp"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[13px] text-[#8b949e] mb-1.5 font-medium">Project name <span className="text-[#6e7681]">(optional)</span></label>
              <input
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[#7c3aed] rounded-xl px-4 py-3 text-[15px] text-[#e6edf3] outline-none transition-colors placeholder:text-[#444c56]"
                placeholder="My Backend"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            {createError && (
              <p className="text-[#f85149] text-[14px] bg-[#2a0d0d] border border-[#f8514933] rounded-xl px-4 py-2.5">
                {(createError as Error).message}
              </p>
            )}
            <button
              type="submit"
              disabled={creating || !repoPath.trim()}
              className="flex items-center justify-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-[15px] rounded-xl px-5 py-3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors mt-1"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <FolderGit2 size={16} />}
              {creating ? "Connecting…" : "Connect repo"}
            </button>
          </form>
        </div>

        {/* Projects list */}
        {isLoading ? (
          <div className="flex items-center gap-3 text-[#8b949e] text-[15px]">
            <Loader2 size={16} className="animate-spin" />
            Loading projects…
          </div>
        ) : !projects?.length ? (
          <div className="text-center py-16 text-[#6e7681]">
            <FolderGit2 size={36} className="mx-auto mb-3 text-[#30363d]" />
            <p className="text-[15px]">No projects yet. Connect a repo above.</p>
          </div>
        ) : (
          <div>
            <h2 className="text-[13px] font-semibold text-[#8b949e] uppercase tracking-widest mb-4">
              Projects ({projects.length})
            </h2>
            <div className="flex flex-col gap-3">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="group bg-[#161b22] border border-[#30363d] hover:border-[#7c3aed] rounded-2xl px-6 py-5 text-left transition-all hover:shadow-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-[17px] text-[#e6edf3] group-hover:text-white transition-colors">
                      {p.name}
                    </span>
                    <ChevronRight size={18} className="text-[#444c56] group-hover:text-[#7c3aed] transition-colors" />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-[13px] text-[#6e7681] truncate flex-1">{p.repo_path}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      {p.infra_scanned && (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-[#3fb950] font-medium">
                          <CheckCircle2 size={12} />
                          Scanned
                        </span>
                      )}
                      {p.last_scanned_at && (
                        <span className="inline-flex items-center gap-1 text-[12px] text-[#6e7681]">
                          <Clock size={11} />
                          {new Date(p.last_scanned_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
