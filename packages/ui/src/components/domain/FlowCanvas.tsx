import { useEffect, useCallback, useRef } from "react";
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
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { applyDagreLayout } from "../../lib/layout.ts";
import type { LayoutConfig } from "../../config/layoutConfig.ts";

interface FlowCanvasProps {
  nodes: RFNode[];
  edges: RFEdge[];
  nodeTypes: NodeTypes;
  layoutConfig?: LayoutConfig;
  /** Key used to persist node positions in localStorage (e.g. the flow ID) */
  persistKey?: string;
  onEdgeClick?: (edgeId: string) => void;
  onNodeClick?: (nodeId: string) => void;
  onPaneClick?: () => void;
}

function loadPositions(key: string): Record<string, { x: number; y: number }> | null {
  try {
    const raw = localStorage.getItem(`flowmap:positions:${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePositions(key: string, nodes: RFNode[]) {
  const positions: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    positions[n.id] = n.position;
  }
  localStorage.setItem(`flowmap:positions:${key}`, JSON.stringify(positions));
}

export default function FlowCanvas({
  nodes: inputNodes,
  edges: inputEdges,
  nodeTypes,
  layoutConfig,
  persistKey,
  onEdgeClick,
  onNodeClick,
  onPaneClick,
}: FlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (!inputNodes.length) return;

    // Try to restore persisted positions
    const saved = persistKey ? loadPositions(persistKey) : null;

    let laid: RFNode[];
    if (saved && inputNodes.every((n) => saved[n.id])) {
      // All nodes have saved positions — restore them
      laid = inputNodes.map((n) => ({ ...n, position: saved[n.id] }));
    } else {
      // Run dagre layout
      laid = applyDagreLayout(inputNodes, inputEdges, layoutConfig);
      if (persistKey) savePositions(persistKey, laid);
    }

    setNodes(laid);
    setEdges(inputEdges);
    initialized.current = true;
  }, [inputNodes, inputEdges, layoutConfig, persistKey]);

  // Save positions whenever user drags nodes
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      const hasDrag = changes.some((c) => c.type === "position" && !c.dragging);
      if (hasDrag && persistKey) {
        // Read current nodes after change applied
        setNodes((current) => {
          savePositions(persistKey, current);
          return current;
        });
      }
    },
    [onNodesChange, persistKey, setNodes]
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: RFEdge) => onEdgeClick?.(edge.id),
    [onEdgeClick]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: RFNode) => onNodeClick?.(node.id),
    [onNodeClick]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      onEdgesChange={onEdgesChange}
      onEdgeClick={handleEdgeClick}
      onNodeClick={handleNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      colorMode="dark"
      style={{ background: "#0d1117" }}
    >
      <Background variant={BackgroundVariant.Dots} color="#21262d" gap={24} size={1.5} />
      <Controls />
      <MiniMap
        nodeColor={(n) => {
          const cfg = n.data as any;
          return cfg?.node ? "#21262d" : "#21262d";
        }}
        maskColor="rgba(13,17,23,0.85)"
        style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 10 }}
      />
    </ReactFlow>
  );
}
