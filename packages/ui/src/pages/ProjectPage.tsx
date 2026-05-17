import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Scan, Wand2, ChevronRight, Loader2, Network } from "lucide-react";
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
      <div className="flex items-center gap-2 p-12 text-[#555] text-sm">
        <Loader2 size={14} className="animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[#555] text-xs mb-8">
        <Link to="/projects" className="hover:text-[#888] transition-colors">Projects</Link>
        <span>/</span>
        <span className="text-[#888]">{project.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#e5e5e5]">{project.name}</h1>
          <p className="font-mono text-xs text-[#444] mt-1">{project.repo_path}</p>
        </div>
        <button
          onClick={() => navigate(`/projects/${projectId}/graph`)}
          className="flex items-center gap-2 bg-[#111] border border-[#222] hover:border-[#333] text-[#888] text-xs font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <Network size={13} />
          Flow Graph
        </button>
      </div>

      {error && (
        <p className="text-[#f87171] text-xs mb-6">{(error as Error).message}</p>
      )}

      {/* Infra section */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold text-[#999] uppercase tracking-widest flex-1">
            Infrastructure Index
          </h2>
          <button
            onClick={() => scanInfra(project.id)}
            disabled={scanning}
            className="flex items-center gap-1.5 text-xs font-medium bg-[#111] border border-[#222] hover:border-[#333] text-[#e5e5e5] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
          >
            {scanning ? <Loader2 size={12} className="animate-spin" /> : <Scan size={12} />}
            {scanning ? "Scanning…" : project.infra_scanned ? "Re-scan" : "Scan infra"}
          </button>
        </div>

        {infra ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfraStat label="Queues"  items={infra.queues.map((q) => q.name)} />
            <InfraStat label="Topics"  items={infra.topics.map((t) => t.name)} />
            <InfraStat label="Workers" items={infra.workers.map((w) => w.function)} />
            <InfraStat label="Tables"  items={infra.tables.map((t) => t.name)} />
          </div>
        ) : (
          <p className="text-[#444] text-sm">No infra scan yet. Click "Scan infra" to begin.</p>
        )}
      </section>

      {/* Flows section */}
      <section>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h2 className="text-sm font-semibold text-[#999] uppercase tracking-widest flex-1">
            Flows
          </h2>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              className="bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-1.5 text-[#e5e5e5] text-xs outline-none focus:border-[#444] transition-colors placeholder:text-[#444] flex-1 min-w-0"
              placeholder="Describe a flow (leave empty for auto-scan)"
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
              className="flex items-center gap-1.5 text-xs font-semibold bg-white text-black px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {building ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              {building ? "Building…" : "Build flows"}
            </button>
          </div>
        </div>
        {!project.infra_scanned && (
          <p className="text-[#444] text-xs mb-3">Run infra scan first before building flows.</p>
        )}

        {!flows?.length ? (
          <p className="text-[#444] text-sm">No flows yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {flows.map((f) => (
              <button
                key={f.id}
                onClick={() => navigate(`/projects/${projectId}/flows/${f.id}`)}
                className="group bg-[#111] border border-[#1f1f1f] hover:border-[#333] rounded-xl px-5 py-4 text-left transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[15px] text-[#e5e5e5]">{f.name}</span>
                  <ChevronRight size={15} className="text-[#333] group-hover:text-[#666] transition-colors" />
                </div>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <TriggerBadge trigger={f.trigger} />
                  <span className="text-[11px] text-[#555]">{Math.round(f.meta.confidence * 100)}% confidence</span>
                  <span className="text-[10px] bg-[#1a1a1a] text-[#444] px-1.5 py-0.5 rounded">
                    {f.meta.source === "auto_scan" ? "auto" : "user"}
                  </span>
                </div>
                {f.description && (
                  <p className="text-[#555] text-xs mt-2 line-clamp-2">{f.description}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function InfraStat({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-4">
      <div className="text-xs font-semibold text-[#666] mb-3">
        {label} <span className="text-[#444]">({items.length})</span>
      </div>
      <div className="flex flex-col gap-1">
        {items.slice(0, 5).map((item) => (
          <span key={item} className="font-mono text-[11px] text-[#aaa] truncate" title={item}>
            {item}
          </span>
        ))}
        {items.length > 5 && (
          <span className="text-[10px] text-[#444]">+{items.length - 5} more</span>
        )}
      </div>
    </div>
  );
}

function TriggerBadge({ trigger }: { trigger: Flow["trigger"] }) {
  const label =
    trigger.type === "queue"
      ? `queue: ${trigger.queue_name}`
      : trigger.type === "webhook"
      ? `${trigger.method} ${trigger.path}`
      : trigger.type;
  return (
    <span className="font-mono text-[10px] bg-[#0f1b2d] text-[#60a5fa] px-2 py-0.5 rounded">
      {label}
    </span>
  );
}
