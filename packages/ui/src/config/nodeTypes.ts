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
  color: string;
  bgColor: string;
  textColor: string;
  description: string;
}

export const NODE_TYPE_CONFIG: Record<string, NodeTypeConfig> = {
  queue_consumer: {
    label: "Queue Consumer",
    icon: ArrowDownToLine,
    color: "#7c3aed",
    bgColor: "#2d1b69",
    textColor: "#c4b5fd",
    description: "Reads messages from a queue",
  },
  queue_producer: {
    label: "Queue Producer",
    icon: ArrowUpFromLine,
    color: "#7c3aed",
    bgColor: "#2d1b69",
    textColor: "#c4b5fd",
    description: "Publishes messages to a queue",
  },
  guard: {
    label: "Guard",
    icon: Shield,
    color: "#d29922",
    bgColor: "#271e05",
    textColor: "#fcd34d",
    description: "Validation or auth gate",
  },
  aggregator: {
    label: "Aggregator",
    icon: Cpu,
    color: "#58a6ff",
    bgColor: "#0d2137",
    textColor: "#93c5fd",
    description: "Combines multiple data inputs",
  },
  llm_call: {
    label: "LLM Call",
    icon: Sparkles,
    color: "#3fb950",
    bgColor: "#0d2a18",
    textColor: "#86efac",
    description: "AI model invocation",
  },
  transform: {
    label: "Transform",
    icon: ArrowRightLeft,
    color: "#8b949e",
    bgColor: "#21262d",
    textColor: "#d1d5db",
    description: "Data transformation step",
  },
  external_api: {
    label: "External API",
    icon: ExternalLink,
    color: "#f85149",
    bgColor: "#2a0d0d",
    textColor: "#fca5a5",
    description: "Outbound HTTP call",
  },
};

export const DEFAULT_NODE_TYPE_CONFIG: NodeTypeConfig = {
  label: "Node",
  icon: Cpu,
  color: "#8b949e",
  bgColor: "#21262d",
  textColor: "#d1d5db",
  description: "",
};

export function getNodeTypeConfig(type: string): NodeTypeConfig {
  return NODE_TYPE_CONFIG[type] ?? DEFAULT_NODE_TYPE_CONFIG;
}
