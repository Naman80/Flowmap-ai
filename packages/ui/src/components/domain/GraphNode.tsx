import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowSummary } from "@flowmap/shared";
import { GitBranch } from "lucide-react";

export default function GraphNode({ data, selected }: NodeProps) {
  const summary = (data as { summary: FlowSummary }).summary;

  const triggerLabel =
    summary.trigger.type === "queue" ? `queue: ${summary.trigger.queue_name}`
    : summary.trigger.type === "webhook" ? `${summary.trigger.method} ${summary.trigger.path}`
    : "manual";

  return (
    <div
      style={{
        borderColor: selected ? "#7c3aed" : "#30363d",
        boxShadow: selected ? "0 0 0 2px #7c3aed33" : "0 4px 20px rgba(0,0,0,0.4)",
      }}
      className="rounded-2xl border-2 bg-[#161b22] min-w-[220px] max-w-[260px] overflow-hidden select-none"
    >
      <Handle type="target" position={Position.Left} className="!bg-[#444c56] !w-3 !h-3 !border-2 !border-[#161b22]" />

      <div className="bg-[#2d1b69] border-b-2 border-[#7c3aed] px-4 py-3 flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-[#7c3aed] flex items-center justify-center shrink-0">
          <GitBranch size={12} color="#fff" strokeWidth={2.5} />
        </div>
        <span className="text-[11px] font-bold text-[#c4b5fd] uppercase tracking-widest">Flow</span>
      </div>

      <div className="px-4 py-3">
        <div className="font-semibold text-[14px] text-[#e6edf3] leading-snug mb-1">{summary.name}</div>
        <div className="font-mono text-[11px] text-[#6e7681] truncate" title={triggerLabel}>{triggerLabel}</div>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-[#444c56] !w-3 !h-3 !border-2 !border-[#161b22]" />
    </div>
  );
}
