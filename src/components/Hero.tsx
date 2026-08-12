import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Orb } from "./Orb";
import { BtnLink, LiveDot } from "./primitives";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "REQUEST", label: "Request", value: "OpenAI API · $12.40" },
  { key: "ANALYZE", label: "Analyze", value: "Budget 62% remaining" },
  { key: "DECIDE", label: "Decide", value: "Approved · under $50 limit" },
  { key: "PAY", label: "Pay", value: "Best available route" },
  { key: "TRACK", label: "Track", value: "Saved $3.18" },
];

export function Hero() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setActive((i) => (i + 1) % STEPS.length), 1900);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative overflow-hidden">
      <div className="grid-field pointer-events-none absolute inset-0 opacity-[0.5] [mask-image:radial-gradient(ellipse_at_60%_35%,black,transparent_72%)]" />
      <div className="relative mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-12 px-5 pt-16 pb-20 md:px-8 md:pt-24 md:pb-28 lg:grid-cols-[1fr_0.95fr]">
        <div>
          <div className="eyebrow">Autonomous financial intelligence</div>
          <h1 className="mt-5 max-w-xl text-[36px] leading-[1.05] tracking-[-0.03em] text-paper sm:text-[46px] lg:text-[58px]">
            Your AI agents know how to work.
            <span className="mt-2 block text-fog">MeterMind teaches them how to spend.</span>
          </h1>
          <p className="mt-6 max-w-lg text-[15px] leading-[1.65] text-ash">
            Give AI agents budgets, payment rules and financial intelligence. MeterMind decides what
            should be paid, blocks waste, routes permitted payments and shows you exactly where the
            money went.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <BtnLink to="/product">
              Start Building <ArrowRight size={14} />
            </BtnLink>
            <BtnLink to="/how-it-works" variant="ghost">
              See How It Works
            </BtnLink>
          </div>

          <div className="mt-8 inline-flex items-center gap-2 rounded border border-border bg-carbon/60 px-2.5 py-1.5">
            <LiveDot />
            <span className="font-mono text-[10px] tracking-[0.14em] text-mist uppercase">
              MeterMind Agent Online
            </span>
          </div>
        </div>

        <div className="relative flex flex-col items-center">
          <div className="relative flex w-full items-center justify-center">
            <Orb className="mx-auto" size={520} />
            <div className="pointer-events-none absolute inset-0 hidden items-center justify-center lg:flex">
              <div className="mono-num absolute top-[12%] left-0 rounded border border-border bg-void/70 px-2 py-1 text-[10px] text-fog backdrop-blur-sm">
                REQ $12.40
              </div>
              <div className="mono-num absolute right-0 bottom-[18%] rounded border border-lime/30 bg-void/70 px-2 py-1 text-[10px] text-lime backdrop-blur-sm">
                SAVED $3.18
              </div>
            </div>
          </div>

          <ol className="mt-6 grid w-full max-w-md grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border">
            {STEPS.map((s, i) => (
              <li
                key={s.key}
                className={cn(
                  "grid grid-cols-[76px_1fr_auto] items-center gap-3 bg-carbon px-3 py-2.5 transition-colors duration-300",
                  i === active && "bg-obsidian",
                )}
              >
                <span
                  className={cn(
                    "font-mono text-[10px] tracking-[0.14em] transition-colors duration-300",
                    i === active ? "text-lime" : "text-smoke",
                  )}
                >
                  {s.key}
                </span>
                <span
                  className={cn(
                    "min-w-0 truncate text-[13px] transition-colors duration-300",
                    i === active ? "text-paper" : "text-ash",
                  )}
                >
                  {s.value}
                </span>
                <span
                  className={cn(
                    "h-1 w-1 shrink-0 rounded-full transition-colors duration-300",
                    i === active ? "bg-lime" : "bg-graphite",
                  )}
                />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
