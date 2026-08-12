import { useMemo, useState } from "react";
import {
  LayoutGrid,
  Bot,
  ShoppingCart,
  Boxes,
  Sparkles,
  Scale,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ShieldCheck,
} from "lucide-react";
import {
  agents,
  currency,
  metrics,
  optimizations,
  procurements,
  providers,
  type Procurement,
  type Provider,
} from "@/lib/mock";
import { SpendVsEstimateChart, CategoryBars, CountUp, Spark } from "./charts";
import { StatusTag } from "./StatusTag";
import { ProcurementPanel } from "./ProcurementPanel";
import { LiveDot } from "./primitives";
import { cn } from "@/lib/utils";

const NAV = [
  { key: "Overview", icon: LayoutGrid },
  { key: "Procurements", icon: ShoppingCart },
  { key: "Providers", icon: Boxes },
  { key: "Agents", icon: Bot },
  { key: "Optimizations", icon: Sparkles },
  { key: "Policies", icon: Scale },
  { key: "Settings", icon: Settings },
] as const;

type NavKey = (typeof NAV)[number]["key"];

const FILTERS = ["All", "Complete", "Executing", "Blocked"] as const;

export function Dashboard({ chrome = true }: { chrome?: boolean }) {
  const [view, setView] = useState<NavKey>("Overview");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [item, setItem] = useState<Procurement | null>(null);
  const [agentId, setAgentId] = useState(agents[0]!.id);
  const [providerId, setProviderId] = useState(providers[0]!.id);

  const agent = agents.find((a) => a.id === agentId)!;
  const provider = providers.find((p) => p.id === providerId)!;
  const rows = useMemo(
    () =>
      filter === "All"
        ? procurements
        : procurements.filter((p) =>
            filter === "Blocked" ? p.status === "BLOCKED" : p.status === filter.toUpperCase(),
          ),
    [filter],
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-carbon",
        chrome && "shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]",
      )}
    >
      {chrome ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-obsidian px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-graphite" />
            <span className="h-2 w-2 rounded-full bg-graphite" />
            <span className="h-2 w-2 rounded-full bg-graphite" />
            <span className="mono-num ml-3 truncate text-[11px] text-smoke">
              app.metermind.io/{view.toLowerCase()}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LiveDot />
            <span className="font-mono text-[10px] tracking-[0.12em] text-fog">LIVE</span>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-[188px_minmax(0,1fr)]">
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-void/60 p-2 md:flex-col md:border-r md:border-b-0">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = view === n.key;
            return (
              <button
                key={n.key}
                onClick={() => setView(n.key)}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors duration-200",
                  active ? "bg-obsidian text-paper" : "text-ash hover:bg-obsidian/60 hover:text-mist",
                )}
              >
                <Icon size={14} className={active ? "text-lime" : ""} aria-hidden="true" />
                {n.key}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 p-4 md:p-6">
          {view === "Overview" || view === "Settings" ? (
            <Overview onOpen={setItem} rows={rows} filter={filter} setFilter={setFilter} />
          ) : null}

          {view === "Procurements" ? (
            <>
              <Head
                title="Procurements"
                sub="Every purchase your agents made, and the provider comparison behind it."
              />
              <Filters filter={filter} setFilter={setFilter} />
              <ProcTable rows={rows} onOpen={setItem} />
            </>
          ) : null}

          {view === "Providers" ? (
            <ProviderView provider={provider} providerId={providerId} setProviderId={setProviderId} />
          ) : null}

          {view === "Agents" || view === "Policies" ? (
            <AgentView
              agent={agent}
              agentId={agentId}
              setAgentId={setAgentId}
              onOpen={setItem}
              policies={view === "Policies"}
            />
          ) : null}

          {view === "Optimizations" ? <OptimizationsView /> : null}
        </div>
      </div>

      <ProcurementPanel item={item} onClose={() => setItem(null)} />
    </div>
  );
}

function Head({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5">
      <h3 className="text-[18px] text-paper">{title}</h3>
      <p className="mt-1 text-[13px] text-ash">{sub}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="bg-carbon px-4 py-4">
      <div className="eyebrow">{label}</div>
      <div className={cn("mt-2 text-[22px] tracking-[-0.02em]", accent ? "text-lime" : "text-paper")}>
        {value}
      </div>
    </div>
  );
}

