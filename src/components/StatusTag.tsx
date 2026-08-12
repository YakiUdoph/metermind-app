import { Check, Ban, Route as RouteIcon, Clock } from "lucide-react";
import type { Decision } from "@/lib/mock";
import { cn } from "@/lib/utils";

const map = {
  APPROVED: { icon: Check, cls: "text-lime border-lime/35 bg-lime/8", label: "APPROVED" },
  BLOCKED: { icon: Ban, cls: "text-blocked border-blocked/35 bg-blocked/8", label: "BLOCKED" },
  ROUTED: { icon: RouteIcon, cls: "text-routed border-routed/30 bg-routed/8", label: "ROUTED" },
  PENDING: { icon: Clock, cls: "text-fog border-border bg-obsidian", label: "PENDING" },
} as const;

export function StatusTag({ decision, className }: { decision: Decision; className?: string }) {
  const { icon: Icon, cls, label } = map[decision];
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
