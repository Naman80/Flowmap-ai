import type { Edge } from "@flowmap/shared";
import { Eye, EyeOff, Loader2 } from "lucide-react";

interface EdgePanelProps {
  edge: Edge;
  onToggleObserve: () => void;
  isToggling?: boolean;
}

export default function EdgePanel({ edge, onToggleObserve, isToggling }: EdgePanelProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[#e5e5e5] mb-1">Edge</h3>
      <p className="font-mono text-[11px] text-[#555] mb-5">
        {edge.from} → {edge.to}
      </p>

      <Row label="Type">
        <code className="font-mono text-[11px] text-[#67e8f9] bg-[#0f2027] px-1.5 py-0.5 rounded">
          {edge.data_type}
        </code>
      </Row>

      <Row label="Key fields">
        <div className="flex flex-col gap-1">
          {edge.key_fields.map((f) => (
            <code key={f} className="font-mono text-[11px] text-[#67e8f9] bg-[#0f2027] px-1.5 py-0.5 rounded inline-block w-fit">
              {f}
            </code>
          ))}
        </div>
      </Row>

      <Row label="Observe">
        <button
          onClick={onToggleObserve}
          disabled={isToggling}
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors ${
            edge.observed
              ? "bg-[#1e3a5f] text-[#60a5fa] hover:bg-[#1e4070]"
              : "bg-[#1a1a1a] text-[#555] border border-[#333] hover:text-[#888]"
          }`}
        >
          {isToggling ? (
            <Loader2 size={11} className="animate-spin" />
          ) : edge.observed ? (
            <Eye size={11} />
          ) : (
            <EyeOff size={11} />
          )}
          {edge.observed ? "Watching" : "Watch"}
        </button>
      </Row>

      {edge.snapshot && (
        <div className="mt-5">
          <p className="text-[11px] text-[#555] mb-2">Last snapshot</p>
          <pre className="font-mono text-[10px] text-[#a5f3fc] bg-[#0a1520] p-3 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {JSON.stringify(edge.snapshot.values, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-3 mb-4 text-xs">
      <span className="text-[#555] shrink-0 pt-0.5">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}
