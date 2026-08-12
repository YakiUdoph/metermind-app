import { useEffect } from "react";
import { X, Check } from "lucide-react";
import type { Procurement } from "@/lib/mock";
import { currency, WINNER } from "@/lib/mock";
import { StatusTag } from "./StatusTag";
import { cn } from "@/lib/utils";

export function ProcurementPanel({
  item,
  onClose,
}: {
  item: Procurement | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!item) return null;
  const saved = Math.max(0, item.comparable - item.paid);

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close procurement detail"
        onClick={onClose}
        className="absolute inset-0 bg-void/70 backdrop-blur-sm"
      />
      <aside
        role="dialog"
        aria-label={`Procurement ${item.id}`}
        className="animate-rise absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-border bg-carbon"
      >
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="eyebrow">Procurement</div>
            <h3 className="mono-num mt-1 truncate text-[16px] text-paper">#{item.id}</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-fog transition-colors hover:text-paper"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
            {[
              ["Agent", item.agent],
              ["Task", item.task],
              ["Provider selected", item.provider],
              ["Paid", currency(item.paid, 3)],
              ["Payment rail", item.rail],
              ["Time", item.time],
            ].map(([k, v]) => (
              <div key={k} className="bg-obsidian px-3 py-3">
                <dt className="eyebrow">{k}</dt>
                <dd className="mt-1.5 text-[13px] text-mist">{v}</dd>
              </div>
            ))}
          </dl>

          <div>
            <div className="eyebrow">Status</div>
            <div className="mt-2">
              <StatusTag status={item.status} />
            </div>
          </div>

          <div>
            <div className="eyebrow">Providers compared</div>
            <ul className="mt-3 space-y-px overflow-hidden rounded-lg border border-border bg-border">
              {item.considered.map((c) => {
                const chosen = c.name === item.provider;
                return (
                  <li
                    key={c.name}
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2.5",
                      chosen ? "bg-lime/[0.06]" : "bg-carbon",
                    )}
                  >
                    <span
                      className={cn("min-w-0 truncate text-[13px]", chosen ? "text-lime" : "text-ash")}
                    >
                      {c.name}
                      {chosen ? " · selected" : ""}
                    </span>
                    <span className="mono-num text-[12px] text-mist">{currency(c.price, 3)}</span>
                    <span
                      className={cn("mono-num w-8 text-right text-[12px]", chosen ? "text-lime" : "text-smoke")}
                    >
                      {c.score}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <div className="eyebrow">Why MeterMind chose this provider</div>
            <p className="mt-2 text-[13px] leading-relaxed text-mist">{item.why}</p>
          </div>

          {item.quality ? (
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
              <div className="bg-obsidian px-3 py-3">
                <dt className="eyebrow">Quality</dt>
                <dd className="mono-num mt-1.5 text-[13px] text-mist">{item.quality}/100</dd>
              </div>
              <div className="bg-obsidian px-3 py-3">
                <dt className="eyebrow">Reliability</dt>
                <dd className="mono-num mt-1.5 text-[13px] text-mist">{item.reliability}%</dd>
              </div>
            </dl>
          ) : null}

          {saved > 0 ? (
            <div className="rounded-lg border border-lime/25 bg-lime/5 px-4 py-3">
              <div className="eyebrow text-lime/70">Saved</div>
              <div className="mono-num mt-1 text-[22px] text-lime">{currency(saved, 3)}</div>
              <p className="mono-num mt-1 text-[11px] text-ash">
                {currency(item.comparable, 3)} comparable → {currency(item.paid, 3)} paid
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-obsidian px-4 py-3">
              <div className="eyebrow">Saved</div>
              <div className="mono-num mt-1 text-[22px] text-fog">{currency(0, 3)}</div>
              <p className="mt-1 text-[11px] text-ash">
                No cheaper compliant provider existed for this task.
              </p>
            </div>
          )}

          {item.provider === WINNER ? (
            <p className="flex items-start gap-2 border-t border-border pt-4 text-[12px] leading-relaxed text-ash">
              <Check size={13} className="mt-0.5 shrink-0 text-lime" aria-hidden="true" />
              A cheaper provider was available at $0.020 but scored 69 — below your quality floor.
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
