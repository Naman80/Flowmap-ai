export interface LayoutConfig {
  /** dagre rankdir */
  direction: "TB" | "LR" | "BT" | "RL";
  rankSep: number;
  nodeSep: number;
  /** Default node dimensions used by dagre */
  nodeWidth: number;
  nodeHeight: number;
}

export const DEFAULT_LAYOUT: LayoutConfig = {
  direction: "TB",
  rankSep: 80,
  nodeSep: 60,
  nodeWidth: 240,
  nodeHeight: 120,
};
