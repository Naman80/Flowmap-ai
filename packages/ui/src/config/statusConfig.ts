import { CheckCircle, XCircle, Loader2, Clock, type LucideIcon } from "lucide-react";
import type { Run } from "@flowmap/shared";

export interface StatusConfig {
  label: string;
  color: string;
  icon: LucideIcon;
}

export const STATUS_CONFIG: Record<Run["status"], StatusConfig> = {
  completed: { label: "Completed", color: "#4ade80", icon: CheckCircle },
  failed:    { label: "Failed",    color: "#f87171", icon: XCircle },
  running:   { label: "Running",   color: "#60a5fa", icon: Loader2 },
  pending:   { label: "Pending",   color: "#6b7280", icon: Clock },
};

export function getStatusConfig(status: Run["status"]): StatusConfig {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
}
