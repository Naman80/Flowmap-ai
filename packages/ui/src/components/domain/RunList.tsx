import type { Run } from "@flowmap/shared";
import { getStatusConfig } from "../../config/statusConfig.ts";
import { Loader2 } from "lucide-react";

interface RunListProps {
  runs: Run[];
  onTrigger: (mode: "ai" | "manual") => void;
  isTriggering?: boolean;
  limit?: number;
}

export default function RunList({ runs, onTrigger, isTriggering, limit = 8 }: RunListProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-[#e5e5e5] flex-1">Runs</h3>
        <button
          onClick={() => onTrigger("manual")}
          disabled={isTriggering}
          className="text-xs font-medium bg-[#111] border border-[#222] hover:border-[#333] text-[#aaa] px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40"
        >
          Manual
        </button>
        <button
          onClick={() => onTrigger("ai")}
          disabled={isTriggering}
          className="flex items-center gap-1 text-xs font-semibold bg-white text-black px-2.5 py-1.5 rounded-lg disabled:opacity-40"
        >
          {isTriggering ? <Loader2 size={11} className="animate-spin" /> : null}
          AI trigger
        </button>
      </div>

      {!runs.length ? (
        <p className="text-[#444] text-xs">No runs yet.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {runs.slice(0, limit).map((r) => (
            <RunRow key={r.id} run={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function RunRow({ run }: { run: Run }) {
  const cfg = getStatusConfig(run.status);
  const Icon = cfg.icon;

  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-[#161616] last:border-0">
      <Icon
        size={12}
        style={{ color: cfg.color }}
        className={run.status === "running" ? "animate-spin" : undefined}
      />
      <span className="text-[11px] text-[#888] capitalize">{run.trigger_mode}</span>
      <span className="text-[10px] text-[#444] ml-auto">
        {new Date(run.started_at).toLocaleTimeString()}
      </span>
      {run.error && (
        <span className="text-[10px] text-[#f87171] truncate max-w-[80px]" title={run.error}>
          {run.error}
        </span>
      )}
    </div>
  );
}
