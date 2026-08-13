import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Sparkles,
  AlertTriangle,
  XCircle,
  Layers,
  Zap,
  Clock,
  DollarSign,
} from "lucide-react";
import { Btn, Eyebrow, LiveDot } from "@/components/primitives";
import { demoProviders, planningProviders, currency } from "@/lib/mock";
import { evaluateProcurement } from "@/domain/procurement/scoring";
import { planTask } from "@/domain/planning/planner";
import { executePlan } from "@/domain/execution/executor";
import type {
  ProcurementRequest,
  ProcurementResult,
  ProcurementPriority,
} from "@/domain/procurement/types";
import type { PlanningResult } from "@/domain/planning/types";
import type { ExecutionResult } from "@/domain/execution/types";
import { SERVICE_LABELS } from "@/domain/planning/types";
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

/** Steps shown in Simple Procurement mode */
const SIMPLE_STEPS = [
  "Understanding task",
  "Determining required services",
  "Discovering providers",
  "Evaluating 4 providers",
  "Selecting best value",
  "Purchasing service (Simulated)",
  "Executing",
  "Measuring result",
];

/** Steps shown in Full Planning mode */
const PLANNING_STEPS = [
  "Understanding task",
  "Detecting required services",
  "Allocating service budgets",
  "Evaluating provider candidates",
  "Selecting best-value providers",
  "Assembling procurement plan",
  "Executing selected services",
  "Measuring execution",
];

type RunMode = "simple" | "full";

