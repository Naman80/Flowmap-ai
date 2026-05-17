export interface LayoutConfig {
  direction: "TB" | "LR" | "BT" | "RL";
  rankSep: number;
  nodeSep: number;
  nodeWidth: number;
  nodeHeight: number;
}

export const DEFAULT_LAYOUT: LayoutConfig = {
  direction: "LR",
  rankSep: 140,
  nodeSep: 100,
  nodeWidth: 340,
  nodeHeight: 160,
};
