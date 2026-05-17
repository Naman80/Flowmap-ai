import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowSummary } from "@flowmap/shared";
import { GitBranch } from "lucide-react";

export default function GraphNode({ data }: NodeProps) {
  const summary = (data as { summary: FlowSummary }).summary;

  const triggerLabel =
    summary.trigger.type === "queue"
      ? `queue: ${summary.trigger.queue_name}`
      : summary.trigger.type === "webhook"
      ? `${summary.trigger.method} ${summary.trigger.path}`
      : summary.trigger.type;

  return (
    <div className="rounded-xl border border-[#333] bg-[#111] min-w-[180px] max-w-[220px] text-xs select-none">
      <Handle type="target" position={Position.Top} className="!bg-[#333] !w-2 !h-2 !border-0" />

      <div className="px-3 pt-3 pb-1">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-[#1e293b] text-[#60a5fa] uppercase tracking-wide">
          <GitBranch size={10} />
          flow
        </span>
      </div>

      <div className="px-3 pb-3">
        <div className="font-semibold text-[13px] text-[#e5e5e5] leading-tight">{summary.name}</div>
        <div className="font-mono text-[10px] text-[#555] mt-1.5 truncate" title={triggerLabel}>
          {triggerLabel}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-[#333] !w-2 !h-2 !border-0" />
    </div>
  );
}
