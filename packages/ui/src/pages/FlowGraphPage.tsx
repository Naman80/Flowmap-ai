import { useParams, Link, useNavigate } from "react-router-dom";
import { Wand2, Loader2, AlertCircle } from "lucide-react";
import type { NodeTypes } from "@xyflow/react";
import { useFlowGraph, useBuildFlowGraph } from "../hooks/useFlows.ts";
import FlowCanvas from "../components/domain/FlowCanvas.tsx";
import GraphNodeComponent from "../components/domain/GraphNode.tsx";
import { flowGraphToRFNodes, flowGraphToRFEdges } from "../lib/layout.ts";

const nodeTypes: NodeTypes = { graphNode: GraphNodeComponent };

export default function FlowGraphPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const { data: graph, isLoading, error } = useFlowGraph(projectId);
  const { mutate: buildGraph, isPending: building, error: buildError } = useBuildFlowGraph();

  const rfNodes = graph ? flowGraphToRFNodes(graph) : [];
  const rfEdges = graph ? flowGraphToRFEdges(graph) : [];

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a] shrink-0">
        <div className="flex items-center gap-2 text-xs text-[#555]">
          <Link to="/projects" className="hover:text-[#888] transition-colors">Projects</Link>
          <span>/</span>
          <Link to={`/projects/${projectId}`} className="hover:text-[#888] transition-colors">Project</Link>
          <span>/</span>
          <span className="text-[#888]">Flow Graph</span>
        </div>
        <button
          onClick={() => buildGraph(projectId!, { onSuccess: (g) => console.log("built", g) })}
          disabled={building}
          className="flex items-center gap-1.5 text-xs font-semibold bg-white text-black px-3 py-1.5 rounded-lg disabled:opacity-40"
        >
          {building ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
          {building ? "Building…" : "Build graph"}
        </button>
      </header>

      {/* Canvas area */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-[#555] text-sm gap-2 z-10">
            <Loader2 size={14} className="animate-spin" />
            Loading…
          </div>
        )}

        {(error || buildError) && !graph && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-8">
            <AlertCircle size={32} className="text-[#333]" />
            <p className="text-[#666] text-sm">No flow graph yet.</p>
            <p className="text-[#444] text-xs">Build flows first, then click "Build graph" above.</p>
          </div>
        )}

        {graph && rfNodes.length > 0 && (
          <FlowCanvas
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodeClick={(id) => {
              const flow = graph.flows.find((f) => f.flow_id === id);
              if (flow) navigate(`/projects/${projectId}/flows/${flow.flow_id}`);
            }}
            layoutConfig={{ direction: "LR", rankSep: 100, nodeSep: 60, nodeWidth: 220, nodeHeight: 100 }}
          />
        )}
      </div>

      {/* Footer stats */}
      {graph && (
        <div className="px-5 py-2 border-t border-[#1a1a1a] flex items-center gap-6 text-[11px] text-[#444] shrink-0">
          <span>{graph.flows.length} flows</span>
          <span>{graph.connections.length} connections</span>
          <span className="ml-auto">{graph.name}</span>
        </div>
      )}
    </div>
  );
}
