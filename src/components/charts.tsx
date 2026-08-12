import { useEffect, useRef, useState } from "react";
import { spendVsEstimate, spendByCategory, currency } from "@/lib/mock";

function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    // Safety: if the observer never fires (offscreen container, no layout),
    // reveal after a beat so values never stay in their zero state.
    const t = window.setTimeout(() => setSeen(true), 1200);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, []);
  return { ref, seen };
}

/** Actual MeterMind spend against what the same procurements would have cost. */
export function SpendVsEstimateChart() {
  const { ref, seen } = useInView<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 180;
  const max = Math.max(...spendVsEstimate.map((d) => d.estimated)) * 1.15;
  const pts = spendVsEstimate.map((d, i) => ({
    x: (i / (spendVsEstimate.length - 1)) * W,
    ya: H - (d.actual / max) * H,
    ye: H - (d.estimated / max) * H,
    ...d,
  }));
  const path = (key: "ya" | "ye") =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p[key].toFixed(1)}`).join(" ");
  const gap = `${path("ye")} L${pts[pts.length - 1]!.x},${pts[pts.length - 1]!.ya} ${pts
    .slice()
    .reverse()
    .map((p) => `L${p.x.toFixed(1)},${p.ya.toFixed(1)}`)
    .join(" ")} Z`;
  const hp = hover === null ? null : pts[hover];

  return (
    <div ref={ref} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[180px] w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Actual MeterMind spend versus estimated cost without MeterMind"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="mm-gap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--lime)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--lime)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="var(--graphite)" strokeWidth="0.5" />
        ))}
        <path
          d={gap}
          fill="url(#mm-gap)"
          style={{ opacity: seen ? 1 : 0, transition: "opacity 700ms ease-out 200ms" }}
        />
        <path
          d={path("ye")}
          fill="none"
          stroke="var(--smoke)"
          strokeWidth="1"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
          style={{ opacity: seen ? 1 : 0, transition: "opacity 600ms ease-out" }}
        />
        <path
          d={path("ya")}
          fill="none"
          stroke="var(--lime)"
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
          style={{
            strokeDasharray: 2000,
            strokeDashoffset: seen ? 0 : 2000,
            transition: "stroke-dashoffset 1200ms cubic-bezier(0.16,1,0.3,1)",
          }}
        />
        {pts.map((p, i) => (
          <rect
            key={p.day}
            x={p.x - W / (pts.length * 2)}
            y={0}
            width={W / pts.length}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
        {hp ? (
          <>
            <line x1={hp.x} x2={hp.x} y1={0} y2={H} stroke="var(--smoke)" strokeWidth="0.5" />
            <circle cx={hp.x} cy={hp.ya} r="3" fill="var(--lime)" />
            <circle cx={hp.x} cy={hp.ye} r="2.5" fill="var(--smoke)" />
          </>
        ) : null}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-smoke">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-px w-3 bg-lime" /> METERMIND SPEND
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-px w-3 bg-smoke" /> ESTIMATED WITHOUT
          </span>
        </div>
        <span>
          {spendVsEstimate[0]?.day} — {spendVsEstimate[spendVsEstimate.length - 1]?.day}
        </span>
      </div>

      {hp ? (
        <div className="mono-num pointer-events-none absolute top-0 right-0 rounded border border-border bg-obsidian px-2 py-1 text-[11px] text-mist">
          {hp.day} · {currency(hp.actual)}{" "}
          <span className="text-lime">saved {currency(hp.estimated - hp.actual)}</span>
        </div>
      ) : null}
    </div>
  );
}

export function CategoryBars() {
  const { ref, seen } = useInView<HTMLDivElement>();
  const max = Math.max(...spendByCategory.map((s) => s.amount));
  return (
    <div ref={ref} className="space-y-3">
      {spendByCategory.map((s, i) => (
        <div key={s.name} className="grid grid-cols-[112px_1fr_64px] items-center gap-3">
          <span className="truncate text-[13px] text-mist">{s.name}</span>
          <div className="h-1.5 overflow-hidden rounded-full bg-obsidian">
            <div
              className={i === 0 ? "h-full bg-lime" : "h-full bg-smoke"}
              style={{
                width: seen ? `${(s.amount / max) * 100}%` : "0%",
                transition: `width 700ms cubic-bezier(0.16,1,0.3,1) ${i * 60}ms`,
              }}
            />
          </div>
          <span className="mono-num text-right text-[12px] text-fog">{currency(s.amount)}</span>
        </div>
      ))}
    </div>
  );
}

/** Tiny inline sparkline used on provider detail (price / quality history). */
export function Spark({ data, accent = false }: { data: number[]; accent?: boolean }) {
  const W = 120;
  const H = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const d = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / span) * (H - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-full" preserveAspectRatio="none" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke={accent ? "var(--lime)" : "var(--smoke)"}
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function CountUp({
  value,
  prefix = "$",
  suffix = "",
  decimals = 2,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const { ref, seen } = useInView<HTMLSpanElement>();
  // Start at the true value so the number is never wrong when JS/motion is
  // unavailable; the animation rewinds to 0 only once we know it can run.
  const [n, setN] = useState(value);

  useEffect(() => {
    if (!seen) return;
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setN(value);
      return;
    }
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      if (p >= 1) {
        setN(value); // always land exactly on the real figure
        return;
      }
      setN(value * (1 - Math.pow(1 - p, 3)));
      raf = requestAnimationFrame(tick);
    };
    setN(0);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setN(value);
    };
  }, [seen, value]);

  return (
    <span ref={ref} className="mono-num">
      {prefix}
      {n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}