function Filters({
  filter,
  setFilter,
}: {
  filter: (typeof FILTERS)[number];
  setFilter: (f: (typeof FILTERS)[number]) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {FILTERS.map((f) => (
        <button
          key={f}
          onClick={() => setFilter(f)}
          className={cn(
            "rounded border px-2 py-1 font-mono text-[10px] tracking-[0.1em] uppercase transition-colors duration-200",
            filter === f
              ? "border-lime/40 bg-lime/10 text-lime"
              : "border-border text-ash hover:border-smoke hover:text-mist",
          )}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

function ProcTable({ rows, onOpen }: { rows: Procurement[]; onOpen: (t: Procurement) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-obsidian/60">
            {["Time", "Agent", "Task", "Provider", "Paid", "Saved", "Status", "Rail"].map((h) => (
              <th key={h} className="eyebrow px-3 py-2.5 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const saved = Math.max(0, t.comparable - t.paid);
            return (
              <tr
                key={t.id}
                tabIndex={0}
                role="button"
                onClick={() => onOpen(t)}
                onKeyDown={(e) =>
                  (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(t))
                }
                className="cursor-pointer border-b border-border/60 transition-colors duration-200 last:border-0 hover:bg-obsidian/70"
              >
                <td className="mono-num px-3 py-3 text-[12px] text-smoke">{t.time}</td>
                <td className="px-3 py-3 text-[13px] text-paper">{t.agent}</td>
                <td className="px-3 py-3 text-[13px] text-ash">{t.task}</td>
                <td className="px-3 py-3 text-[13px] text-fog">{t.provider}</td>
                <td className="mono-num px-3 py-3 text-[13px] text-mist">{currency(t.paid, 3)}</td>
                <td className="mono-num px-3 py-3 text-[13px] text-lime">
                  {saved > 0 ? currency(saved, 3) : <span className="text-smoke">—</span>}
                </td>
                <td className="px-3 py-3">
                  <StatusTag status={t.status} />
                </td>
                <td className="mono-num px-3 py-3 text-[12px] text-smoke">{t.rail}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Overview({
  rows,
  onOpen,
  filter,
  setFilter,
}: {
  rows: Procurement[];
  onOpen: (t: Procurement) => void;
  filter: (typeof FILTERS)[number];
  setFilter: (f: (typeof FILTERS)[number]) => void;
}) {
  return (
    <>
      <div className="mb-4 rounded-lg border border-lime/25 bg-lime/[0.05] px-5 py-5">
        <div className="eyebrow text-lime/70">Total saved</div>
        <div className="mt-2 text-[40px] leading-none text-lime">
          <CountUp value={metrics.totalSaved} />
        </div>
        <p className="mono-num mt-2 text-[12px] text-ash">
          {currency(metrics.estimatedWithout)} estimated without MeterMind −{" "}
          {currency(metrics.totalSpend)} actual spend
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-5">
        <Metric label="Total spend" value={<CountUp value={metrics.totalSpend} />} />
        <Metric
          label="Est. without MeterMind"
          value={<CountUp value={metrics.estimatedWithout} />}
        />
        <Metric
          label="Procurements"
          value={<CountUp value={metrics.procurements} prefix="" decimals={0} />}
        />
        <Metric
          label="Success rate"
          value={<CountUp value={metrics.successRate} prefix="" suffix="%" decimals={1} />}
          accent
        />
        <Metric
          label="Providers used"
          value={<CountUp value={metrics.providersUsed} prefix="" decimals={0} />}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-lg border border-border bg-carbon p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="eyebrow">Spend vs estimated cost</div>
            <div className="mono-num text-[11px] text-smoke">30d</div>
          </div>
          <SpendVsEstimateChart />
        </div>
        <div className="rounded-lg border border-border bg-carbon p-4">
          <div className="eyebrow mb-4">Spend by category</div>
          <CategoryBars />
        </div>
      </div>

      <div className="mb-6">
        <div className="eyebrow mb-3">Recent optimizations</div>
        <OptimizationCards />
      </div>

      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <LiveDot />
          <h4 className="eyebrow">Recent procurements</h4>
        </div>
        <span className="mono-num shrink-0 text-[11px] text-smoke">{rows.length} events</span>
      </div>
      <Filters filter={filter} setFilter={setFilter} />
      <ProcTable rows={rows} onOpen={onOpen} />
    </>
  );
}

function OptimizationCards() {
  return (
    <ul className="grid gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-3">
      {optimizations.map((o) => {
        const protectedQuality = o.status === "QUALITY PROTECTED";
        return (
          <li key={o.id} className="bg-carbon p-4 transition-colors duration-300 hover:bg-obsidian">
            <div className="flex items-center gap-2">
              {protectedQuality ? (
                <ShieldCheck size={13} className="text-routed" aria-hidden="true" />
              ) : (
                <Sparkles size={13} className="text-lime" aria-hidden="true" />
              )}
              <span className="truncate text-[14px] text-paper">{o.title}</span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ash">{o.body}</p>
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <div className="min-w-0">
                <div className="eyebrow">Expected monthly saving</div>
                <div className="mono-num mt-1 text-[16px] text-lime">
                  {o.monthly > 0 ? currency(o.monthly) : "—"}
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em]",
                  protectedQuality
                    ? "border-routed/35 bg-routed/8 text-routed"
                    : "border-lime/35 bg-lime/8 text-lime",
                )}
              >
                {o.status}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TrendTag({ trend }: { trend: number }) {
  if (trend === 0)
    return (
      <span className="mono-num inline-flex items-center gap-1 text-[12px] text-smoke">
        <Minus size={11} /> 0%
      </span>
    );
  const up = trend > 0;
  return (
    <span
      className={cn(
        "mono-num inline-flex items-center gap-1 text-[12px]",
        up ? "text-blocked" : "text-lime",
      )}
    >
      {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {Math.abs(trend)}%
    </span>
  );
}

function ProviderView({
  provider,
  providerId,
  setProviderId,
}: {
  provider: Provider;
  providerId: string;
  setProviderId: (id: string) => void;
}) {
  const recent = procurements.filter((p) => p.provider === provider.name);
  return (
    <>
      <Head
        title="Provider intelligence"
        sub="Performance intelligence built from MeterMind's procurement history."
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-obsidian/60">
              {[
                "Provider",
                "Category",
                "Price",
                "Quality",
                "Reliability",
                "Latency",
                "Score",
                "Jobs",
                "Price trend",
              ].map((h) => (
                <th key={h} className="eyebrow px-3 py-2.5 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr
                key={p.id}
                tabIndex={0}
                role="button"
                onClick={() => setProviderId(p.id)}
                onKeyDown={(e) =>
                  (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setProviderId(p.id))
                }
                className={cn(
                  "cursor-pointer border-b border-border/60 transition-colors duration-200 last:border-0 hover:bg-obsidian/70",
                  p.id === providerId && "bg-obsidian",
                )}
              >
                <td className="px-3 py-3 text-[13px] text-paper">{p.name}</td>
                <td className="px-3 py-3 text-[13px] text-ash">{p.category}</td>
                <td className="mono-num px-3 py-3 text-[13px] text-mist">{currency(p.price, 3)}</td>
                <td className="mono-num px-3 py-3 text-[13px] text-mist">{p.quality}</td>
                <td className="mono-num px-3 py-3 text-[13px] text-mist">{p.reliability}%</td>
                <td className="mono-num px-3 py-3 text-[13px] text-fog">{p.latency}ms</td>
                <td
                  className={cn(
                    "mono-num px-3 py-3 text-[13px]",
                    p.score >= 90 ? "text-lime" : "text-fog",
                  )}
                >
                  {p.score}
                </td>
                <td className="mono-num px-3 py-3 text-[13px] text-fog">
                  {p.jobs.toLocaleString("en-US")}
                </td>
                <td className="px-3 py-3">
                  <TrendTag trend={p.trend} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-carbon p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <h4 className="truncate text-[20px] text-paper">{provider.name}</h4>
            <p className="mt-1 text-[13px] text-ash">{provider.category} provider</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="eyebrow">MeterMind score</div>
            <div className="mono-num text-[24px] text-lime">{provider.score}/100</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-6">
          <Metric label="Price" value={currency(provider.price, 3)} />
          <Metric label="Quality" value={`${provider.quality}/100`} />
          <Metric label="Reliability" value={`${provider.reliability}%`} />
          <Metric label="Latency" value={`${provider.latency}ms`} />
          <Metric label="Jobs" value={provider.jobs.toLocaleString("en-US")} />
          <Metric label="Total spend" value={currency(provider.spend)} accent />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-void/50 p-4">
            <div className="eyebrow mb-2">Price history</div>
            <Spark data={provider.priceHistory} accent />
            <p className="mono-num mt-1 text-[11px] text-smoke">
              {currency(provider.priceHistory[0]!, 3)} →{" "}
              {currency(provider.priceHistory[provider.priceHistory.length - 1]!, 3)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-void/50 p-4">
            <div className="eyebrow mb-2">Performance history</div>
            <Spark data={provider.qualityHistory} />
            <p className="mono-num mt-1 text-[11px] text-smoke">
              quality {provider.qualityHistory[0]} →{" "}
              {provider.qualityHistory[provider.qualityHistory.length - 1]} ·{" "}
              {provider.failed} failed jobs
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-lime/20 bg-lime/[0.04] p-4">
          <div className="eyebrow text-lime/70">MeterMind assessment</div>
          <p className="mt-2 text-[13px] leading-relaxed text-mist">{provider.assessment}</p>
        </div>

        {recent.length ? (
          <div className="mt-5">
            <div className="eyebrow mb-2">Recent procurements</div>
            <ul className="divide-y divide-border/70 rounded-lg border border-border">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5 text-[13px]"
                >
                  <span className="min-w-0 truncate text-ash">
                    {r.time} · {r.agent} · {r.task}
                  </span>
                  <span className="mono-num text-mist">{currency(r.paid, 3)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </>
  );
}

function AgentView({
  agent,
  agentId,
  setAgentId,
  onOpen,
  policies,
}: {
  agent: (typeof agents)[number];
  agentId: string;
  setAgentId: (id: string) => void;
  onOpen: (t: Procurement) => void;
  policies?: boolean;
}) {
  const remaining = agent.budget - agent.spent;
  const pct = (agent.spent / agent.budget) * 100;
  const rows = procurements.filter((t) => t.agent === agent.name);

  return (
    <>
      <Head
        title={policies ? "Procurement policies" : "Agents"}
        sub={
          policies
            ? "Budget controls and safety limits that bound every purchase decision."
            : "Each agent buys inside its own budget, priority and quality floor."
        }
      />
      <div className="mb-5 flex flex-wrap gap-1.5">
        {agents.map((a) => (
          <button
            key={a.id}
            onClick={() => setAgentId(a.id)}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-[13px] transition-colors duration-200",
              a.id === agentId
                ? "border-smoke bg-obsidian text-paper"
                : "border-border text-ash hover:text-mist",
            )}
          >
            {a.name}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-carbon p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <h4 className="truncate text-[20px] text-paper">{agent.name}</h4>
            <p className="mt-1 text-[13px] text-ash">
              Procurement priority: {agent.priority}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em]",
              agent.status === "Active"
                ? "border-lime/35 bg-lime/8 text-lime"
                : "border-border text-fog",
            )}
          >
            {agent.status.toUpperCase()}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
          <Metric label="Monthly budget" value={currency(agent.budget, 0)} />
          <Metric label="Spent" value={currency(agent.spent)} />
          <Metric label="Remaining" value={currency(remaining)} />
          <Metric label="Saved" value={currency(agent.saved)} accent />
        </div>

        <div className="mt-4">
          <div className="mono-num mb-1.5 flex justify-between text-[11px] text-ash">
            <span>Budget consumed</span>
            <span>{pct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-obsidian">
            <div
              className="h-full bg-lime transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="mt-6">
          <div className="eyebrow">Procurement preferences</div>
          <dl className="mt-3 divide-y divide-border/70 rounded-lg border border-border">
            {agent.rules.map((r) => (
              <div key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5">
                <dt className="min-w-0 truncate text-[13px] text-ash">{r.label}</dt>
                <dd className="text-right text-[13px] text-mist">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {policies ? (
          <div className="mt-5 rounded-lg border border-border bg-void/50 p-4">
            <div className="eyebrow">Safety controls</div>
            <ul className="mt-3 space-y-2 text-[13px] text-ash">
              {[
                "Budget exhausted for the period",
                "Provider violates an agent policy",
                "Minimum reliability is not met",
                "Maximum single purchase is exceeded",
              ].map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-smoke" />
                  MeterMind will not purchase when {c.toLowerCase()}.
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <div className="eyebrow mb-3">Recent procurements</div>
        {rows.length ? (
          <ProcTable rows={rows} onOpen={onOpen} />
        ) : (
          <p className="rounded-lg border border-border px-4 py-6 text-[13px] text-ash">
            No purchases recorded for this agent in the current window.
          </p>
        )}
      </div>
    </>
  );
}

function OptimizationsView() {
  return (
    <>
      <Head
        title="Optimizations"
        sub="Provider switches, price changes and quality protections applied automatically."
      />
      <OptimizationCards />
      <div className="mt-6 rounded-lg border border-border bg-carbon p-4">
        <div className="eyebrow mb-4">Spend vs estimated cost</div>
        <SpendVsEstimateChart />
      </div>
    </>
  );
}
