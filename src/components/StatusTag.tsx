import { Check, Ban, Loader, Sparkles } from "lucide-react";
import type { ProcurementStatus } from "@/lib/mock";
import { cn } from "@/lib/utils";

const map = {
  COMPLETE: { icon: Check, cls: "text-lime border-lime/35 bg-lime/8", label: "COMPLETE" },
  EXECUTING: { icon: Loader, cls: "text-routed border-routed/30 bg-routed/8", label: "EXECUTING" },
  SELECTED: { icon: Sparkles, cls: "text-fog border-border bg-obsidian", label: "SELECTED" },
  BLOCKED: { icon: Ban, cls: "text-blocked border-blocked/35 bg-blocked/8", label: "HELD" },
} as const;

export function StatusTag({
  status,
  className,
}: {
  status: ProcurementStatus;
  className?: string;
}) {
  const { icon: Icon, cls, label } = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em]",
        cls,
        className,
      )}
    >
      <Icon size={10} strokeWidth={2.5} aria-hidden="true" />
      {label}
    </span>
  );
}