function RunTaskPage() {
  const [task, setTask] = useState(
    "Research today's AI market news and create a short competitive analysis.",
  );
  const [budget, setBudget] = useState("2.00");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("Balanced");
  const [advanced, setAdvanced] = useState(false);
  const [mode, setMode] = useState<RunMode>("full");

  // Advanced constraints
  const [minQuality, setMinQuality] = useState("");
  const [minReliability, setMinReliability] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [preferredProviders, setPreferredProviders] = useState("");
  const [excludedProviders, setExcludedProviders] = useState("");

  const [step, setStep] = useState(-1);
  const [result, setResult] = useState<ProcurementResult | null>(null);
  const [planResult, setPlanResult] = useState<PlanningResult | null>(null);
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);

  const activeSteps = mode === "full" ? PLANNING_STEPS : SIMPLE_STEPS;
  const running = step >= 0 && step < activeSteps.length;
  const finished = step >= activeSteps.length;

  useEffect(() => {
    if (step < 0 || finished) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => setStep((s) => s + 1), reduce ? 120 : 650);
    return () => window.clearTimeout(id);
  }, [step, finished]);

  const handleStartProcurement = () => {
    const parsedBudget = parseFloat(budget) || 0;
    const mappedPriority = priority.toLowerCase().replace(" ", "-") as ProcurementPriority;
    const constraints = {
      minimumQuality: minQuality ? parseFloat(minQuality) : undefined,
      minimumReliability: minReliability ? parseFloat(minReliability) : undefined,
      maximumProviderPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      preferredProviders: preferredProviders
        ? preferredProviders.split(",").map((s) => s.trim())
        : undefined,
      excludedProviders: excludedProviders
        ? excludedProviders.split(",").map((s) => s.trim())
        : undefined,
    };

    if (mode === "full") {
      const pr = planTask(
        {
          task,
          totalBudget: parsedBudget,
          priority: mappedPriority,
          constraints,
        },
        planningProviders,
      );
      setPlanResult(pr);
      setResult(null);
      setExecResult(null);
      // Execute the plan immediately (synchronous in M3; async in future)
      if (pr.status === "SUCCESS" && pr.plan) {
        setExecResult(executePlan(pr.plan));
      }
    } else {
      const request: ProcurementRequest = {
        task,
        budget: parsedBudget,
        priority: mappedPriority,
        constraints,
      };
      const res = evaluateProcurement(request, demoProviders);
      setResult(res);
      setPlanResult(null);
    }

    setStep(0);
  };

  // Simple mode helpers
  const winner = result?.selectedProvider;
  const isSuccess = result?.status === "SUCCESS" && winner !== null;

  // Full planning mode helpers
  const planSuccess = planResult?.status === "SUCCESS" && planResult.plan !== null;

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
          {/* Mode toggle */}
          <div className="mb-5 flex items-center gap-2">
            <span className="eyebrow text-smoke">Mode</span>
            {(["full", "simple"] as RunMode[]).map((m) => (
              <button
                key={m}
                type="button"
                id={`mode-${m}-btn`}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded border px-2.5 py-1 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime",
                  mode === m
                    ? "border-lime/40 bg-lime/10 text-lime font-medium"
                    : "border-border text-ash hover:border-smoke hover:text-mist",
                )}
              >
                {m === "full" ? "Full Planning" : "Simple"}
              </button>
            ))}
          </div>

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
            <Btn
              onClick={handleStartProcurement}
              disabled={running}
              className="w-full sm:w-auto"
            >
              {running
                ? mode === "full"
                  ? "Planning…"
                  : "Procuring…"
                : mode === "full"
                  ? "Plan & Procure"
                  : "Start Procurement"}{" "}
              <ArrowRight size={14} />
            </Btn>
          </div>
        </div>

        {/* Right column: Execution Timeline */}
        <div className="surface rounded-xl p-5 md:p-6">
          <div className="flex items-center gap-2">
            <LiveDot />
            <h2 className="text-[16px] text-paper">
              {finished
                ? mode === "full"
                  ? planSuccess
                    ? "Plan assembled"
                    : "Planning halted"
                  : isSuccess
                    ? "Procurement complete"
                    : "Procurement halted"
                : running
                  ? mode === "full"
                    ? "MeterMind planning…"
                    : "MeterMind engine evaluating…"
                  : "Ready"}
            </h2>
          </div>

          <ul className="mt-4 space-y-2">
            {activeSteps.map((s, i) => {
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

          {/* ── Simple mode: provider ranking table ── */}
          {mode === "simple" && step >= 4 && result ? (
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

          {/* ── Simple mode: payment log ── */}
          {mode === "simple" && step >= 5 && isSuccess ? (
            <ul className="mono-num mt-4 space-y-1 rounded-lg border border-border bg-void px-3 py-3 text-[12px] text-fog">
              <li>→ Preparing purchase authorization…</li>
              <li>→ Executing simulated transaction of ${winner?.price.toFixed(3) ?? "0.000"} via x402 rail…</li>
              <li>→ Payment confirmed ✓</li>
              <li>→ Service execution verified ✓</li>
              <li>→ Complete · estimated savings ${result?.estimatedSavings.toFixed(3)}</li>
            </ul>
          ) : null}

          {/* ── Full planning mode: plan summary card (after completion) ── */}
          {mode === "full" && finished && planResult ? (
            <div className="mt-6">
              {planSuccess && planResult.plan ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-lime/30 bg-lime/[0.06] p-4">
                    <div className="flex items-center gap-2">
                      <Layers size={13} className="text-lime" />
                      <Eyebrow className="text-lime/80">Plan Assembled</Eyebrow>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border/60 bg-border/30">
                      {[
                        ["Intent", planResult.plan.intent.category.replace(/_/g, " ")],
                        ["Services", String(planResult.plan.serviceRequirements.length)],
                        ["Est. Cost", currency(planResult.plan.estimatedTotalCost, 3)],
                      ].map(([k, v]) => (
                        <div key={k} className="bg-carbon/60 px-2.5 py-2">
                          <div className="eyebrow text-smoke">{k}</div>
                          <div className="mono-num mt-0.5 text-[13px] text-paper">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {execResult && (
                    <div className={cn(
                      "rounded-lg border p-3",
                      execResult.status === "SUCCESS"
                        ? "border-lime/30 bg-lime/[0.05]"
                        : "border-blocked/30 bg-blocked/[0.05]"
                    )}>
                      <div className="flex items-center gap-1.5">
                        <Zap size={12} className={execResult.status === "SUCCESS" ? "text-lime" : "text-blocked"} />
                        <Eyebrow className={execResult.status === "SUCCESS" ? "text-lime/80" : "text-blocked/80"}>
                          {execResult.status === "SUCCESS" ? "Execution Complete" : "Execution Failed"}
                        </Eyebrow>
                        <span className="ml-auto rounded border border-lime/30 bg-lime/10 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-lime uppercase">
                          DEMO
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-smoke">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {execResult.totalMeasuredLatencyMs}ms
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign size={10} />
                          {currency(execResult.totalDeclaredCost, 3)} cost
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-blocked/40 bg-blocked/[0.06] p-4">
                  <div className="flex items-center gap-2 text-blocked">
                    <AlertTriangle size={16} />
                    <span className="font-mono text-[11px] tracking-[0.12em] uppercase">
                      {planResult.status}
                    </span>
                  </div>
                  <h3 className="mt-2 text-[15px] font-medium text-paper">Planning Unsuccessful</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-mist">{planResult.errorMessage}</p>
                  {planResult.failedService ? (
                    <p className="mt-1 text-[12px] text-ash">
                      Failed at service: <strong className="text-mist">{planResult.failedService}</strong>
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Finished Output & Summary ── */}
      {finished ? (
        <div className="mx-auto w-full max-w-[1200px] gap-5 px-5 pb-20 md:px-8">
          {/* ── Full planning mode result ── */}
          {mode === "full" && planResult ? (
            planSuccess && planResult.plan ? (
              <div className="space-y-5">
                {/* Plan table */}
                <div className="surface rounded-xl p-5 md:p-6">
                  <div className="mb-4 inline-flex items-center gap-1.5 rounded border border-lime/35 bg-lime/10 px-2.5 py-1 text-[11px] font-mono tracking-[0.1em] text-lime">
                    <Check size={12} strokeWidth={2.5} /> {execResult?.status === "SUCCESS" ? "TASK COMPLETE" : "PLAN COMPLETE"}
                  </div>
                  <Eyebrow>Procurement Plan</Eyebrow>
                  <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[680px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-border bg-obsidian/60">
                          {[
                            "Service",
                            "Selected Provider",
                            "Allocated Budget",
                            "Expected Cost",
                            "Why Selected",
                          ].map((h, hi) => (
                            <th
                              key={h}
                              className={cn(
                                "eyebrow px-3 py-2.5 font-normal",
                                hi >= 2 && hi <= 3 && "text-right",
                              )}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {planResult.plan.serviceResults.map((sr) => {
                          const selectedProvider = sr.procurementResult.selectedProvider;
                          const firstReason = sr.procurementResult.decisionReasons[0] ?? "—";
                          const label =
                            SERVICE_LABELS[sr.service as keyof typeof SERVICE_LABELS] ?? sr.service;
                          return (
                            <tr
                              key={sr.service}
                              className="border-b border-border/60 transition-colors last:border-0"
                            >
                              <td className="px-3 py-3 text-[13px] font-medium text-paper">
                                {label}
                              </td>
                              <td className="px-3 py-3 text-[13px] text-lime font-medium">
                                {selectedProvider?.name ?? "—"}
                              </td>
                              <td className="mono-num px-3 py-3 text-right text-[13px] text-mist">
                                {currency(sr.allocatedBudget, 3)}
                              </td>
                              <td className="mono-num px-3 py-3 text-right text-[13px] text-lime font-medium">
                                {currency(sr.procurementResult.selectedCost, 3)}
                              </td>
                              <td className="px-3 py-3 text-[12px] leading-relaxed text-ash max-w-[260px]">
                                {firstReason}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border bg-obsidian/40">
                          <td className="eyebrow px-3 py-2.5 text-smoke">Total</td>
                          <td />
                          <td className="mono-num px-3 py-2.5 text-right text-[13px] text-mist">
                            {currency(planResult.plan.totalAllocatedBudget, 3)}
                          </td>
                          <td className="mono-num px-3 py-2.5 text-right text-[13px] text-lime font-medium">
                            {currency(planResult.plan.estimatedTotalCost, 3)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Plan rationale + intent */}
                <div className="surface rounded-xl p-5 md:p-6">
                  <Eyebrow>Plan Rationale</Eyebrow>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-ash">
                    {planResult.plan.planRationale}
                  </p>

                  <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-border sm:grid-cols-2">
                    {[
                      [
                        "Detected intent",
                        planResult.plan.intent.category.replace(/_/g, " "),
                      ],
                      [
                        "Matched keywords",
                        planResult.plan.intent.matchedKeywords.slice(0, 4).join(", ") || "—",
                      ],
                      [
                        "Estimated savings",
                        currency(planResult.plan.estimatedTotalSavings, 3),
                      ],
                      [
                        "Confidence",
                        planResult.plan.intent.confidence,
                      ],
                    ].map(([k, v]) => (
                      <div key={k} className="bg-carbon px-3 py-2.5">
                        <dt className="eyebrow text-smoke">{k}</dt>
                        <dd className="mono-num mt-1 text-[13px] text-mist">{v}</dd>
                      </div>
                    ))}
                  </div>

                  {/* Per-service execution order */}
                  <div className="mt-4">
                    <Eyebrow className="mb-2">Execution Order</Eyebrow>
                    <ol className="space-y-1">
                      {[...planResult.plan.serviceRequirements]
                        .sort((a, b) => a.executionOrder - b.executionOrder)
                        .map((req, i) => (
                          <li
                            key={`${req.service}-${i}`}
                            className="flex items-start gap-2 text-[13px] text-mist"
                          >
                            <span className="mono-num shrink-0 text-lime">
                              {req.executionOrder}.
                            </span>
                            <span>
                              <strong>
                                {SERVICE_LABELS[req.service as keyof typeof SERVICE_LABELS] ??
                                  req.service}
                              </strong>
                              {req.canParallelize ? (
                                <span className="ml-1.5 text-[11px] text-smoke">(parallel)</span>
                              ) : null}
                              {" — "}
                              <span className="text-ash">{req.rationale}</span>
                            </span>
                          </li>
                        ))}
                    </ol>
                  </div>
                  {/* ── Execution results panel ── */}
                  {execResult && execResult.serviceExecutions.length > 0 && (
                    <div className="surface mt-5 rounded-xl p-5 md:p-6">
                      <div className="mb-4 flex items-center gap-2">
                        <Zap size={14} className={execResult.status === "SUCCESS" ? "text-lime" : "text-blocked"} />
                        <Eyebrow>{execResult.status === "SUCCESS" ? "Execution Results" : "Execution Failed"}</Eyebrow>
                        <span className="ml-auto rounded border border-lime/30 bg-lime/10 px-2 py-0.5 font-mono text-[10px] tracking-[0.1em] text-lime uppercase">
                          DEMO EXECUTION
                        </span>
                      </div>
                      <div className="space-y-3">
                        {execResult.serviceExecutions.map((ex, i) => (
                          <div
                            key={`${ex.service}-${i}`}
                            className={cn(
                              "rounded-lg border p-3.5",
                              ex.status === "SUCCESS"
                                ? "border-border bg-carbon/40"
                                : "border-blocked/30 bg-blocked/[0.04]"
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                {ex.status === "SUCCESS" ? (
                                  <Check size={12} className="text-lime shrink-0" />
                                ) : (
                                  <XCircle size={12} className="text-blocked shrink-0" />
                                )}
                                <span className="text-[13px] font-medium text-paper">
                                  {SERVICE_LABELS[ex.service as keyof typeof SERVICE_LABELS] ?? ex.service}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-smoke">
                                <span className="mono-num">{ex.measuredLatencyMs}ms</span>
                                <span className="mono-num text-ash">{currency(ex.declaredCost, 3)}</span>
                                <span className="rounded border border-lime/25 bg-lime/[0.07] px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-lime uppercase">
                                  DEMO
                                </span>
                              </div>
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-[11px] text-smoke">
                              <span>Provider: <strong className="text-mist">{ex.providerName}</strong></span>
                              <span>Budget: <span className="mono-num text-mist">{currency(ex.allocatedBudget, 3)}</span></span>
                            </div>
                            {ex.payload && ex.status === "SUCCESS" && (
                              <details className="mt-2.5">
                                <summary className="cursor-pointer text-[11px] text-smoke hover:text-mist transition-colors">
                                  View demo output
                                </summary>
                                <pre className="mono-num mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-void/80 p-2.5 text-[11px] leading-relaxed text-fog">
                                  {ex.payload}
                                </pre>
                              </details>
                            )}
                            {ex.errorMessage && (
                              <p className="mt-1.5 text-[11px] text-blocked">{ex.errorMessage}</p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Audit summary row */}
                      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border/50 pt-3 text-[12px] text-smoke">
                        <span>
                          Total latency:{" "}
                          <strong className="text-mist">{execResult.totalMeasuredLatencyMs}ms</strong>
                        </span>
                        <span>
                          Total cost:{" "}
                          <strong className="mono-num text-lime">{currency(execResult.totalDeclaredCost, 3)}</strong>
                        </span>
                        <span>
                          Allocated:{" "}
                          <strong className="mono-num text-mist">{currency(execResult.totalAllocatedBudget, 3)}</strong>
                        </span>
                        <span className="ml-auto rounded border border-lime/30 bg-lime/[0.07] px-2 py-0.5 font-mono text-[9px] tracking-widest text-lime uppercase">
                          mode: demo — not live api calls
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Final task output */}
                  {execResult?.status === "SUCCESS" && execResult.finalResult && (
                    <div className="surface mt-5 rounded-xl p-5 md:p-6">
                      <Eyebrow>Final Task Output</Eyebrow>
                      <p className="mt-1 text-[12px] text-smoke">
                        Result from the last completed stage
                      </p>
                      <pre className="mono-num mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-void p-3.5 text-[12px] leading-relaxed text-fog">
                        {execResult.finalResult}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="surface rounded-xl border-blocked/40 p-6">
                <div className="flex items-center gap-2 text-blocked">
                  <XCircle size={18} />
                  <h3 className="text-[16px] font-medium text-paper">Planning Failed</h3>
                </div>
                <p className="mt-2 text-[14px] text-mist">{planResult.errorMessage}</p>
                <p className="mt-3 text-[13px] text-ash">
                  {planResult.status === "UNSUPPORTED_TASK"
                    ? "Try rephrasing your task. Supported types: research & summarize, web search, translate, market data, code review, image analysis, content extraction."
                    : planResult.status === "BUDGET_TOO_LOW"
                      ? "Try increasing your maximum budget to allow meaningful per-service allocation."
                      : "Try a different task description or adjust your constraints."}
                </p>
              </div>
            )
          ) : null}

          {/* ── Simple mode result ── */}
          {mode === "simple" ? (
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
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
                        ["Amount paid", currency(result!.selectedCost, 3)],
                        [
                          `Estimated comparable baseline (${result!.comparisonProvider || "baseline"})`,
                          currency(result!.estimatedComparableCost, 3),
                        ],
                        ["Estimated savings", currency(result!.estimatedSavings, 3)],
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
                        {result!.decisionReasons.map((r, i) => (
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
        </div>
      ) : null}
    </>
  );
}
