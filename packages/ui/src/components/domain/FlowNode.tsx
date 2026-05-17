import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Node } from "@flowmap/shared";
import { getNodeTypeConfig } from "../../config/nodeTypes.ts";
import { Database } from "lucide-react";

export default function FlowNode({ data, selected }: NodeProps) {
  const node = (data as { node: Node }).node;
  const cfg = getNodeTypeConfig(node.type);
  const Icon = cfg.icon;

  return (
    <div
      style={{
        borderColor: selected ? cfg.color : "#30363d",
        boxShadow: selected ? `0 0 0 2px ${cfg.color}33` : "0 4px 24px rgba(0,0,0,0.4)",
      }}
      className="rounded-2xl border-2 bg-[#161b22] min-w-[320px] max-w-[340px] overflow-hidden transition-all duration-150 select-none"
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-[#444c56] !w-3 !h-3 !border-2 !border-[#161b22]"
      />

      {/* Colored header strip */}
      <div
        style={{ background: cfg.bgColor, borderBottom: `2px solid ${cfg.color}` }}
        className="px-4 py-3 flex items-center gap-2.5"
      >
        <div
          style={{ background: cfg.color }}
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        >
          <Icon size={14} color="#fff" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <div style={{ color: cfg.textColor }} className="text-xs font-bold uppercase tracking-widest leading-none truncate">
            {node.type.replace(/_/g, " ")}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <div className="text-[#e6edf3] font-semibold text-[15px] leading-snug mb-1.5">
          {node.label}
        </div>
        <div className="font-mono text-[13px] text-[#58a6ff] mb-1 truncate" title={node.function}>
          {node.function}()
        </div>
        <div className="font-mono text-[12px] text-[#6e7681] truncate" title={node.file}>
          {node.file.split("/").slice(-2).join("/")}
        </div>
      </div>

      {/* DB ops */}
      {node.db_ops.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {node.db_ops.map((op, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 font-mono text-[12px] bg-[#0d2137] text-[#58a6ff] px-2 py-1 rounded-md"
            >
              <Database size={10} />
              <span className="font-semibold">{op.operation[0].toUpperCase()}</span>
              <span className="text-[#8b949e]">{op.table}</span>
            </span>
          ))}
        </div>
      )}

      {/* External API badge */}
      {node.calls_external && (
        <div className="px-4 pb-3">
          <span className="inline-flex items-center gap-1 text-[12px] bg-[#2a0d0d] text-[#f85149] px-2 py-1 rounded-md font-medium">
            ↗ External API
          </span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-[#444c56] !w-3 !h-3 !border-2 !border-[#161b22]"
      />
    </div>
  );
}
