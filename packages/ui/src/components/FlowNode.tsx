import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Node } from "@flowmap/shared";

const NODE_TYPE_COLORS: Record<string, string> = {
  queue_consumer: "#7c3aed",
  guard:          "#b45309",
  aggregator:     "#0369a1",
  llm_call:       "#065f46",
  transform:      "#374151",
  queue_producer: "#7c3aed",
  external_api:   "#9f1239",
};

const NODE_TYPE_ICONS: Record<string, string> = {
  queue_consumer: "⬇",
  guard:          "🛡",
  aggregator:     "⚙",
  llm_call:       "✦",
  transform:      "⇄",
  queue_producer: "⬆",
  external_api:   "↗",
};

export default function FlowNode({ data }: NodeProps) {
  const node = (data as { node: Node }).node;
  const color = NODE_TYPE_COLORS[node.type] ?? "#333";
  const icon = NODE_TYPE_ICONS[node.type] ?? "•";

  return (
    <div style={{ ...styles.card, borderColor: color }}>
      <Handle type="target" position={Position.Top} style={styles.handle} />

      <div style={styles.typeRow}>
        <span style={{ ...styles.typeBadge, background: color }}>{icon} {node.type}</span>
      </div>

      <div style={styles.label}>{node.label}</div>
      <div style={styles.fn}>{node.function}</div>
      <div style={styles.file}>{node.file}</div>

      {node.db_ops.length > 0 && (
        <div style={styles.dbOps}>
          {node.db_ops.map((op, i) => (
            <span key={i} style={styles.dbBadge}>
              {op.operation[0].toUpperCase()} {op.table}
            </span>
          ))}
        </div>
      )}

      {node.calls_external && <div style={styles.external}>↗ external API</div>}

      <Handle type="source" position={Position.Bottom} style={styles.handle} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "#1a1a1a",
    border: "1.5px solid",
    borderRadius: 10,
    padding: "12px 14px",
    minWidth: 220,
    maxWidth: 240,
    fontSize: 12,
  },
  typeRow: { marginBottom: 6 },
  typeBadge: { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, color: "#fff", letterSpacing: 0.5 },
  label: { fontWeight: 600, fontSize: 13, color: "#e5e5e5", marginBottom: 2, lineHeight: 1.3 },
  fn: { fontFamily: "monospace", fontSize: 11, color: "#60a5fa", marginBottom: 2 },
  file: { fontSize: 10, color: "#555", fontFamily: "monospace", marginBottom: 6 },
  dbOps: { display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 },
  dbBadge: { background: "#0f2027", color: "#67e8f9", fontSize: 10, padding: "1px 5px", borderRadius: 3, fontFamily: "monospace" },
  external: { fontSize: 10, color: "#f87171", marginTop: 4 },
  handle: { background: "#555", width: 8, height: 8 },
};
