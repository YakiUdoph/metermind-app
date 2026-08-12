import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Plug, Scale, Cpu, CreditCard, TrendingUp, Ban, Sparkles } from "lucide-react";
import { Section, SectionHead, Btn, BtnLink, Eyebrow, LiveDot } from "./primitives";
import { Dashboard } from "./Dashboard";
import { CountUp } from "./charts";
import { savingsInsights, potentialMonthly, currency } from "@/lib/mock";
import { Orb } from "./Orb";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- product */

export function ProductSection() {
  return (
    <Section id="product">
      <SectionHead
        eyebrow="Product"
        title="One procurement brain for every AI agent."
        sub="Discovery, provider comparison, purchasing and savings intelligence in a single control surface — built for software that buys without a human in the loop."
      />
      <div className="mt-10">
        <Dashboard />
      </div>
    </Section>
  );
}

/* -------------------------------------------------------- explainability */

const CHECKS = [
  "4 capable providers discovered",
  "QuickSearch $0.020 — score 69, below quality floor",
  "SearchX $0.080 — score 92, 2x the price",
  "DataFlow $0.040 — score 94, best value",
];

export function Explainability() {
  return (
    <Section id="explainability">
      <SectionHead
        eyebrow="Procurement explainability"
        title="Every purchase has a reason."
        sub="MeterMind compares every capable provider on price, quality, reliability and latency, buys the best value and records exactly why."
      />

      <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-[1fr_1fr_0.9fr]">
        <div className="bg-carbon p-6">
          <Eyebrow>Task</Eyebrow>
          <div className="mt-4 space-y-3">
            <Row k="Agent" v="Research Agent" />
            <Row k="Budget" v="$1.00" mono />
            <Row k="Needs" v="Web research" />
          </div>
        </div>

        <div className="bg-carbon p-6">
          <Eyebrow>Provider comparison</Eyebrow>
          <ul className="mt-4 space-y-2.5">
            {CHECKS.map((c, i) => (
              <li
                key={c}
                className="animate-rise flex items-start gap-2 text-[13px] text-mist"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <Check size={13} className="mt-0.5 shrink-0 text-lime" aria-hidden="true" />
                {c}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-obsidian p-6">
          <Eyebrow>Selected</Eyebrow>
          <div className="mt-3 inline-flex items-center gap-2 rounded border border-lime/35 bg-lime/8 px-2 py-1 font-mono text-[11px] tracking-[0.12em] text-lime">
            <Check size={11} strokeWidth={2.5} /> DATAFLOW
          </div>
          <dl className="mono-num mt-5 space-y-2 text-[13px]">
            <div className="flex justify-between text-ash">
              <dt>Comparable provider cost</dt>
              <dd className="line-through">$0.080</dd>
            </div>
            <div className="flex justify-between text-mist">
              <dt>Paid</dt>
              <dd>$0.040</dd>
            </div>
          </dl>
          <div className="mt-5 border-t border-border pt-4">
            <Eyebrow>Saved</Eyebrow>
            <div className="mt-1 text-[28px] text-lime">
              <CountUp value={0.04} decimals={3} />
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-border/60 pb-2.5 last:border-0">
      <span className="min-w-0 truncate text-[13px] text-ash">{k}</span>
      <span className={cn("text-[13px] text-paper", mono && "mono-num")}>{v}</span>
    </div>
  );
}

/* ----------------------------------------------------------- how it works */

const STEPS = [
  {
    n: "01",
    title: "Task",
    icon: Plug,
    body: "Tell MeterMind what your agent needs.",
    detail: ['"Research today\'s AI market news and create a competitive analysis."'],
  },
  {
    n: "02",
    title: "Discover",
    icon: Cpu,
    body: "MeterMind finds services capable of completing the task.",
    detail: ["4 providers discovered"],
  },
  {
    n: "03",
    title: "Compare",
    icon: Scale,
    body: "MeterMind compares price, quality, reliability, latency and historical performance.",
    detail: ["price", "quality", "reliability", "latency", "history"],
  },
  {
    n: "04",
    title: "Select",
    icon: Sparkles,
    body: "MeterMind chooses the best provider according to your priorities.",
    detail: ["DataFlow · score 94"],
  },
  {
    n: "05",
    title: "Buy",
    icon: CreditCard,
    body: "The required service is purchased automatically.",
    detail: ["paid $0.040 · x402"],
  },
  {
    n: "06",
    title: "Measure",
    icon: TrendingUp,
    body: "MeterMind records cost, performance and outcome.",
    detail: ["saved $0.040", "420ms"],
  },
  {
    n: "07",
    title: "Learn",
    icon: Ban,
    body: "Future procurement decisions improve using historical performance.",
    detail: ["every purchase becomes intelligence"],
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <SectionHead
        eyebrow="How it works"
        title="From task to result, in seven autonomous steps."
      />
      <ol className="mt-12 space-y-px overflow-hidden rounded-xl border border-border bg-border">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <li
              key={s.n}
              className="group grid grid-cols-1 gap-5 bg-carbon px-5 py-6 transition-colors duration-300 hover:bg-obsidian md:grid-cols-[64px_240px_minmax(0,1fr)] md:items-start md:px-8"
            >
              <div className="mono-num flex items-center gap-3 text-[13px] text-smoke transition-colors duration-300 group-hover:text-lime">
                {s.n}
                <Icon size={14} aria-hidden="true" />
              </div>
              <h3 className="text-[18px] text-paper">{s.title}</h3>
              <div className="min-w-0">
                <p className="max-w-xl text-[14px] leading-relaxed text-ash">{s.body}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.detail.map((d) => (
                    <span
                      key={d}
                      className="rounded border border-border bg-void/60 px-2 py-1 font-mono text-[11px] text-fog"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

/* ---------------------------------------------------------- rule builder */

const SENTENCE = `Give my research agents a $1,000 monthly budget.
Prioritize balanced quality and price.
Never use providers below 95% reliability.`;

const PARSED = [
  { label: "Monthly budget", value: "$1,000" },
  { label: "Priority", value: "Balanced" },
  { label: "Minimum reliability", value: "95%" },
  { label: "Auto-switch", value: "Enabled" },
  { label: "Maximum single purchase", value: "$50" },
];

export function RuleBuilder() {
  const [text, setText] = useState(SENTENCE);
  const [state, setState] = useState<"idle" | "thinking" | "done">("idle");

  const run = () => {
    setState("thinking");
    window.setTimeout(() => setState("done"), 700);
  };

  return (
    <Section id="rules">
      <SectionHead
        eyebrow="Procurement preferences"
        title="Describe how your agents should buy."
        sub="Write your preferences the way you'd say them. MeterMind compiles them into procurement rules that guide every purchase."
      />

      <div className="mt-10 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="surface rounded-xl p-5">
          <Eyebrow>Policy input</Eyebrow>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setState("idle");
            }}
            rows={5}
            spellCheck={false}
            aria-label="Describe your procurement preferences"
            className="mt-3 w-full resize-none rounded-md border border-border bg-void px-3.5 py-3 text-[15px] leading-relaxed text-mist outline-none transition-colors duration-200 focus:border-lime/50"
          />
          <div className="mt-3 flex items-center gap-3">
            <Btn onClick={run} disabled={state === "thinking"}>
              {state === "thinking" ? "Compiling…" : "Create Rules"}
            </Btn>
            <span className="font-mono text-[10px] tracking-[0.12em] text-smoke uppercase">
              {state === "done" ? "5 preferences compiled" : "no active draft"}
            </span>
          </div>
        </div>

        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border">
          {PARSED.map((p, i) => (
            <div
              key={p.label}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-carbon px-5 py-5 transition-all duration-500 ease-out",
                state === "done" ? "opacity-100" : "opacity-30",
              )}
              style={{
                transitionDelay: `${i * 120}ms`,
                transform: state === "done" ? "translateY(0)" : "translateY(6px)",
              }}
            >
              <div className="min-w-0">
                <Eyebrow>{p.label}</Eyebrow>
                <div className="mono-num mt-1.5 text-[20px] text-paper">{p.value}</div>
              </div>
              {state === "done" ? (
                <Check size={14} className="shrink-0 text-lime" aria-hidden="true" />
              ) : (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-graphite" />
              )}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------- savings */

export function Savings() {
  return (
    <Section id="savings">
      <SectionHead
        eyebrow="Optimization intelligence"
        title={
          <>
            Your agents spend.
            <span className="block text-fog">MeterMind optimizes.</span>
          </>
        }
      />
      <div className="mt-10 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="surface rounded-xl border-lime/20 bg-lime/[0.04] p-6">
          <Eyebrow>Potential monthly savings</Eyebrow>
          <div className="mt-3 text-[44px] leading-none text-lime">
            <CountUp value={potentialMonthly} decimals={0} />
          </div>
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-ash">
            Identified across 12 agents and 18 providers in the current billing period.
          </p>
          <div className="mt-6">
            <BtnLink to="/product" variant="ghost" size="sm">
              View Optimizations <ArrowRight size={13} />
            </BtnLink>
          </div>
        </div>

        <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {savingsInsights.map((s) => (
            <li key={s.label} className="bg-carbon p-5 transition-colors duration-300 hover:bg-obsidian">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                <span className="min-w-0 truncate text-[14px] text-paper">{s.label}</span>
                <span className="mono-num shrink-0 text-[14px] text-lime">
                  {currency(s.value, 0)}
                </span>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-ash">{s.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------- pricing */

const TIERS = [
  { name: "Free", price: "$0", note: "For testing MeterMind.", features: ["1 agent", "Basic procurement limits", "7-day activity history"] },
  { name: "Pro", price: "$15", suffix: "/month", note: "For individual builders and small teams.", features: ["5 agents", "Natural-language preferences", "Provider intelligence", "Full procurement history"] },
  { name: "Business", price: "$60", suffix: "/month", popular: true, note: "For companies running multiple agents.", features: ["Unlimited agents", "Automatic provider switching", "Optimization intelligence", "Custom quality thresholds"] },
  { name: "Enterprise", price: "Custom", note: "For larger organizations requiring custom controls, infrastructure and support.", features: ["Dedicated infrastructure", "Custom policy controls", "SSO & audit export", "Support SLA"] },
];

export function Pricing() {
  return (
    <Section id="pricing">
      <SectionHead eyebrow="Pricing" title="We make money when we save you money." />
      <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
        {TIERS.map((t) => (
          <div
            key={t.name}
            className={cn(
              "flex flex-col p-6 transition-colors duration-300",
              t.popular ? "bg-obsidian" : "bg-carbon hover:bg-obsidian/60",
            )}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <span className="min-w-0 truncate text-[14px] text-paper">{t.name}</span>
              {t.popular ? (
                <span className="shrink-0 rounded border border-lime/35 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.14em] text-lime">
                  MOST POPULAR
                </span>
              ) : null}
            </div>
            <div className="mono-num mt-5 text-[30px] text-paper">
              {t.price}
              {t.suffix ? <span className="text-[13px] text-ash">{t.suffix}</span> : null}
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-ash">{t.note}</p>
            <ul className="mt-5 flex-1 space-y-2">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[13px] text-fog">
                  <Check size={12} className="mt-1 shrink-0 text-smoke" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <BtnLink
                to="/product"
                variant={t.popular ? "primary" : "ghost"}
                size="sm"
                className="w-full"
              >
                {t.name === "Enterprise" ? "Contact us" : "Run a Task"}
              </BtnLink>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 rounded-xl border border-border bg-carbon p-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Eyebrow>Performance-based optimization</Eyebrow>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ash">
            MeterMind may charge up to 5% of verified savings created through procurement
            optimization.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-5">
          {[
            ["Expected cost", "$1,000"],
            ["Optimized cost", "$600"],
            ["Verified savings", "$400"],
            ["MeterMind fee", "$20"],
            ["Your net saving", "$380"],
          ].map(([k, v], i) => (
            <div key={k} className="bg-carbon px-3 py-3">
              <dt className="eyebrow">{k}</dt>
              <dd className={cn("mono-num mt-1 text-[15px]", i === 4 ? "text-lime" : "text-mist")}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}

/* ----------------------------------------------------------- developers */

const CODE = `const result = await metermind.procure({
  task: "Research today's AI market news",
  budget: 2.00,
  priority: "balanced"
});`;

const CHECKLIST = [
  "Task understood",
  "5 providers discovered",
  "Providers compared",
  "DataFlow selected",
  "$0.040 paid",
  "Task completed",
  "$0.040 saved",
];

export function Developers() {
  const [step, setStep] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();
        let i = 0;
        const id = window.setInterval(() => {
          i += 1;
          setStep(i);
          if (i >= CHECKLIST.length) window.clearInterval(id);
        }, 320);
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Section id="developers">
      <SectionHead
        eyebrow="Developers"
        title={
          <>
            One call buys the
            <span className="block text-fog">best service available.</span>
          </>
        }
        sub="Describe the task and the budget. MeterMind handles discovery, comparison, purchase and measurement."
      />
      <div ref={ref} className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-[1.3fr_0.7fr]">
        <div className="bg-void p-0">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-2.5">
            <span className="mono-num min-w-0 truncate text-[11px] text-smoke">procure.ts</span>
            <span className="shrink-0 font-mono text-[10px] tracking-[0.12em] text-smoke">TS</span>
          </div>
          <pre className="overflow-x-auto px-5 py-5 font-mono text-[13px] leading-[1.7] text-mist">
            <code>
              <span className="text-ash">const</span> result ={" "}
              <span className="text-ash">await</span> metermind.
              <span className="text-lime">procure</span>({"{"}
              {"\n  "}task: <span className="text-lime/80">"Research today's AI market news"</span>,
              {"\n  "}budget: <span className="text-paper">2.00</span>,{"\n  "}priority:{" "}
              <span className="text-lime/80">"balanced"</span>
              {"\n"}
              {"}"});
            </code>
          </pre>
        </div>
        <div className="bg-carbon p-5">
          <div className="flex items-center gap-2">
            <LiveDot />
            <Eyebrow>MeterMind</Eyebrow>
          </div>
          <ul className="mt-4 space-y-2.5">
            {CHECKLIST.map((c, i) => (
              <li
                key={c}
                className={cn(
                  "flex items-center gap-2 text-[13px] transition-all duration-300",
                  i < step ? "text-mist opacity-100" : "text-smoke opacity-40",
                )}
              >
                <Check
                  size={13}
                  className={i < step ? "text-lime" : "text-graphite"}
                  aria-hidden="true"
                />
                {c}
              </li>
            ))}
          </ul>
          <div className="mono-num mt-5 rounded border border-border bg-void px-3 py-2 text-[12px] text-fog">
            → 200 OK · procurement MM-2841
          </div>
        </div>
      </div>
      <p className="sr-only">{CODE}</p>
    </Section>
  );
}

/* -------------------------------------------------------------- security */

const CONTROLS = [
  { title: "Budget Controls", body: "MeterMind will not purchase when an agent's budget is exhausted.", icon: Wallet2 },
  { title: "Quality Floors", body: "Providers below your minimum quality or reliability are never selected.", icon: Scale },
  { title: "Purchase Limits", body: "Purchases above your maximum single-purchase limit are held for review.", icon: Cpu },
  { title: "Procurement Audit", body: "Every purchase records the providers compared and why one won.", icon: Ban },
];

function Wallet2(props: { size?: number; className?: string }) {
  return <CreditCard {...props} />;
}

export function Security() {
  return (
    <Section id="security">
      <SectionHead eyebrow="Safeguards" title="Autonomous buying, inside your constraints." sub="Procurement constraints run quietly underneath every decision." />
      <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {CONTROLS.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.title} className="bg-carbon p-6 transition-colors duration-300 hover:bg-obsidian">
              <Icon size={16} className="text-fog" aria-hidden="true" />
              <h3 className="mt-4 text-[15px] text-paper">{c.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ash">{c.body}</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------- final cta */

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-border">
      <div className="grid-field pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_50%_50%,black,transparent_70%)]" />
      <div className="relative mx-auto flex max-w-[1200px] flex-col items-center px-5 py-24 text-center md:px-8">
        <Orb size={280} className="opacity-90" />
        <h2 className="mt-6 max-w-2xl text-[30px] leading-[1.1] text-paper md:text-[42px]">
          An intelligent purchasing layer for the machine economy.
        </h2>
        <p className="mt-4 text-[15px] text-ash">
          Give your agents a task and a budget. MeterMind finds the best way to buy.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <BtnLink to="/run-task">
            Run a Task <ArrowRight size={14} />
          </BtnLink>
          <BtnLink to="/product" variant="ghost">
            Explore the Console
          </BtnLink>
        </div>
      </div>
    </section>
  );
}
