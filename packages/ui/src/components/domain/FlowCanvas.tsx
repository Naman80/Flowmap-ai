import { useEffect, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { applyDagreLayout } from "../../lib/layout.ts";
import type { LayoutConfig } from "../../config/layoutConfig.ts";

interface FlowCanvasProps {
  nodes: RFNode[];
  edges: RFEdge[];
  nodeTypes: NodeTypes;
  layoutConfig?: LayoutConfig;
  onEdgeClick?: (edgeId: string) => void;
  onNodeClick?: (nodeId: string) => void;
  onPaneClick?: () => void;
}

export default function FlowCanvas({
  nodes: inputNodes,
  edges: inputEdges,
  nodeTypes,
  layoutConfig,
  onEdgeClick,
  onNodeClick,
  onPaneClick,
}: FlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>([]);

  useEffect(() => {
    if (!inputNodes.length) return;
    const laid = applyDagreLayout(inputNodes, inputEdges, layoutConfig);
    setNodes(laid);
    setEdges(inputEdges);
  }, [inputNodes, inputEdges, layoutConfig]);

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: RFEdge) => {
      onEdgeClick?.(edge.id);
    },
    [onEdgeClick]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: RFNode) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onEdgeClick={handleEdgeClick}
      onNodeClick={handleNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      fitView
      colorMode="dark"
    >
      <Background variant={BackgroundVariant.Dots} color="#1f1f1f" gap={20} />
      <Controls className="!bg-[#111] !border-[#222]" />
      <MiniMap nodeColor="#222" maskColor="rgba(0,0,0,0.8)" className="!bg-[#0a0a0a]" />
    </ReactFlow>
  );
}
