import { useParams, Link, useNavigate } from "react-router-dom";
import { Wand2, Loader2, AlertCircle, ChevronRight } from "lucide-react";
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
    <div className="flex flex-col h-screen bg-[#0d1117]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3.5 border-b border-[#21262d] shrink-0 bg-[#161b22]">
        <div className="flex items-center gap-2 text-[14px]">
          <Link to="/projects" className="text-[#8b949e] hover:text-[#e6edf3] transition-colors">Projects</Link>
          <ChevronRight size={14} className="text-[#444c56]" />
          <Link to={`/projects/${projectId}`} className="text-[#8b949e] hover:text-[#e6edf3] transition-colors">Project</Link>
          <ChevronRight size={14} className="text-[#444c56]" />
          <span className="text-[#e6edf3] font-medium">Flow Graph</span>
        </div>
        <button
          onClick={() => buildGraph(projectId!)}
          disabled={building}
          className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[14px] font-semibold px-4 py-2 rounded-xl disabled:opacity-40 transition-colors"
        >
          {building ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          {building ? "Building…" : "Build graph"}
        </button>
      </header>

      {/* Canvas area */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-[#8b949e] text-[15px] gap-3 z-10">
            <Loader2 size={18} className="animate-spin" />
            Loading…
          </div>
        )}

        {(error || buildError) && !graph && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-8">
            <AlertCircle size={40} className="text-[#30363d]" />
            <div>
              <p className="text-[#8b949e] text-[16px] font-medium mb-1">No flow graph yet</p>
              <p className="text-[#6e7681] text-[14px]">Build flows first on the project page, then click "Build graph".</p>
            </div>
          </div>
        )}

        {graph && rfNodes.length > 0 && (
          <FlowCanvas
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            persistKey={`graph:${projectId}`}
            onNodeClick={(id) => {
              const flow = graph.flows.find((f) => f.flow_id === id);
              if (flow) navigate(`/projects/${projectId}/flows/${flow.flow_id}`);
            }}
            layoutConfig={{ direction: "LR", rankSep: 160, nodeSep: 80, nodeWidth: 260, nodeHeight: 110 }}
          />
        )}
      </div>

      {/* Footer */}
      {graph && (
        <div className="px-6 py-2.5 border-t border-[#21262d] bg-[#161b22] flex items-center gap-6 text-[13px] text-[#6e7681] shrink-0">
          <span className="text-[#8b949e] font-medium">{graph.name}</span>
          <span>{graph.flows.length} flows</span>
          <span>{graph.connections.length} connections</span>
        </div>
      )}
    </div>
  );
}
