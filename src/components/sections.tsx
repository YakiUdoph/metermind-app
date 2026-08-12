import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Plug, Scale, Cpu, CreditCard, TrendingUp, Ban } from "lucide-react";
import { Section, SectionHead, Btn, BtnLink, Eyebrow, LiveDot } from "./primitives";
import { Dashboard } from "./Dashboard";
import { CountUp } from "./charts";
import { savingsInsights, currency } from "@/lib/mock";
import { Orb } from "./Orb";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- product */

export function ProductSection() {
  return (
    <Section id="product">
      <SectionHead
        eyebrow="Product"
        title="One financial brain for every AI agent."
        sub="Budgets, policy, routing and audit in a single control surface — built for software that spends without a human in the loop."
      />
      <div className="mt-10">
        <Dashboard />
      </div>
    </Section>
  );
}

/* -------------------------------------------------------- explainability */

const CHECKS = [
  "Within monthly agent budget",
  "Transaction below $50 maximum",
  "Provider approved",
  "Lower-cost route available",
];

export function Explainability() {
  return (
    <Section id="explainability">
      <SectionHead
        eyebrow="Decision explainability"
        title="Every dollar has a reason."
        sub="MeterMind doesn't merely move money. It evaluates budget, policy, provider, price and risk before a payment ever executes — and records the reasoning."
      />

      <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-[1fr_1fr_0.9fr]">
        <div className="bg-carbon p-6">
          <Eyebrow>Payment request</Eyebrow>
          <div className="mt-4 space-y-3">
            <Row k="Agent" v="Research Agent" />
            <Row k="Amount" v="$21.80" mono />
            <Row k="Purpose" v="AI inference" />
          </div>
        </div>

        <div className="bg-carbon p-6">
          <Eyebrow>MeterMind analysis</Eyebrow>
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
          <Eyebrow>Decision</Eyebrow>
          <div className="mt-3 inline-flex items-center gap-2 rounded border border-lime/35 bg-lime/8 px-2 py-1 font-mono text-[11px] tracking-[0.12em] text-lime">
            <Check size={11} strokeWidth={2.5} /> APPROVED
          </div>
          <dl className="mono-num mt-5 space-y-2 text-[13px]">
            <div className="flex justify-between text-ash">
              <dt>Original expected cost</dt>
              <dd className="line-through">$25.40</dd>
            </div>
            <div className="flex justify-between text-mist">
              <dt>Final cost</dt>
              <dd>$21.80</dd>
            </div>
          </dl>
          <div className="mt-5 border-t border-border pt-4">
            <Eyebrow>Saved</Eyebrow>
            <div className="mt-1 text-[28px] text-lime">
              <CountUp value={3.6} />
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
    title: "Connect",
    icon: Plug,
    body: "Connect your agents and the services they pay for. One SDK call sits between intent and money.",
    detail: ["metermind.connect('research-agent')"],
  },
  {
    n: "02",
    title: "Set rules",
    icon: Scale,
    body: "Describe your financial policy in plain language.",
    detail: [
      "Give Research Agent $1,000/month.",
      "Never approve a transaction above $50.",
      "Prefer cheaper providers when possible.",
    ],
  },
  {
    n: "03",
    title: "MeterMind thinks",
    icon: Cpu,
    body: "An agent requests payment. MeterMind evaluates before anything executes.",
    detail: ["budget", "rules", "provider", "price", "risk"],
  },
  {
    n: "04",
    title: "Pay",
    icon: CreditCard,
    body: "Approved payments execute automatically over the best permitted route.",
    detail: ["route: openai · direct", "latency 240ms"],
  },
  {
    n: "05",
    title: "Learn & optimize",
    icon: TrendingUp,
    body: "MeterMind tracks every decision and surfaces where the spend can shrink.",
    detail: ["-15.3% monthly spend"],
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <SectionHead
        eyebrow="How it works"
        title="From intent to payment, in five controlled steps."
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

const SENTENCE = `Give my research agents $1,000 per month.
Never let them spend more than $50 at once.
Prefer cheaper AI providers when quality is similar.`;

const PARSED = [
  { label: "Monthly budget", value: "$1,000" },
  { label: "Transaction limit", value: "$50" },
  { label: "Optimization", value: "Prefer lower cost" },
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
        eyebrow="Natural-language rules"
        title="Financial controls without financial complexity."
        sub="Write the policy the way you'd say it. MeterMind compiles it into enforceable budget and routing controls."
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
            aria-label="Describe your spending policy"
            className="mt-3 w-full resize-none rounded-md border border-border bg-void px-3.5 py-3 text-[15px] leading-relaxed text-mist outline-none transition-colors duration-200 focus:border-lime/50"
          />
          <div className="mt-3 flex items-center gap-3">
            <Btn onClick={run} disabled={state === "thinking"}>
              {state === "thinking" ? "Compiling…" : "Create Rules"}
            </Btn>
            <span className="font-mono text-[10px] tracking-[0.12em] text-smoke uppercase">
              {state === "done" ? "3 rules compiled" : "no active draft"}
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
        eyebrow="Savings intelligence"
        title={
          <>
            MeterMind doesn't just spend.
            <span className="block text-fog">It finds waste.</span>
          </>
        }
      />
      <div className="mt-10 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="surface rounded-xl border-lime/20 bg-lime/[0.04] p-6">
          <Eyebrow>Potential monthly savings</Eyebrow>
          <div className="mt-3 text-[44px] leading-none text-lime">
            <CountUp value={1284} decimals={0} />
          </div>
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-ash">
            Identified across 12 agents and 6 providers in the current billing period.
          </p>
          <div className="mt-6">
            <BtnLink to="/product" variant="ghost" size="sm">
              View Savings Opportunities <ArrowRight size={13} />
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
  { name: "Free", price: "$0", note: "For testing MeterMind.", features: ["1 agent", "Basic spending limits", "7-day activity history"] },
  { name: "Pro", price: "$15", suffix: "/month", note: "For individual builders and small teams.", features: ["5 agents", "Natural-language rules", "Savings intelligence", "Full audit trail"] },
  { name: "Business", price: "$60", suffix: "/month", popular: true, note: "For companies running multiple agents.", features: ["Unlimited agents", "Payment routing optimization", "Policy engine", "Human override & approvals"] },
  { name: "Enterprise", price: "Custom", note: "For larger organizations requiring custom controls, infrastructure and support.", features: ["Dedicated infrastructure", "Custom policy controls", "SSO & audit export", "Support SLA"] },
];

export function Pricing() {
  return (
    <Section id="pricing">
      <SectionHead eyebrow="Pricing" title="Priced for builders. Built for finance teams." />
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
                {t.name === "Enterprise" ? "Contact us" : "Start Building"}
              </BtnLink>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[12px] text-smoke">
        Usage-based fees may apply to automated payment infrastructure.
      </p>
    </Section>
  );
}

/* ----------------------------------------------------------- developers */

const CODE = `const payment = await metermind.pay({
  agent: "research-agent",
  amount: 21.80,
  service: "openai"
});`;

const CHECKLIST = ["Budget checked", "Rules checked", "Payment approved", "Best route selected"];

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
            Built for agents.
            <span className="block text-fog">Controlled by humans.</span>
          </>
        }
        sub="A single call replaces ad-hoc API keys, shared cards and unmonitored spend."
      />
      <div ref={ref} className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-[1.3fr_0.7fr]">
        <div className="bg-void p-0">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-2.5">
            <span className="mono-num min-w-0 truncate text-[11px] text-smoke">payments.ts</span>
            <span className="shrink-0 font-mono text-[10px] tracking-[0.12em] text-smoke">TS</span>
          </div>
          <pre className="overflow-x-auto px-5 py-5 font-mono text-[13px] leading-[1.7] text-mist">
            <code>
              <span className="text-ash">const</span> payment ={" "}
              <span className="text-ash">await</span> metermind.
              <span className="text-lime">pay</span>({"{"}
              {"\n  "}agent: <span className="text-lime/80">"research-agent"</span>,{"\n  "}amount:{" "}
              <span className="text-paper">21.80</span>,{"\n  "}service:{" "}
              <span className="text-lime/80">"openai"</span>
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
            → 200 OK · tx MM-2841
          </div>
        </div>
      </div>
      <p className="sr-only">{CODE}</p>
    </Section>
  );
}

/* -------------------------------------------------------------- security */

const CONTROLS = [
  { title: "Budget Enforcement", body: "Every agent operates inside predefined limits.", icon: Wallet2 },
  { title: "Policy Engine", body: "Define exactly what agents can and cannot purchase.", icon: Scale },
  { title: "Audit Trail", body: "Every financial decision is recorded.", icon: Cpu },
  { title: "Human Override", body: "Pause agents or override decisions when necessary.", icon: Ban },
];

function Wallet2(props: { size?: number; className?: string }) {
  return <CreditCard {...props} />;
}

export function Security() {
  return (
    <Section id="security">
      <SectionHead eyebrow="Control" title="Autonomous doesn't mean uncontrolled." />
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
          Give your agents financial intelligence.
        </h2>
        <p className="mt-4 text-[15px] text-ash">
          Set the rules. MeterMind handles the decisions.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <BtnLink to="/product">
            Start Building <ArrowRight size={14} />
          </BtnLink>
          <BtnLink to="/product" variant="ghost">
            Explore the Demo
          </BtnLink>
        </div>
      </div>
    </section>
  );
}
