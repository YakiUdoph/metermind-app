import { useEffect, useState } from "react";
import { Orb } from "./Orb";
import { demoProviders, WINNER, currency } from "@/lib/mock";
import { cn } from "@/lib/utils";

const PHASES = [
  "Understanding task…",
  "Discovering providers…",
  "Comparing 4 providers…",
  "Evaluating price + quality + reliability…",
  `${WINNER} selected`,
  "Paying $0.040…",
  "Service executing…",
  "Complete · saved $0.040",
];

/** Positions for the four provider chips around the core (percent of box). */
const SPOTS = [
  { top: "6%", left: "4%" },
  { top: "22%", right: "2%" },
  { bottom: "20%", left: "2%" },
  { bottom: "6%", right: "6%" },
];

export function ProcurementStage() {
  const [phase, setPhase] = useState(0);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase(PHASES.length - 1);
      return;
    }
    const id = setInterval(() => setPhase((p) => (p + 1) % PHASES.length), 1300);
    return () => clearInterval(id);
  }, []);

  const revealed = phase >= 1;
  const decided = phase >= 4;
  const paid = phase >= 5;
  const done = phase >= 7;

  return (
    <div className="relative flex w-full flex-col items-center">
      <div className="relative flex w-full max-w-[520px] items-center justify-center">
        <Orb className="mx-auto" size={520} />

        <div className="pointer-events-none absolute inset-0">
          <div className="pointer-events-auto absolute top-0 left-1/2 w-[190px] -translate-x-1/2 rounded-lg border border-border bg-void/85 px-3 py-2 backdrop-blur-sm">
            <div className="eyebrow">Task</div>
            <p className="mt-1 text-[12px] leading-snug text-mist">
              Research today's AI market news
            </p>
            <p className="mono-num mt-1 text-[11px] text-smoke">Budget $1.00</p>
          </div>

          {demoProviders.map((p, i) => {
            const spot = SPOTS[i]!;
            const isWinner = p.name === WINNER;
            const dim = decided && !isWinner;
            return (
              <div
                key={p.name}
                style={spot}
                onMouseEnter={() => setHover(p.name)}
                onMouseLeave={() => setHover(null)}
                className={cn(
                  "pointer-events-auto absolute w-[132px] rounded-lg border px-2.5 py-2 backdrop-blur-sm transition-all duration-500",
                  revealed ? "opacity-100" : "translate-y-1 opacity-0",
                  dim && "opacity-35",
                  decided && isWinner
                    ? "border-lime/50 bg-lime/[0.08] shadow-[0_0_28px_-8px_var(--lime)]"
                    : "border-border bg-void/80",
                )}
              >
                <div
                  className={cn(
                    "truncate text-[12px]",
                    decided && isWinner ? "text-lime" : "text-mist",
                  )}
                >
                  {p.name}
                </div>
                <div className="mono-num mt-0.5 flex items-center justify-between text-[10px] text-smoke">
                  <span>{currency(p.price, 3)}</span>
                  <span>Score {p.score}</span>
                </div>

                {hover === p.name ? (
                  <div className="absolute top-full left-0 z-10 mt-1.5 w-[150px] rounded-lg border border-border bg-carbon px-2.5 py-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]">
                    <div className="text-[12px] text-paper">{p.name}</div>
                    <dl className="mono-num mt-1.5 space-y-1 text-[10px]">
                      {[
                        ["Price", currency(p.price, 3)],
                        ["Quality", `${p.quality}/100`],
                        ["Reliability", `${p.reliability}%`],
                        ["Latency", `${p.latency}ms`],
                        ["MeterMind score", `${p.score}/100`],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <dt className="text-smoke">{k}</dt>
                          <dd className={k === "MeterMind score" ? "text-lime" : "text-mist"}>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 w-full max-w-md rounded-lg border border-border bg-carbon px-3 py-2.5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <span className="min-w-0 truncate text-[13px] text-paper">{PHASES[phase]}</span>
          <span className="mono-num shrink-0 text-[10px] text-smoke">
            {String(phase + 1).padStart(2, "0")}/{PHASES.length}
          </span>
        </div>
        <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-obsidian">
          <div
            className="h-full bg-lime transition-[width] duration-500"
            style={{ width: `${((phase + 1) / PHASES.length) * 100}%` }}
          />
        </div>
      </div>

      <dl className="mt-3 grid w-full max-w-md grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
        <div className="bg-carbon px-3 py-2.5">
          <dt className="eyebrow">Best value</dt>
          <dd className={cn("mt-1 text-[14px]", decided ? "text-lime" : "text-smoke")}>
            {decided ? WINNER : "—"}
          </dd>
        </div>
        <div className="bg-carbon px-3 py-2.5">
          <dt className="eyebrow">Paid</dt>
          <dd className={cn("mono-num mt-1 text-[14px]", paid ? "text-paper" : "text-smoke")}>
            {paid ? "$0.040" : "—"}
          </dd>
        </div>
        <div className="bg-carbon px-3 py-2.5">
          <dt className="eyebrow">Saved</dt>
          <dd className={cn("mono-num mt-1 text-[14px]", done ? "text-lime" : "text-smoke")}>
            {done ? "$0.040" : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
