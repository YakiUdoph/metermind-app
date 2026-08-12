import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Btn, Eyebrow, LiveDot } from "@/components/primitives";
import { demoProviders, WINNER, currency } from "@/lib/mock";
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
  "Purchasing service",
  "Executing",
  "Measuring result",
];

const PURCHASE = [
  "Preparing purchase…",
  "Paying $0.040…",
  "Payment confirmed ✓",
  "Executing service…",
  "Complete ✓",
];

function RunTaskPage() {
  const [task, setTask] = useState(
    "Research today's AI market news and create a short competitive analysis.",
  );
  const [budget, setBudget] = useState("2.00");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("Balanced");
  const [advanced, setAdvanced] = useState(false);
  const [step, setStep] = useState(-1);

  const running = step >= 0 && step < STEPS.length;
  const finished = step >= STEPS.length;

  useEffect(() => {
    if (step < 0 || finished) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => setStep((s) => s + 1), reduce ? 120 : 750);
    return () => window.clearTimeout(id);
  }, [step, finished]);

  const winner = demoProviders.find((p) => p.name === WINNER)!;
  const alternative = demoProviders.find((p) => p.name === "SearchX")!;
  const saved = alternative.price - winner.price;

  return (
    <>
      <div className="mx-auto w-full max-w-[1200px] px-5 pt-14 pb-4 md:px-8">
        <Eyebrow>Run a task</Eyebrow>
        <h1 className="mt-4 max-w-2xl text-[32px] leading-[1.1] text-paper md:text-[42px]">
          What does your agent need?
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ash">
          Describe the work and set a budget. MeterMind finds the services capable of completing it,
          compares them and buys the best value.
        </p>
      </div>

      <div className="mx-auto grid w-full max-w-[1200px] gap-5 px-5 py-10 md:px-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="surface rounded-xl p-5">
          <Eyebrow>Task</Eyebrow>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            rows={4}
            aria-label="Task description"
            className="mt-3 w-full resize-none rounded-md border border-border bg-void px-3.5 py-3 text-[15px] leading-relaxed text-mist outline-none transition-colors focus:border-lime/50"
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <Eyebrow>Maximum budget</Eyebrow>
              <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-void px-3 py-2">
                <span className="mono-num text-[14px] text-smoke">$</span>
                <input
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  aria-label="Maximum budget"
                  className="mono-num w-full bg-transparent text-[14px] text-paper outline-none"
                />
              </div>
            </div>
            <div>
              <Eyebrow>Priority</Eyebrow>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={cn(
                      "rounded border px-2 py-1 text-[12px] transition-colors",
                      priority === p
                        ? "border-lime/40 bg-lime/10 text-lime"
                        : "border-border text-ash hover:text-mist",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => setAdvanced((v) => !v)}
            className="mt-5 font-mono text-[10px] tracking-[0.12em] text-smoke uppercase hover:text-mist"
          >
            {advanced ? "− Advanced controls" : "+ Advanced controls"}
          </button>
          {advanced ? (
            <dl className="mt-3 divide-y divide-border/70 rounded-lg border border-border">
              {[
                ["Minimum quality", "85/100"],
                ["Minimum reliability", "95%"],
                ["Maximum provider price", "$0.25"],
                ["Preferred providers", "DataFlow, ResearchAPI"],
                ["Excluded providers", "QuickSearch"],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5">
                  <dt className="min-w-0 truncate text-[13px] text-ash">{k}</dt>
                  <dd className="mono-num text-[13px] text-mist">{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="mt-6">
            <Btn onClick={() => setStep(0)} disabled={running}>
              {running ? "Procuring…" : "Start Procurement"} <ArrowRight size={14} />
            </Btn>
          </div>
        </div>

        <div className="surface rounded-xl p-5">
          <div className="flex items-center gap-2">
            <LiveDot />
            <h2 className="text-[16px] text-paper">
              {finished ? "Procurement complete" : running ? "MeterMind is shopping…" : "Ready"}
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
                      ? "text-mist"
                      : state === "active"
                        ? "text-paper"
                        : "text-smoke opacity-50",
                  )}
                >
                  {state === "done" ? (
                    <Check size={13} className="text-lime" aria-hidden="true" />
                  ) : (
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        state === "active" ? "bg-lime" : "bg-graphite",
                      )}
                    />
                  )}
                  {s}
                </li>
              );
            })}
          </ul>

          <div className="mt-6 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-obsidian/60">
                  {["Provider", "Price", "Quality", "Reliability", "Latency", "Score"].map((h) => (
                    <th key={h} className="eyebrow px-3 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demoProviders.map((p) => {
                  const chosen = step >= 4 && p.name === WINNER;
                  return (
                    <tr
                      key={p.name}
                      className={cn(
                        "border-b border-border/60 last:border-0 transition-colors",
                        chosen && "bg-lime/[0.07]",
                      )}
                    >
                      <td className={cn("px-3 py-2.5 text-[13px]", chosen ? "text-lime" : "text-paper")}>
                        {p.name}
                      </td>
                      <td className="mono-num px-3 py-2.5 text-[13px] text-mist">
                        {currency(p.price, 3)}
                      </td>
                      <td className="mono-num px-3 py-2.5 text-[13px] text-mist">{p.quality}</td>
                      <td className="mono-num px-3 py-2.5 text-[13px] text-mist">{p.reliability}%</td>
                      <td className="mono-num px-3 py-2.5 text-[13px] text-fog">{p.latency}ms</td>
                      <td
                        className={cn(
                          "mono-num px-3 py-2.5 text-[13px]",
                          chosen ? "text-lime" : "text-fog",
                        )}
                      >
                        {p.score}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {step >= 4 ? (
            <div className="mt-4 rounded-lg border border-lime/25 bg-lime/[0.05] p-4">
              <Eyebrow>Recommended</Eyebrow>
              <div className="mt-1 text-[18px] text-lime">{WINNER}</div>
              <p className="mt-1 text-[13px] text-mist">
                Best balance of cost, quality and reliability.
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-ash">
                QuickSearch costs $0.020 less but scores 69. DataFlow costs $0.02 more than
                QuickSearch and significantly exceeds it in quality and reliability — the best value
                for your {priority} priority.
              </p>
            </div>
          ) : null}

          {step >= 5 ? (
            <ul className="mono-num mt-4 space-y-1 rounded-lg border border-border bg-void px-3 py-3 text-[12px] text-fog">
              {PURCHASE.slice(0, Math.min(PURCHASE.length, (step - 4) * 2)).map((p) => (
                <li key={p}>→ {p}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {finished ? (
        <div className="mx-auto grid w-full max-w-[1200px] gap-5 px-5 pb-20 md:px-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="surface rounded-xl p-5">
            <Eyebrow>Task result</Eyebrow>
            <h3 className="mt-2 text-[16px] text-paper">AI market brief — competitive analysis</h3>
            <p className="mt-3 text-[13px] leading-relaxed text-ash">
              Three funding events and two model launches were recorded in the last 24 hours.
              Inference pricing fell 6% across mid-tier providers, while agent-tooling startups
              captured the majority of announced capital. Competitive pressure is concentrating on
              latency and per-token price rather than raw benchmark scores.
            </p>
          </div>
          <div className="surface rounded-xl p-5">
            <Eyebrow>Procurement summary</Eyebrow>
            <dl className="mt-3 divide-y divide-border/70 rounded-lg border border-border">
              {[
                ["Provider", WINNER],
                ["Paid", currency(winner.price, 3)],
                ["Alternative comparable cost", currency(alternative.price, 3)],
                ["Saved", currency(saved, 3)],
                ["Quality", `${winner.quality}/100`],
                ["Reliability", `${winner.reliability}%`],
                ["Transaction", "Confirmed ✓"],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5">
                  <dt className="min-w-0 truncate text-[13px] text-ash">{k}</dt>
                  <dd className={cn("mono-num text-[13px]", k === "Saved" ? "text-lime" : "text-mist")}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 rounded-lg border border-lime/20 bg-lime/[0.04] p-4">
              <Eyebrow>Why MeterMind chose this provider</Eyebrow>
              <p className="mt-2 text-[13px] leading-relaxed text-mist">
                “DataFlow delivered comparable quality to SearchX at 50% lower cost while remaining
                above your reliability threshold.”
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
