import { useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import type { NodeTypes } from "@xyflow/react";
import { useFlow, useSetEdgeObserved } from "../hooks/useFlows.ts";
import { useRuns, useTriggerRun } from "../hooks/useRuns.ts";
import { useUIStore } from "../stores/uiStore.ts";
import FlowCanvas from "../components/domain/FlowCanvas.tsx";
import FlowNodeComponent from "../components/domain/FlowNode.tsx";
import EdgePanel from "../components/domain/EdgePanel.tsx";
import RunList from "../components/domain/RunList.tsx";
import { flowToRFNodes, flowToRFEdges } from "../lib/layout.ts";

const nodeTypes: NodeTypes = { flowNode: FlowNodeComponent };

export default function FlowPage() {
  const { projectId, flowId } = useParams<{ projectId: string; flowId: string }>();

  const { data: flow, isLoading, error: flowError } = useFlow(flowId);
  const { data: runs = [] } = useRuns(flowId);
  const { mutate: setEdgeObserved, isPending: togglingEdge } = useSetEdgeObserved();
  const { mutate: triggerRun, isPending: triggering, error: triggerError } = useTriggerRun();

  const selectedEdgeId = useUIStore((s) => s.selectedEdgeId);
  const setSelectedEdge = useUIStore((s) => s.setSelectedEdge);
  const clearSelection = useUIStore((s) => s.clearSelection);

  const handleEdgeClick = useCallback(
    (edgeId: string) => setSelectedEdge(edgeId === selectedEdgeId ? null : edgeId),
    [selectedEdgeId, setSelectedEdge]
  );

  const handleTrigger = useCallback(
    (mode: "ai" | "manual") => {
      if (!flowId) return;
      triggerRun({ flow_id: flowId, trigger_mode: mode });
    },
    [flowId, triggerRun]
  );

  const handleToggleObserve = useCallback(() => {
    if (!flowId || !selectedEdgeId) return;
    const edge = flow?.edges.find((e) => e.id === selectedEdgeId);
    if (!edge) return;
    setEdgeObserved({ flowId, edgeId: selectedEdgeId, observed: !edge.observed });
  }, [flowId, selectedEdgeId, flow, setEdgeObserved]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-12 text-[#555] text-sm">
        <Loader2 size={14} className="animate-spin" />
        Loading flow…
      </div>
    );
  }

  if (flowError || !flow) {
    return <div className="p-12 text-[#f87171] text-sm">{String(flowError) || "Flow not found"}</div>;
  }

  const selectedFlowEdge = selectedEdgeId ? flow.edges.find((e) => e.id === selectedEdgeId) : null;
  const rfNodes = flowToRFNodes(flow);
  const rfEdges = flowToRFEdges(flow);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a] shrink-0">
        <div className="flex items-center gap-2 text-xs text-[#555]">
          <Link to="/projects" className="hover:text-[#888] transition-colors">Projects</Link>
          <span>/</span>
          <Link to={`/projects/${projectId}`} className="hover:text-[#888] transition-colors">Project</Link>
          <span>/</span>
          <span className="text-[#888]">{flow.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {(triggerError) && (
            <span className="text-[#f87171] text-xs">{(triggerError as Error).message}</span>
          )}
          <span className="text-[11px] text-[#444]">
            {flow.nodes.length}n · {flow.edges.length}e · {Math.round(flow.meta.confidence * 100)}%
          </span>
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
            onEdgeClick={handleEdgeClick}
            onPaneClick={clearSelection}
          />
        </div>

        {/* Side panel */}
        <aside className="w-72 border-l border-[#1a1a1a] p-5 overflow-y-auto shrink-0 flex flex-col gap-6">
          {selectedFlowEdge ? (
            <EdgePanel
              edge={selectedFlowEdge}
              onToggleObserve={handleToggleObserve}
              isToggling={togglingEdge}
            />
          ) : (
            <FlowInfo flow={flow} />
          )}

          <div className="border-t border-[#1a1a1a] pt-5">
            <RunList
              runs={runs}
              onTrigger={handleTrigger}
              isTriggering={triggering}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function FlowInfo({ flow }: { flow: import("@flowmap/shared").Flow }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[#e5e5e5] mb-4">Flow info</h3>
      <Row label="Nodes" value={String(flow.nodes.length)} />
      <Row label="Edges" value={String(flow.edges.length)} />
      <Row label="Confidence" value={`${Math.round(flow.meta.confidence * 100)}%`} />
      <Row label="Source" value={flow.meta.source} />
      {flow.trigger.type === "queue" && (
        <Row label="Queue" value={flow.trigger.queue_name ?? ""} mono />
      )}
      {flow.trigger.type === "webhook" && (
        <Row label="Webhook" value={`${flow.trigger.method} ${flow.trigger.path}`} mono />
      )}
      {flow.meta.tags.length > 0 && (
        <div className="flex justify-between items-start gap-3 mb-3 text-xs">
          <span className="text-[#555] shrink-0">Tags</span>
          <div className="flex flex-wrap gap-1 justify-end">
            {flow.meta.tags.map((t) => (
              <span key={t} className="text-[10px] bg-[#1a2a1a] text-[#86efac] px-2 py-0.5 rounded">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
      {flow.description && (
        <p className="text-[11px] text-[#555] leading-relaxed mt-3 border-t border-[#1a1a1a] pt-3">
          {flow.description}
        </p>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center gap-3 mb-3 text-xs">
      <span className="text-[#555]">{label}</span>
      <span className={`text-[#aaa] ${mono ? "font-mono text-[10px] text-[#67e8f9]" : ""}`}>
        {value}
      </span>
    </div>
  );
}
