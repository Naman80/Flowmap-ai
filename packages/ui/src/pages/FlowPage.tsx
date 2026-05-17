import { useCallback, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, Eye, EyeOff, CheckCircle, XCircle, Clock, Zap, Hand, Database, ExternalLink } from "lucide-react";
import type { NodeTypes } from "@xyflow/react";
import { useFlow, useSetEdgeObserved } from "../hooks/useFlows.ts";
import { useRuns, useTriggerRun } from "../hooks/useRuns.ts";
import { useUIStore } from "../stores/uiStore.ts";
import FlowCanvas from "../components/domain/FlowCanvas.tsx";
import FlowNodeComponent from "../components/domain/FlowNode.tsx";
import { flowToRFNodes, flowToRFEdges } from "../lib/layout.ts";
import { getStatusConfig } from "../config/statusConfig.ts";
import type { Flow, Run, Edge } from "@flowmap/shared";

const nodeTypes: NodeTypes = { flowNode: FlowNodeComponent };

type PanelTab = "info" | "runs" | "edge";

export default function FlowPage() {
  const { projectId, flowId } = useParams<{ projectId: string; flowId: string }>();
  const [tab, setTab] = useState<PanelTab>("info");

  const { data: flow, isLoading, error: flowError } = useFlow(flowId);
  const { data: runs = [] } = useRuns(flowId);
  const { mutate: setEdgeObserved, isPending: togglingEdge } = useSetEdgeObserved();
  const { mutate: triggerRun, isPending: triggering, error: triggerError } = useTriggerRun();

  const selectedEdgeId = useUIStore((s) => s.selectedEdgeId);
  const setSelectedEdge = useUIStore((s) => s.setSelectedEdge);
  const clearSelection = useUIStore((s) => s.clearSelection);

  const handleEdgeClick = useCallback(
    (edgeId: string) => {
      setSelectedEdge(edgeId === selectedEdgeId ? null : edgeId);
      setTab("edge");
    },
    [selectedEdgeId, setSelectedEdge]
  );

  const handleTrigger = useCallback(
    (mode: "ai" | "manual") => {
      if (!flowId) return;
      triggerRun({ flow_id: flowId, trigger_mode: mode });
      setTab("runs");
    },
    [flowId, triggerRun]
  );

  const handleToggleObserve = useCallback(
    (edge: Edge) => {
      if (!flowId) return;
      setEdgeObserved({ flowId, edgeId: edge.id, observed: !edge.observed });
    },
    [flowId, setEdgeObserved]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen gap-3 text-[#8b949e]">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-base">Loading flow…</span>
      </div>
    );
  }

  if (flowError || !flow) {
    return (
      <div className="flex items-center justify-center h-screen text-[#f85149] text-base">
        {String(flowError) || "Flow not found"}
      </div>
    );
  }

  const selectedFlowEdge = selectedEdgeId ? flow.edges.find((e) => e.id === selectedEdgeId) : null;
  const rfNodes = flowToRFNodes(flow);
  const rfEdges = flowToRFEdges(flow);

  const activeTab: PanelTab = tab === "edge" && !selectedFlowEdge ? "info" : tab;

  return (
    <div className="flex flex-col h-screen bg-[#0d1117]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3.5 border-b border-[#21262d] shrink-0 bg-[#161b22]">
        <div className="flex items-center gap-2 text-[15px]">
          <Link to="/projects" className="text-[#8b949e] hover:text-[#e6edf3] transition-colors">Projects</Link>
          <span className="text-[#444c56]">/</span>
          <Link to={`/projects/${projectId}`} className="text-[#8b949e] hover:text-[#e6edf3] transition-colors">Project</Link>
          <span className="text-[#444c56]">/</span>
          <span className="text-[#e6edf3] font-medium">{flow.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {triggerError && (
            <span className="text-[#f85149] text-sm">{(triggerError as Error).message}</span>
          )}
          <ConfidencePill confidence={flow.meta.confidence} />
          <TriggerBadge trigger={flow.trigger} />
        </div>
      </header>

      {/* Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 h-full">
          <FlowCanvas
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            persistKey={flowId}
            onEdgeClick={handleEdgeClick}
            onPaneClick={() => { clearSelection(); }}
          />
        </div>

        {/* Side panel */}
        <aside className="w-80 border-l border-[#21262d] bg-[#161b22] flex flex-col shrink-0">
          {/* Panel tabs */}
          <div className="flex border-b border-[#21262d] shrink-0">
            {(["info", "runs", "edge"] as PanelTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                disabled={t === "edge" && !selectedFlowEdge}
                className={`flex-1 py-3 text-[13px] font-medium capitalize transition-colors border-b-2 -mb-px disabled:opacity-30 disabled:cursor-not-allowed ${
                  activeTab === t
                    ? "border-[#7c3aed] text-[#e6edf3]"
                    : "border-transparent text-[#8b949e] hover:text-[#e6edf3]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === "info" && <InfoPanel flow={flow} onTrigger={handleTrigger} triggering={triggering} />}
            {activeTab === "runs" && <RunsPanel runs={runs} onTrigger={handleTrigger} triggering={triggering} />}
            {activeTab === "edge" && selectedFlowEdge && (
              <EdgePanel
                edge={selectedFlowEdge}
                onToggle={() => handleToggleObserve(selectedFlowEdge)}
                toggling={togglingEdge}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ── Info Panel ─────────────────────────────────── */
function InfoPanel({ flow, onTrigger, triggering }: { flow: Flow; onTrigger: (m: "ai" | "manual") => void; triggering: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      {/* Trigger actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onTrigger("manual")}
          disabled={triggering}
          className="flex-1 flex items-center justify-center gap-2 bg-[#21262d] hover:bg-[#2d333b] text-[#e6edf3] text-[14px] font-medium py-2.5 rounded-xl border border-[#30363d] transition-colors disabled:opacity-40"
        >
          <Hand size={14} />
          Manual
        </button>
        <button
          onClick={() => onTrigger("ai")}
          disabled={triggering}
          className="flex-1 flex items-center justify-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[14px] font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-40"
        >
          {triggering ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          AI Run
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatBox label="Nodes" value={String(flow.nodes.length)} />
        <StatBox label="Edges" value={String(flow.edges.length)} />
        <StatBox label="Confidence" value={`${Math.round(flow.meta.confidence * 100)}%`} />
        <StatBox label="Source" value={flow.meta.source === "auto_scan" ? "Auto" : "User"} />
      </div>

      {/* Trigger info */}
      <div className="bg-[#21262d] rounded-xl p-4 border border-[#30363d]">
        <p className="text-[13px] text-[#8b949e] mb-2 font-medium uppercase tracking-wider">Trigger</p>
        {flow.trigger.type === "queue" && (
          <div>
            <p className="text-[#e6edf3] text-[14px] font-medium">Queue</p>
            <p className="font-mono text-[13px] text-[#58a6ff] mt-0.5">{flow.trigger.queue_name}</p>
          </div>
        )}
        {flow.trigger.type === "webhook" && (
          <div>
            <p className="text-[#e6edf3] text-[14px] font-medium">Webhook</p>
            <p className="font-mono text-[13px] text-[#58a6ff] mt-0.5">{flow.trigger.method} {flow.trigger.path}</p>
          </div>
        )}
        {flow.trigger.type === "manual" && (
          <p className="text-[#e6edf3] text-[14px] font-medium">Manual</p>
        )}
      </div>

      {/* Tags */}
      {flow.meta.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {flow.meta.tags.map((t) => (
            <span key={t} className="text-[13px] bg-[#2d1b69] text-[#c4b5fd] px-3 py-1 rounded-full">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      {flow.description && (
        <div className="bg-[#21262d] rounded-xl p-4 border border-[#30363d]">
          <p className="text-[13px] text-[#8b949e] mb-1.5 font-medium uppercase tracking-wider">Description</p>
          <p className="text-[14px] text-[#e6edf3] leading-relaxed">{flow.description}</p>
        </div>
      )}
    </div>
  );
}

/* ── Runs Panel ─────────────────────────────────── */
function RunsPanel({ runs, onTrigger, triggering }: { runs: Run[]; onTrigger: (m: "ai" | "manual") => void; triggering: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <button
          onClick={() => onTrigger("manual")}
          disabled={triggering}
          className="flex-1 flex items-center justify-center gap-2 bg-[#21262d] hover:bg-[#2d333b] text-[#e6edf3] text-[14px] font-medium py-2.5 rounded-xl border border-[#30363d] transition-colors disabled:opacity-40"
        >
          <Hand size={14} />
          Manual
        </button>
        <button
          onClick={() => onTrigger("ai")}
          disabled={triggering}
          className="flex-1 flex items-center justify-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[14px] font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-40"
        >
          {triggering ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          AI Run
        </button>
      </div>

      {!runs.length ? (
        <div className="flex flex-col items-center justify-center py-10 text-[#6e7681] text-[14px] gap-2">
          <Clock size={28} className="text-[#30363d]" />
          <p>No runs yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {runs.slice(0, 20).map((r) => <RunCard key={r.id} run={r} />)}
        </div>
      )}
    </div>
  );
}

function RunCard({ run }: { run: Run }) {
  const cfg = getStatusConfig(run.status);
  const Icon = cfg.icon;
  const elapsed = run.completed_at
    ? `${((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1)}s`
    : null;

  return (
    <div
      style={{ borderLeftColor: cfg.color }}
      className="bg-[#21262d] rounded-xl p-3.5 border border-[#30363d] border-l-4 flex items-start gap-3"
    >
      <Icon
        size={15}
        style={{ color: cfg.color, marginTop: 2 }}
        className={run.status === "running" ? "animate-spin" : undefined}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px] text-[#e6edf3] font-medium capitalize">{run.trigger_mode}</span>
          <span className="text-[12px] text-[#6e7681]">{elapsed ?? relativeTime(run.started_at)}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span style={{ color: cfg.color }} className="text-[12px] font-medium">{cfg.label}</span>
          <span className="text-[12px] text-[#6e7681]">{new Date(run.started_at).toLocaleTimeString()}</span>
        </div>
        {run.error && (
          <p className="text-[12px] text-[#f85149] mt-1 truncate" title={run.error}>{run.error}</p>
        )}
      </div>
    </div>
  );
}

/* ── Edge Panel ─────────────────────────────────── */
function EdgePanel({ edge, onToggle, toggling }: { edge: Edge; onToggle: () => void; toggling: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      {/* From → To */}
      <div className="bg-[#21262d] rounded-xl p-4 border border-[#30363d]">
        <p className="text-[13px] text-[#8b949e] mb-2 font-medium uppercase tracking-wider">Connection</p>
        <div className="flex items-center gap-2 font-mono text-[13px]">
          <span className="text-[#e6edf3] bg-[#30363d] px-2 py-1 rounded-lg truncate">{edge.from}</span>
          <span className="text-[#444c56] shrink-0">→</span>
          <span className="text-[#e6edf3] bg-[#30363d] px-2 py-1 rounded-lg truncate">{edge.to}</span>
        </div>
      </div>

      {/* Data type */}
      <div className="bg-[#21262d] rounded-xl p-4 border border-[#30363d]">
        <p className="text-[13px] text-[#8b949e] mb-2 font-medium uppercase tracking-wider">Data Type</p>
        <code className="font-mono text-[14px] text-[#58a6ff]">{edge.data_type}</code>
      </div>

      {/* Key fields */}
      {edge.key_fields.length > 0 && (
        <div className="bg-[#21262d] rounded-xl p-4 border border-[#30363d]">
          <p className="text-[13px] text-[#8b949e] mb-3 font-medium uppercase tracking-wider">Key Fields</p>
          <div className="flex flex-col gap-1.5">
            {edge.key_fields.map((f) => (
              <code key={f} className="font-mono text-[13px] text-[#e6edf3] bg-[#161b22] px-2.5 py-1.5 rounded-lg">
                {f}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Observe toggle */}
      <button
        onClick={onToggle}
        disabled={toggling}
        style={edge.observed ? { background: "#2d1b69", borderColor: "#7c3aed" } : {}}
        className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border border-[#30363d] bg-[#21262d] text-[14px] font-semibold transition-all disabled:opacity-40"
      >
        {toggling ? (
          <Loader2 size={15} className="animate-spin" />
        ) : edge.observed ? (
          <Eye size={15} style={{ color: "#c4b5fd" }} />
        ) : (
          <EyeOff size={15} className="text-[#8b949e]" />
        )}
        <span style={edge.observed ? { color: "#c4b5fd" } : { color: "#e6edf3" }}>
          {edge.observed ? "Watching this edge" : "Watch this edge"}
        </span>
      </button>

      {/* Snapshot */}
      {edge.snapshot && (
        <div className="bg-[#21262d] rounded-xl p-4 border border-[#30363d]">
          <p className="text-[13px] text-[#8b949e] mb-3 font-medium uppercase tracking-wider">Last Snapshot</p>
          <pre className="font-mono text-[12px] text-[#58a6ff] bg-[#0d1117] p-3 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {JSON.stringify(edge.snapshot.values, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ── Small components ───────────────────────────── */
function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#21262d] rounded-xl p-4 border border-[#30363d]">
      <p className="text-[12px] text-[#8b949e] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[22px] font-bold text-[#e6edf3] leading-none">{value}</p>
    </div>
  );
}

function ConfidencePill({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? "#3fb950" : pct >= 50 ? "#d29922" : "#f85149";
  return (
    <span style={{ color, borderColor: `${color}33`, background: `${color}15` }}
      className="text-[13px] font-semibold px-2.5 py-1 rounded-full border">
      {pct}% confidence
    </span>
  );
}

function TriggerBadge({ trigger }: { trigger: Flow["trigger"] }) {
  const label =
    trigger.type === "queue" ? trigger.queue_name
    : trigger.type === "webhook" ? `${trigger.method} ${trigger.path}`
    : "Manual";
  return (
    <span className="font-mono text-[12px] bg-[#21262d] text-[#58a6ff] px-3 py-1.5 rounded-lg border border-[#30363d]">
      {label}
    </span>
  );
}

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}
