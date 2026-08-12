import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/Dashboard";
import { Eyebrow, LiveDot } from "@/components/primitives";
import { Explainability } from "@/components/sections";

export const Route = createFileRoute("/product")({
  head: () => ({
    meta: [
      { title: "Console — MeterMind procurement intelligence" },
      {
        name: "description",
        content:
          "Explore the MeterMind console: total savings, provider intelligence, recent procurements, automatic optimizations and full purchase explainability.",
      },
      { property: "og:title", content: "Console — MeterMind procurement intelligence" },
      {
        property: "og:description",
        content: "Savings, provider intelligence, procurement history and optimizations.",
      },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-[1200px] px-5 pt-14 pb-10 md:px-8">
        <Eyebrow>Console</Eyebrow>
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <h1 className="text-[32px] leading-[1.1] text-paper md:text-[42px]">
            One procurement brain for every AI agent.
          </h1>
          <div className="hidden shrink-0 items-center gap-2 rounded border border-border bg-carbon px-2.5 py-1.5 md:flex">
            <LiveDot />
            <span className="font-mono text-[10px] tracking-[0.14em] text-mist">DEMO DATA</span>
          </div>
        </div>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ash">
          Navigate the sidebar, browse provider intelligence and open any procurement to see which
          providers were compared and why one won.
        </p>
        <div className="mt-8">
          <Dashboard />
        </div>
      </div>
      <Explainability />
    </>
  );
}
