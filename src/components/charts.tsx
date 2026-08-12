import { useEffect, useRef, useState } from "react";
import { spendOverTime, spendByService, currency } from "@/lib/mock";

function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, seen };
}

export function SpendChart() {
  const { ref, seen } = useInView<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 180;
  const max = Math.max(...spendOverTime.map((d) => d.spend)) * 1.15;
  const pts = spendOverTime.map((d, i) => ({
    x: (i / (spendOverTime.length - 1)) * W,
    y: H - (d.spend / max) * H,
    ...d,
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <div ref={ref} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[180px] w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Spending over time"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="mm-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--lime)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--lime)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="var(--graphite)" strokeWidth="0.5" />
        ))}
        <path
          d={area}
          fill="url(#mm-area)"
          style={{ opacity: seen ? 1 : 0, transition: "opacity 600ms ease-out 150ms" }}
        />
        <path
          d={line}
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
        {hover !== null ? (
          <>
            <line x1={pts[hover].x} x2={pts[hover].x} y1={0} y2={H} stroke="var(--smoke)" strokeWidth="0.5" />
            <circle cx={pts[hover].x} cy={pts[hover].y} r="3" fill="var(--lime)" />
          </>
        ) : null}
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-smoke">
        <span>{spendOverTime[0].day}</span>
        <span>{spendOverTime[spendOverTime.length - 1].day}</span>
      </div>
      {hover !== null ? (
        <div className="mono-num pointer-events-none absolute top-0 right-0 rounded border border-border bg-obsidian px-2 py-1 text-[11px] text-mist">
          {spendOverTime[hover].day} · {currency(spendOverTime[hover].spend, 0)}{" "}
          <span className="text-lime">+{currency(spendOverTime[hover].saved, 0)} saved</span>
        </div>
      ) : null}
    </div>
  );
}

export function ServiceBars() {
  const { ref, seen } = useInView<HTMLDivElement>();
  const max = Math.max(...spendByService.map((s) => s.amount));
  return (
    <div ref={ref} className="space-y-3">
      {spendByService.map((s, i) => (
        <div key={s.name} className="grid grid-cols-[92px_1fr_78px] items-center gap-3">
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
          <span className="mono-num text-right text-[12px] text-fog">{currency(s.amount, 0)}</span>
        </div>
      ))}
    </div>
  );
}

export function CountUp({ value, prefix = "$", decimals = 2 }: { value: number; prefix?: string; decimals?: number }) {
  const { ref, seen } = useInView<HTMLSpanElement>();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!seen) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(value);
      return;
    }
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, value]);
  return (
    <span ref={ref} className="mono-num">
      {prefix}
      {n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  );
}
