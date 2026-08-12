import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Sparkles, AlertTriangle, XCircle } from "lucide-react";
import { Btn, Eyebrow, LiveDot } from "@/components/primitives";
import { demoProviders, currency } from "@/lib/mock";
import { evaluateProcurement } from "@/domain/procurement/scoring";
import type {
  ProcurementRequest,
  ProcurementResult,
  ProcurementPriority,
} from "@/domain/procurement/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/run-task")({
  head: () => ({
    meta: [
      { title: "Run a Task — MeterMind autonomous procurement" },
      {
        name: "description",
        content:
          "Give MeterMind a task and a budget. It discovers providers, compares price, quality, reliability and latency, buys the best value and reports the savings.",
      },
      { property: "og:title", content: "Run a Task — MeterMind autonomous procurement" },
      {
        property: "og:description",
        content: "Watch MeterMind shop for your agent: discover, compare, select, buy, measure.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RunTaskPage,
});

const PRIORITIES = ["Lowest Cost", "Balanced", "Highest Quality", "Fastest"] as const;

const STEPS = [
  "Understanding task",
  "Determining required services",
  "Discovering providers",
  "Evaluating 4 providers",
  "Selecting best value",
  "Purchasing service (Simulated)",
  "Executing",
  "Measuring result",
];

function RunTaskPage() {
  const [task, setTask] = useState(
    "Research today's AI market news and create a short competitive analysis.",
  );
  const [budget, setBudget] = useState("2.00");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("Balanced");
  const [advanced, setAdvanced] = useState(false);

  // Advanced constraints
  const [minQuality, setMinQuality] = useState("");
  const [minReliability, setMinReliability] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [preferredProviders, setPreferredProviders] = useState("");
  const [excludedProviders, setExcludedProviders] = useState("");

  const [step, setStep] = useState(-1);
  const [result, setResult] = useState<ProcurementResult | null>(null);

  const running = step >= 0 && step < STEPS.length;
  const finished = step >= STEPS.length;

  useEffect(() => {
    if (step < 0 || finished) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => setStep((s) => s + 1), reduce ? 120 : 650);
    return () => window.clearTimeout(id);
  }, [step, finished]);

  const handleStartProcurement = () => {
    const parsedBudget = parseFloat(budget) || 0;
    const mappedPriority = priority.toLowerCase().replace(" ", "-") as ProcurementPriority;

    const request: ProcurementRequest = {
      task,
      budget: parsedBudget,
      priority: mappedPriority,
      constraints: {
        minimumQuality: minQuality ? parseFloat(minQuality) : undefined,
        minimumReliability: minReliability ? parseFloat(minReliability) : undefined,
        maximumProviderPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        preferredProviders: preferredProviders ? preferredProviders.split(",").map((s) => s.trim()) : undefined,
        excludedProviders: excludedProviders ? excludedProviders.split(",").map((s) => s.trim()) : undefined,
      },
    };

    const res = evaluateProcurement(request, demoProviders);
    setResult(res);
    setStep(0);
  };

  const winner = result?.selectedProvider;
  const isSuccess = result?.status === "SUCCESS" && winner !== null;

  return (
    <>
      <div className="mx-auto w-full max-w-[1200px] px-5 pt-14 pb-4 md:px-8">
        <Eyebrow>Run a task</Eyebrow>
        <h1 className="mt-4 max-w-2xl text-[32px] leading-[1.1] text-paper md:text-[42px]">
          What does your agent need?
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ash">
          Describe the work and set a budget. MeterMind evaluates available providers, compares
          their weighted scores according to your priorities, and purchases the best value.
        </p>
      </div>

      <div className="mx-auto grid w-full max-w-[1200px] gap-5 px-5 py-10 md:px-8 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Left column: Input Form */}
        <div className="surface rounded-xl p-5 md:p-6">
          <label htmlFor="task-description-input" className="eyebrow block">
            Task Description
          </label>
          <textarea
            id="task-description-input"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            rows={4}
            aria-label="Task description"
            className="mt-3 w-full resize-none rounded-md border border-border bg-void px-3.5 py-3 text-[15px] leading-relaxed text-mist outline-none transition-colors focus:border-lime/50 focus-visible:ring-2 focus-visible:ring-lime"
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="budget-input" className="eyebrow block">
                Maximum budget
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-void px-3 py-2 focus-within:border-lime/50">
                <span className="mono-num text-[14px] text-smoke">$</span>
                <input
                  id="budget-input"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  aria-label="Maximum budget"
                  className="mono-num w-full bg-transparent text-[14px] text-paper outline-none"
                />
              </div>
            </div>
            <div>
              <div className="eyebrow">Priority</div>
              <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Procurement priority">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={priority === p}
                    onClick={() => setPriority(p)}
                    className={cn(
                      "rounded border px-2.5 py-1 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime",
                      priority === p
                        ? "border-lime/40 bg-lime/10 text-lime font-medium"
                        : "border-border text-ash hover:border-smoke hover:text-mist",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            aria-expanded={advanced}
            className="mt-5 inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.12em] text-smoke uppercase transition-colors hover:text-mist focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lime"
          >
            {advanced ? "− Advanced constraints" : "+ Advanced constraints"}
          </button>

          {advanced ? (
            <div className="mt-3 space-y-3 rounded-lg border border-border bg-void/50 p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="min-quality-input" className="eyebrow block">
                    Min Quality (0-100)
                  </label>
                  <input
                    id="min-quality-input"
                    placeholder="e.g. 85"
                    value={minQuality}
                    onChange={(e) => setMinQuality(e.target.value)}
                    className="mono-num mt-1.5 w-full rounded border border-border bg-void px-2.5 py-1.5 text-[13px] text-paper outline-none focus:border-lime/50"
                  />
                </div>
                <div>
                  <label htmlFor="min-rel-input" className="eyebrow block">
                    Min Reliability (%)
                  </label>
                  <input
                    id="min-rel-input"
                    placeholder="e.g. 95"
                    value={minReliability}
                    onChange={(e) => setMinReliability(e.target.value)}
                    className="mono-num mt-1.5 w-full rounded border border-border bg-void px-2.5 py-1.5 text-[13px] text-paper outline-none focus:border-lime/50"
                  />
                </div>
                <div>
                  <label htmlFor="max-price-input" className="eyebrow block">
                    Max Price ($)
                  </label>
                  <input
                    id="max-price-input"
                    placeholder="e.g. 0.07"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="mono-num mt-1.5 w-full rounded border border-border bg-void px-2.5 py-1.5 text-[13px] text-paper outline-none focus:border-lime/50"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="pref-providers-input" className="eyebrow block">
                  Preferred Providers (comma-separated)
                </label>
                <input
                  id="pref-providers-input"
                  placeholder="e.g. DataFlow, ResearchAPI"
                  value={preferredProviders}
                  onChange={(e) => setPreferredProviders(e.target.value)}
                  className="mt-1.5 w-full rounded border border-border bg-void px-2.5 py-1.5 text-[13px] text-paper outline-none focus:border-lime/50"
                />
              </div>

              <div>
                <label htmlFor="excl-providers-input" className="eyebrow block">
                  Excluded Providers (comma-separated)
                </label>
                <input
                  id="excl-providers-input"
                  placeholder="e.g. QuickSearch"
                  value={excludedProviders}
                  onChange={(e) => setExcludedProviders(e.target.value)}
                  className="mt-1.5 w-full rounded border border-border bg-void px-2.5 py-1.5 text-[13px] text-paper outline-none focus:border-lime/50"
                />
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <Btn onClick={handleStartProcurement} disabled={running} className="w-full sm:w-auto">
              {running ? "Procuring…" : "Start Procurement"} <ArrowRight size={14} />
            </Btn>
          </div>
        </div>

        {/* Right column: Execution Timeline & Live Ranking */}
        <div className="surface rounded-xl p-5 md:p-6">
          <div className="flex items-center gap-2">
            <LiveDot />
            <h2 className="text-[16px] text-paper">
              {finished
                ? isSuccess
                  ? "Procurement complete"
                  : "Procurement halted"
                : running
                  ? "MeterMind engine evaluating…"
                  : "Ready"}
            </h2>
          </div>

          <ul className="mt-4 space-y-2">
            {STEPS.map((s, i) => {
              const state = step > i ? "done" : step === i ? "active" : "todo";
              return (
                <li
                  key={s}
                  className={cn(
                    "flex items-center gap-2 text-[13px] transition-colors",
                    state === "done"
                      ? "text-mist font-medium"
                      : state === "active"
                        ? "text-paper font-medium"
                        : "text-smoke opacity-50",
                  )}
                >
                  {state === "done" ? (
                    <Check size={13} className="text-lime shrink-0" aria-hidden="true" />
                  ) : (
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        state === "active" ? "bg-lime" : "bg-graphite",
                      )}
                    />
                  )}
                  {s}
                </li>
              );
            })}
          </ul>

          {/* Engine Provider Ranking Table */}
          {step >= 4 && result ? (
            <div className="mt-6">
              {isSuccess && winner ? (
                <>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[520px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-border bg-obsidian/60">
                          {["Provider", "Price", "Quality", "Reliability", "Latency", "Engine Score"].map(
                            (h) => (
                              <th
                                key={h}
                                className={cn("eyebrow px-3 py-2 font-normal", h !== "Provider" && "text-right")}
                              >
                                {h}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rankedProviders.map((p) => {
                          const isChosen = p.id === winner.id;
                          return (
                            <tr
                              key={p.id}
                              className={cn(
                                "border-b border-border/60 transition-colors last:border-0",
                                isChosen && "bg-lime/[0.08]",
                              )}
                            >
                              <td className={cn("px-3 py-2.5 text-[13px]", isChosen ? "text-lime font-medium" : "text-paper")}>
                                {p.name}
                                {isChosen ? " · SELECTED WINNER" : ""}
                              </td>
                              <td className="mono-num px-3 py-2.5 text-right text-[13px] text-mist">
                                {currency(p.price, 3)}
                              </td>
                              <td className="mono-num px-3 py-2.5 text-right text-[13px] text-mist">{p.quality}</td>
                              <td className="mono-num px-3 py-2.5 text-right text-[13px] text-mist">{p.reliability}%</td>
                              <td className="mono-num px-3 py-2.5 text-right text-[13px] text-fog">{p.latency}ms</td>
                              <td
                                className={cn(
                                  "mono-num px-3 py-2.5 text-right text-[13px]",
                                  isChosen ? "text-lime font-medium" : "text-fog",
                                )}
                              >
                                {p.totalScore}
                              </td>
                            </tr>
                          );
                        })}
                        {result.rejectedProviders.map((p) => (
                          <tr key={p.id} className="border-b border-border/40 bg-void/50 opacity-40 last:border-0">
                            <td className="px-3 py-2.5 text-[13px] text-blocked line-through">{p.name} (REJECTED)</td>
                            <td className="mono-num px-3 py-2.5 text-right text-[13px] text-smoke">{currency(p.price, 3)}</td>
                            <td className="mono-num px-3 py-2.5 text-right text-[13px] text-smoke">{p.quality}</td>
                            <td className="mono-num px-3 py-2.5 text-right text-[13px] text-smoke">{p.reliability}%</td>
                            <td className="mono-num px-3 py-2.5 text-right text-[13px] text-smoke">{p.latency}ms</td>
                            <td className="mono-num px-3 py-2.5 text-right text-[13px] text-smoke">REJECTED</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 rounded-lg border border-lime/30 bg-lime/[0.06] p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles size={13} className="text-lime" />
                      <Eyebrow className="text-lime/80">Dynamic Engine Outcome</Eyebrow>
                    </div>
                    <div className="mt-1 text-[18px] font-medium text-lime">{winner.name}</div>
                    <p className="mt-1 text-[13px] text-mist">
                      Winner selected under <strong>{priority}</strong> priority (Score: {winner.totalScore}/100).
                    </p>
                    {result.whyCheapestWasNotSelected ? (
                      <p className="mt-2 text-[12px] leading-relaxed text-ash">
                        {result.whyCheapestWasNotSelected}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                /* Actionable Error State */
                <div className="rounded-lg border border-blocked/40 bg-blocked/[0.06] p-4">
                  <div className="flex items-center gap-2 text-blocked">
                    <AlertTriangle size={16} />
                    <span className="font-mono text-[11px] tracking-[0.12em] uppercase">
                      {result.status}
                    </span>
                  </div>
                  <h3 className="mt-2 text-[15px] font-medium text-paper">Procurement Unsuccessful</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-mist">{result.errorMessage}</p>
                  {result.rejectedProviders.length > 0 ? (
                    <div className="mt-3 border-t border-border/50 pt-2.5">
                      <Eyebrow className="text-smoke">Disqualification Reasons</Eyebrow>
                      <ul className="mt-1.5 space-y-1 text-[12px] text-ash">
                        {result.rejectedProviders.map((p) => (
                          <li key={p.id}>
                            • <strong className="text-mist">{p.name}:</strong> {p.disqualificationReasons?.join(", ")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {step >= 5 && isSuccess ? (
            <ul className="mono-num mt-4 space-y-1 rounded-lg border border-border bg-void px-3 py-3 text-[12px] text-fog">
              <li>→ Preparing purchase authorization…</li>
              <li>→ Executing simulated transaction of ${winner?.price.toFixed(3) ?? "0.000"} via x402 rail…</li>
              <li>→ Payment confirmed ✓</li>
              <li>→ Service execution verified ✓</li>
              <li>→ Complete · estimated savings ${result.estimatedSavings.toFixed(3)}</li>
            </ul>
          ) : null}
        </div>
      </div>

      {/* Finished Output & Summary */}
      {finished ? (
        <div className="mx-auto grid w-full max-w-[1200px] gap-5 px-5 pb-20 md:px-8 lg:grid-cols-[1.2fr_0.8fr]">
          {isSuccess && winner ? (
            <>
              <div className="surface rounded-xl p-5 md:p-6">
                <div className="mb-4 inline-flex items-center gap-1.5 rounded border border-lime/35 bg-lime/10 px-2.5 py-1 text-[11px] font-mono tracking-[0.1em] text-lime">
                  <Check size={12} strokeWidth={2.5} /> TASK COMPLETE
                </div>
                <Eyebrow>Task Output</Eyebrow>
                <h3 className="mt-2 text-[18px] text-paper">AI market brief — competitive analysis</h3>
                <p className="mt-3 text-[13.5px] leading-relaxed text-ash">
                  Three funding events and two model launches were recorded in the last 24 hours.
                  Inference pricing fell 6% across mid-tier providers, while agent-tooling startups
                  captured the majority of announced capital. Competitive pressure is concentrating on
                  latency and per-token price rather than raw benchmark scores.
                </p>
              </div>

              <div className="surface rounded-xl p-5 md:p-6">
                <Eyebrow>Procurement summary</Eyebrow>
                <dl className="mt-3 divide-y divide-border/70 rounded-lg border border-border">
                  {[
                    ["Provider selected", winner.name],
                    ["Amount paid", currency(result.selectedCost, 3)],
                    [
                      `Estimated comparable baseline (${result.comparisonProvider || "baseline"})`,
                      currency(result.estimatedComparableCost, 3),
                    ],
                    ["Estimated savings", currency(result.estimatedSavings, 3)],
                    ["Quality score", `${winner.quality}/100`],
                    ["Reliability score", `${winner.reliability}%`],
                    ["Latency", `${winner.latency}ms`],
                    ["Transaction status", "Simulated ✓"],
                  ].map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5">
                      <dt className="min-w-0 truncate text-[13px] text-ash">{k}</dt>
                      <dd
                        className={cn(
                          "mono-num text-[13px]",
                          k === "Estimated savings" ? "text-lime font-medium" : "text-mist",
                        )}
                      >
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-4 rounded-lg border border-lime/20 bg-lime/[0.04] p-4">
                  <Eyebrow className="text-lime/80">Why MeterMind chose this provider</Eyebrow>
                  <ul className="mt-2 space-y-1.5 text-[13px] text-mist">
                    {result.decisionReasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-lime">•</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <div className="surface col-span-2 rounded-xl p-6 border-blocked/40">
              <div className="flex items-center gap-2 text-blocked">
                <XCircle size={18} />
                <h3 className="text-[16px] font-medium text-paper">No Procurement Executed</h3>
              </div>
              <p className="mt-2 text-[14px] text-mist">{result?.errorMessage}</p>
              <p className="mt-3 text-[13px] text-ash">
                Try increasing your maximum budget, adjusting priority rules, or relaxing quality and reliability constraints.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
