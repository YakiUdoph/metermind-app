import { Link } from "@tanstack/react-router";
import { MeterMindMark } from "./SiteNav";
import { LiveDot } from "./primitives";

const cols = [
  { title: "Product", items: [["Console", "/product"], ["Run a Task", "/run-task"], ["How it Works", "/how-it-works"], ["Pricing", "/pricing"]] },
  { title: "Developers", items: [["API", "/developers"], ["Documentation", "/developers"], ["GitHub", "/developers"]] },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-5 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8">
        <div>
          <div className="flex items-center gap-2 text-paper">
            <MeterMindMark />
            <span className="text-[15px]">MeterMind</span>
          </div>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-ash">
            Autonomous procurement and spending intelligence for AI agents. Discover, compare, buy
            and continuously optimize.
          </p>
        </div>

        {cols.map((c) => (
          <div key={c.title}>
            <div className="eyebrow">{c.title}</div>
            <ul className="mt-4 space-y-2.5">
              {c.items.map(([label, to]) => (
                <li key={label}>
                  <Link to={to} className="text-[13px] text-fog transition-colors hover:text-paper">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <div className="eyebrow">System status</div>
          <div className="mt-4 inline-flex items-center gap-2 rounded border border-border bg-carbon px-2.5 py-1.5">
            <LiveDot />
            <span className="font-mono text-[10px] tracking-[0.14em] text-mist">OPERATIONAL</span>
          </div>
          <p className="mono-num mt-4 text-[11px] text-smoke">v0.9.4 · edge-fra1</p>
        </div>
      </div>

      <div className="mx-auto mt-10 w-full max-w-[1200px] border-t border-border/70 px-5 pt-6 md:px-8">
        <p className="font-mono text-[10px] tracking-[0.1em] text-smoke uppercase">
          © 2026 MeterMind — demo environment, mock financial data
        </p>
      </div>
    </footer>
  );
}
