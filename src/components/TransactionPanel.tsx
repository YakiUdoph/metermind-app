import { useEffect } from "react";
import { X, Check } from "lucide-react";
import type { Transaction } from "@/lib/mock";
import { currency } from "@/lib/mock";
import { StatusTag } from "./StatusTag";

export function TransactionPanel({ tx, onClose }: { tx: Transaction | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!tx) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close transaction detail"
        onClick={onClose}
        className="absolute inset-0 bg-void/70 backdrop-blur-sm"
      />
      <aside
        role="dialog"
        aria-label={`Transaction ${tx.id}`}
        className="animate-rise absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l border-border bg-carbon"
      >
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="eyebrow">Transaction</div>
            <h3 className="mono-num mt-1 truncate text-[16px] text-paper">#{tx.id}</h3>
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
              ["Agent", tx.agent],
              ["Provider", tx.provider],
              ["Requested", currency(tx.amount)],
              ["Category", tx.category],
            ].map(([k, v]) => (
              <div key={k} className="bg-obsidian px-3 py-3">
                <dt className="eyebrow">{k}</dt>
                <dd className="mt-1.5 text-[13px] text-mist">{v}</dd>
              </div>
            ))}
          </dl>

          <div>
            <div className="eyebrow">Decision</div>
            <div className="mt-2">
              <StatusTag decision={tx.decision} />
            </div>
          </div>

          <div>
            <div className="eyebrow">Reasoning</div>
            <ul className="mt-3 space-y-2">
              {tx.reason.map((r) => (
                <li key={r} className="flex items-start gap-2 text-[13px] text-mist">
                  <Check size={13} className="mt-0.5 shrink-0 text-lime" aria-hidden="true" />
                  {r}
                </li>
              ))}
            </ul>
          </div>

          {tx.saved ? (
            <div className="rounded-lg border border-lime/25 bg-lime/5 px-4 py-3">
              <div className="eyebrow text-lime/70">Savings</div>
              <div className="mono-num mt-1 text-[22px] text-lime">{currency(tx.saved)}</div>
              {tx.originalAmount ? (
                <p className="mono-num mt-1 text-[11px] text-ash">
                  {currency(tx.originalAmount)} expected → {currency(tx.amount)} final
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="border-t border-border pt-4">
            <div className="eyebrow">Timestamp</div>
            <p className="mono-num mt-1.5 text-[13px] text-fog">{tx.timestamp}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
