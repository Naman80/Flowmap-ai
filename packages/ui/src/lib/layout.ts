import dagre from "dagre";
import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";
import type { Flow, FlowGraph } from "@flowmap/shared";
import { DEFAULT_LAYOUT, type LayoutConfig } from "../config/layoutConfig.ts";

export function applyDagreLayout(
  nodes: RFNode[],
  edges: RFEdge[],
  config: LayoutConfig = DEFAULT_LAYOUT
): RFNode[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: config.direction,
    ranksep: config.rankSep,
    nodesep: config.nodeSep,
  });

  for (const node of nodes) {
    g.setNode(node.id, { width: config.nodeWidth, height: config.nodeHeight });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const { x, y } = g.node(node.id);
    return {
      ...node,
      position: {
        x: x - config.nodeWidth / 2,
        y: y - config.nodeHeight / 2,
      },
    };
  });
}

export function flowToRFNodes(flow: Flow): RFNode[] {
  return flow.nodes.map((n) => ({
    id: n.id,
    type: "flowNode",
    position: { x: 0, y: 0 },
    data: { node: n },
  }));
}

export function flowToRFEdges(flow: Flow): RFEdge[] {
  return flow.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    label: e.data_type,
    style: {
      stroke: e.observed ? "#60a5fa" : "#333",
      strokeWidth: e.observed ? 2 : 1,
    },
    labelStyle: { fill: "#555", fontSize: 10 },
    animated: e.observed,
  }));
}

export function flowGraphToRFNodes(graph: FlowGraph): RFNode[] {
  return graph.flows.map((f) => ({
    id: f.flow_id,
    type: "graphNode",
    position: { x: 0, y: 0 },
    data: { summary: f },
  }));
}

function connectionMechanismLabel(via: FlowGraph["connections"][number]["via"]): string {
  if (via.type === "queue") return `queue: ${via.queue_name}`;
  if (via.type === "webhook") return `webhook: ${via.event}`;
  if (via.type === "event") return via.event_name;
  return "direct";
}

export function flowGraphToRFEdges(graph: FlowGraph): RFEdge[] {
  return graph.connections.map((c) => ({
    id: c.id,
    source: c.from_flow,
    target: c.to_flow,
    label: connectionMechanismLabel(c.via),
    style: { stroke: "#444", strokeWidth: 1 },
    labelStyle: { fill: "#555", fontSize: 10 },
  }));
}
