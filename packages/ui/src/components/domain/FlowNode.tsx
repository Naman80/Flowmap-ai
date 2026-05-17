import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Node } from "@flowmap/shared";
import { getNodeTypeConfig } from "../../config/nodeTypes.ts";

export default function FlowNode({ data }: NodeProps) {
  const node = (data as { node: Node }).node;
  const cfg = getNodeTypeConfig(node.type);
  const Icon = cfg.icon;

  return (
    <div
      style={{ borderColor: cfg.color }}
      className="rounded-xl border bg-[#111] min-w-[220px] max-w-[240px] text-xs select-none"
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#333] !w-2 !h-2 !border-0"
      />

      {/* Type badge */}
      <div className="px-3 pt-3 pb-1">
        <span
          style={{ background: cfg.color }}
          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded text-white tracking-wide uppercase"
        >
          <Icon size={10} strokeWidth={2.5} />
          {node.type.replace(/_/g, " ")}
        </span>
      </div>

      {/* Label */}
      <div className="px-3 pb-1">
        <div className="font-semibold text-[13px] text-[#e5e5e5] leading-tight">{node.label}</div>
        <div className="font-mono text-[11px] text-[#60a5fa] mt-0.5">{node.function}</div>
        <div className="font-mono text-[10px] text-[#444] mt-0.5 truncate" title={node.file}>
          {node.file}
        </div>
      </div>

      {/* DB ops */}
      {node.db_ops.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {node.db_ops.map((op, i) => (
            <span
              key={i}
              className="font-mono text-[10px] bg-[#0f2027] text-[#67e8f9] px-1.5 py-0.5 rounded"
            >
              {op.operation[0].toUpperCase()} {op.table}
            </span>
          ))}
        </div>
      )}

      {/* External API indicator */}
      {node.calls_external && (
        <div className="px-3 pb-2 text-[10px] text-[#f87171]">↗ external API</div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[#333] !w-2 !h-2 !border-0"
      />
    </div>
  );
}
