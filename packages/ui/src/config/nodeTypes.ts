import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Shield,
  Cpu,
  Sparkles,
  ArrowRightLeft,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";

export interface NodeTypeConfig {
  label: string;
  icon: LucideIcon;
  /** Hex color used for border + badge background */
  color: string;
  /** Darker bg for badge */
  dimColor: string;
  description: string;
}

export const NODE_TYPE_CONFIG: Record<string, NodeTypeConfig> = {
  queue_consumer: {
    label: "Queue Consumer",
    icon: ArrowDownToLine,
    color: "#7c3aed",
    dimColor: "#2e1065",
    description: "Reads messages from a queue",
  },
  queue_producer: {
    label: "Queue Producer",
    icon: ArrowUpFromLine,
    color: "#7c3aed",
    dimColor: "#2e1065",
    description: "Publishes messages to a queue",
  },
  guard: {
    label: "Guard",
    icon: Shield,
    color: "#b45309",
    dimColor: "#431407",
    description: "Validation or auth gate",
  },
  aggregator: {
    label: "Aggregator",
    icon: Cpu,
    color: "#0369a1",
    dimColor: "#082f49",
    description: "Combines multiple data inputs",
  },
  llm_call: {
    label: "LLM Call",
    icon: Sparkles,
    color: "#059669",
    dimColor: "#022c22",
    description: "AI model invocation",
  },
  transform: {
    label: "Transform",
    icon: ArrowRightLeft,
    color: "#4b5563",
    dimColor: "#111827",
    description: "Data transformation step",
  },
  external_api: {
    label: "External API",
    icon: ExternalLink,
    color: "#be123c",
    dimColor: "#4c0519",
    description: "Outbound HTTP call",
  },
};

export const DEFAULT_NODE_TYPE_CONFIG: NodeTypeConfig = {
  label: "Node",
  icon: Cpu,
  color: "#4b5563",
  dimColor: "#111827",
  description: "",
};

export function getNodeTypeConfig(type: string): NodeTypeConfig {
  return NODE_TYPE_CONFIG[type] ?? DEFAULT_NODE_TYPE_CONFIG;
}
