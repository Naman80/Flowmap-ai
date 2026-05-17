import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Scan, Wand2, ChevronRight, Loader2, Network,
  Database, MessageSquare, Cpu, Table2, GitBranch,
  Zap, Hand, ArrowRight
} from "lucide-react";
import { useProject, useScanInfra, useInfra } from "../hooks/useProjects.ts";
import { useFlows, useBuildFlows } from "../hooks/useFlows.ts";
import type { Flow } from "@flowmap/shared";

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [buildRequest, setBuildRequest] = useState("");

  const { data: project, isLoading } = useProject(projectId);
  const { data: infra } = useInfra(projectId);
  const { data: flows } = useFlows(projectId);

  const { mutate: scanInfra, isPending: scanning, error: scanError } = useScanInfra();
  const { mutate: buildFlows, isPending: building, error: buildError } = useBuildFlows();

  const error = scanError || buildError;

  if (isLoading || !project) {
    return (
      <div className="flex items-center justify-center h-screen gap-3 text-[#8b949e] bg-[#0d1117]">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-[15px]">Loading…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Header */}
      <div className="bg-[#161b22] border-b border-[#21262d]">
        <div className="max-w-5xl mx-auto px-8 py-6">
          <div className="flex items-center gap-2 text-[14px] text-[#6e7681] mb-4">
            <Link to="/projects" className="hover:text-[#8b949e] transition-colors">Projects</Link>
            <ChevronRight size={14} className="text-[#444c56]" />
            <span className="text-[#8b949e]">{project.name}</span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-[28px] font-bold text-[#e6edf3] tracking-tight">{project.name}</h1>
              <p className="font-mono text-[13px] text-[#6e7681] mt-1">{project.repo_path}</p>
            </div>
            <button
              onClick={() => navigate(`/projects/${projectId}/graph`)}
              className="flex items-center gap-2 bg-[#21262d] hover:bg-[#2d333b] border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] text-[14px] font-medium px-4 py-2.5 rounded-xl transition-colors"
            >
              <Network size={15} />
              Flow Graph
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        {error && (
          <div className="mb-6 bg-[#2a0d0d] border border-[#f8514933] rounded-xl px-5 py-3 text-[#f85149] text-[14px]">
            {(error as Error).message}
          </div>
        )}

        {/* Infra section */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[18px] font-semibold text-[#e6edf3]">Infrastructure Index</h2>
              <p className="text-[13px] text-[#8b949e] mt-0.5">Queues, workers, topics and tables detected in the repo</p>
            </div>
            <button
              onClick={() => scanInfra(project.id)}
              disabled={scanning}
              className="flex items-center gap-2 bg-[#21262d] hover:bg-[#2d333b] border border-[#30363d] text-[#e6edf3] text-[14px] font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40"
            >
              {scanning ? <Loader2 size={14} className="animate-spin" /> : <Scan size={14} />}
              {scanning ? "Scanning…" : project.infra_scanned ? "Re-scan" : "Scan infra"}
            </button>
          </div>

          {infra ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfraCard label="Queues" count={infra.queues.length} icon={MessageSquare} color="#7c3aed" items={infra.queues.map((q) => q.name)} />
              <InfraCard label="Topics" count={infra.topics.length} icon={GitBranch} color="#58a6ff" items={infra.topics.map((t) => t.name)} />
              <InfraCard label="Workers" count={infra.workers.length} icon={Cpu} color="#3fb950" items={infra.workers.map((w) => w.function)} />
              <InfraCard label="Tables" count={infra.tables.length} icon={Table2} color="#d29922" items={infra.tables.map((t) => t.name)} />
            </div>
          ) : (
            <div className="bg-[#161b22] border border-[#30363d] border-dashed rounded-2xl p-10 text-center">
              <Database size={32} className="mx-auto mb-3 text-[#30363d]" />
              <p className="text-[15px] text-[#8b949e]">No infra scan yet</p>
              <p className="text-[13px] text-[#6e7681] mt-1">Click "Scan infra" to detect queues, workers and tables.</p>
            </div>
          )}
        </section>

        {/* Flows section */}
        <section>
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-[18px] font-semibold text-[#e6edf3]">Flows</h2>
              <p className="text-[13px] text-[#8b949e] mt-0.5">AI-detected feature flows in the codebase</p>
            </div>
          </div>

          {/* Build bar */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 mb-6">
            <p className="text-[13px] text-[#8b949e] mb-3 font-medium">Build flows</p>
            <div className="flex gap-3">
              <input
                className="flex-1 bg-[#0d1117] border border-[#30363d] focus:border-[#7c3aed] rounded-xl px-4 py-2.5 text-[14px] text-[#e6edf3] outline-none transition-colors placeholder:text-[#444c56] disabled:opacity-40"
                placeholder="Describe a specific flow, or leave empty for auto-scan"
                value={buildRequest}
                onChange={(e) => setBuildRequest(e.target.value)}
                disabled={!project.infra_scanned}
              />
              <button
                onClick={() =>
                  buildFlows(
                    { project_id: project.id, request: buildRequest || undefined },
                    { onSuccess: () => setBuildRequest("") }
                  )
                }
                disabled={building || !project.infra_scanned}
                className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[14px] font-semibold px-5 py-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {building ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                {building ? "Building…" : "Build"}
              </button>
            </div>
            {!project.infra_scanned && (
              <p className="text-[13px] text-[#d29922] mt-2.5 flex items-center gap-1.5">
                <span>⚠</span> Run infra scan first before building flows.
              </p>
            )}
          </div>

          {!flows?.length ? (
            <div className="bg-[#161b22] border border-[#30363d] border-dashed rounded-2xl p-10 text-center">
              <GitBranch size={32} className="mx-auto mb-3 text-[#30363d]" />
              <p className="text-[15px] text-[#8b949e]">No flows yet</p>
              <p className="text-[13px] text-[#6e7681] mt-1">Build flows from the form above.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {flows.map((f) => (
                <FlowCard key={f.id} flow={f} onClick={() => navigate(`/projects/${projectId}/flows/${f.id}`)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function InfraCard({
  label, count, icon: Icon, color, items,
}: {
  label: string; count: number; icon: typeof Cpu; color: string; items: string[];
}) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div style={{ background: `${color}20`, color }} className="w-9 h-9 rounded-xl flex items-center justify-center">
          <Icon size={16} />
        </div>
        <span className="text-[28px] font-bold text-[#e6edf3]">{count}</span>
      </div>
      <p className="text-[14px] font-semibold text-[#8b949e] mb-3">{label}</p>
      <div className="flex flex-col gap-1">
        {items.slice(0, 4).map((item) => (
          <p key={item} className="font-mono text-[12px] text-[#6e7681] truncate" title={item}>{item}</p>
        ))}
        {items.length > 4 && (
          <p className="text-[12px] text-[#444c56]">+{items.length - 4} more</p>
        )}
      </div>
    </div>
  );
}

function FlowCard({ flow, onClick }: { flow: Flow; onClick: () => void }) {
  const pct = Math.round(flow.meta.confidence * 100);
  const color = pct >= 80 ? "#3fb950" : pct >= 50 ? "#d29922" : "#f85149";

  const triggerLabel =
    flow.trigger.type === "queue" ? flow.trigger.queue_name
    : flow.trigger.type === "webhook" ? `${flow.trigger.method} ${flow.trigger.path}`
    : "Manual";

  return (
    <button
      onClick={onClick}
      className="group bg-[#161b22] border border-[#30363d] hover:border-[#7c3aed] rounded-2xl p-5 text-left transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="font-semibold text-[17px] text-[#e6edf3] group-hover:text-white leading-snug">{flow.name}</span>
        <ArrowRight size={16} className="text-[#444c56] group-hover:text-[#7c3aed] mt-0.5 shrink-0 transition-colors" />
      </div>

      {flow.description && (
        <p className="text-[13px] text-[#8b949e] mb-3 line-clamp-2 leading-relaxed">{flow.description}</p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-[12px] bg-[#0d2137] text-[#58a6ff] px-2.5 py-1 rounded-lg">
          {triggerLabel}
        </span>
        <span className="text-[12px] text-[#6e7681]">
          {flow.nodes.length} nodes · {flow.edges.length} edges
        </span>
        <span style={{ color }} className="text-[12px] font-medium ml-auto">
          {pct}% confidence
        </span>
      </div>

      {/* Confidence bar */}
      <div className="mt-3 h-1 bg-[#21262d] rounded-full overflow-hidden">
        <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full transition-all" />
      </div>
    </button>
  );
}
