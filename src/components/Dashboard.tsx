import { useMemo, useState } from "react";
import {
  LayoutGrid,
  Bot,
  ArrowLeftRight,
  Wallet,
  Scale,
  PiggyBank,
  Activity,
  Settings,
} from "lucide-react";
import { agents, currency, metrics, transactions, type Transaction } from "@/lib/mock";
import { SpendChart, ServiceBars, CountUp } from "./charts";
import { StatusTag } from "./StatusTag";
import { TransactionPanel } from "./TransactionPanel";
import { LiveDot } from "./primitives";
import { cn } from "@/lib/utils";

const NAV = [
  { key: "Overview", icon: LayoutGrid },
  { key: "Agents", icon: Bot },
  { key: "Transactions", icon: ArrowLeftRight },
  { key: "Budgets", icon: Wallet },
  { key: "Rules", icon: Scale },
  { key: "Savings", icon: PiggyBank },
  { key: "Activity", icon: Activity },
  { key: "Settings", icon: Settings },
] as const;

type NavKey = (typeof NAV)[number]["key"];

const FILTERS = ["All", "Approved", "Blocked", "Routed"] as const;

export function Dashboard({ chrome = true }: { chrome?: boolean }) {
  const [view, setView] = useState<NavKey>("Overview");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [tx, setTx] = useState<Transaction | null>(null);
  const [agentId, setAgentId] = useState(agents[0]!.id);

  const agent = agents.find((a) => a.id === agentId)!;
  const rows = useMemo(
    () => (filter === "All" ? transactions : transactions.filter((t) => t.decision === filter.toUpperCase())),
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
          {view === "Overview" || view === "Budgets" || view === "Settings" ? (
            <Overview onOpen={setTx} rows={rows} filter={filter} setFilter={setFilter} />
          ) : null}

          {view === "Transactions" || view === "Activity" ? (
            <>
              <Head title="Transactions" sub="Every machine-to-machine payment request and its decision." />
              <Filters filter={filter} setFilter={setFilter} />
              <TxTable rows={rows} onOpen={setTx} />
            </>
          ) : null}

          {view === "Agents" || view === "Rules" ? (
            <AgentView agent={agent} agentId={agentId} setAgentId={setAgentId} onOpen={setTx} />
          ) : null}

          {view === "Savings" ? <SavingsView /> : null}
        </div>
      </div>

      <TransactionPanel tx={tx} onClose={() => setTx(null)} />
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

function Metric({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
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

function TxTable({ rows, onOpen }: { rows: Transaction[]; onOpen: (t: Transaction) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[620px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-obsidian/60">
            {["Agent", "Request", "Provider", "Decision", "Saved"].map((h) => (
              <th key={h} className="eyebrow px-3 py-2.5 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr
              key={t.id}
              tabIndex={0}
              role="button"
              onClick={() => onOpen(t)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(t))}
              className="cursor-pointer border-b border-border/60 transition-colors duration-200 last:border-0 hover:bg-obsidian/70"
            >
              <td className="px-3 py-3 text-[13px] text-paper">{t.agent}</td>
              <td className="mono-num px-3 py-3 text-[13px] text-mist">{currency(t.amount)}</td>
              <td className="px-3 py-3 text-[13px] text-fog">{t.provider}</td>
              <td className="px-3 py-3">
                <StatusTag decision={t.decision} />
                {t.decision === "BLOCKED" ? (
                  <div className="mt-1 text-[11px] text-ash">{t.reason[0]}</div>
                ) : null}
              </td>
              <td className="mono-num px-3 py-3 text-[13px] text-lime">
                {t.saved ? currency(t.saved) : <span className="text-smoke">—</span>}
              </td>
            </tr>
          ))}
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
  rows: Transaction[];
  onOpen: (t: Transaction) => void;
  filter: (typeof FILTERS)[number];
  setFilter: (f: (typeof FILTERS)[number]) => void;
}) {
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
        <Metric label="Total managed" value={<CountUp value={metrics.totalManaged} />} />
        <Metric label="Spent this month" value={<CountUp value={metrics.spentThisMonth} />} />
        <Metric label="Saved by MeterMind" value={<CountUp value={metrics.savedByMeterMind} />} accent />
        <Metric
          label="Active agents"
          value={<CountUp value={metrics.activeAgents} prefix="" decimals={0} />}
          accent
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-lg border border-border bg-carbon p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="eyebrow">Spending over time</div>
            <div className="mono-num text-[11px] text-smoke">30d</div>
          </div>
          <SpendChart />
        </div>
        <div className="rounded-lg border border-border bg-carbon p-4">
          <div className="eyebrow mb-4">Spend by service</div>
          <ServiceBars />
        </div>
      </div>

      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <LiveDot />
          <h4 className="eyebrow">Live agent activity</h4>
        </div>
        <span className="mono-num shrink-0 text-[11px] text-smoke">{rows.length} events</span>
      </div>
      <Filters filter={filter} setFilter={setFilter} />
      <TxTable rows={rows} onOpen={onOpen} />
    </>
  );
}

function AgentView({
  agent,
  agentId,
  setAgentId,
  onOpen,
}: {
  agent: (typeof agents)[number];
  agentId: string;
  setAgentId: (id: string) => void;
  onOpen: (t: Transaction) => void;
}) {
  const remaining = agent.budget - agent.spent;
  const pct = (agent.spent / agent.budget) * 100;
  const rows = transactions.filter((t) => t.agent === agent.name);

  return (
    <>
      <Head title="Agents" sub="Each agent operates inside its own budget and policy set." />
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
            <p className="mt-1 text-[13px] text-ash">Autonomous spending managed by MeterMind</p>
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
            <div className="h-full bg-lime transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="mt-6">
          <div className="eyebrow">Rules</div>
          <dl className="mt-3 divide-y divide-border/70 rounded-lg border border-border">
            {agent.rules.map((r) => (
              <div key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5">
                <dt className="min-w-0 truncate text-[13px] text-ash">{r.label}</dt>
                <dd className="text-right text-[13px] text-mist">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="mt-6">
        <div className="eyebrow mb-3">Recent activity</div>
        {rows.length ? (
          <TxTable rows={rows} onOpen={onOpen} />
        ) : (
          <p className="rounded-lg border border-border px-4 py-6 text-[13px] text-ash">
            No recorded requests for this agent in the current window.
          </p>
        )}
      </div>
    </>
  );
}

function SavingsView() {
  return (
    <>
      <Head title="Savings" sub="Where MeterMind reduced or avoided spend this month." />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-lg border border-lime/25 bg-lime/5 p-5">
          <div className="eyebrow text-lime/70">Saved this month</div>
          <div className="mt-2 text-[34px] text-lime">
            <CountUp value={metrics.savedByMeterMind} />
          </div>
          <p className="mt-2 text-[13px] text-ash">15.3% of total agent spend avoided.</p>
        </div>
        <div className="rounded-lg border border-border bg-carbon p-4">
          <div className="eyebrow mb-4">Spend by service</div>
          <ServiceBars />
        </div>
      </div>
    </>
  );
}
