import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/Dashboard";
import { Eyebrow, LiveDot } from "@/components/primitives";
import { Explainability } from "@/components/sections";

export const Route = createFileRoute("/product")({
  head: () => ({
    meta: [
      { title: "Product — MeterMind spending control surface" },
      {
        name: "description",
        content:
          "Explore the MeterMind console: agent budgets, live payment decisions, savings intelligence and full transaction explainability.",
      },
      { property: "og:title", content: "Product — MeterMind spending control surface" },
      {
        property: "og:description",
        content: "Agent budgets, live payment decisions, savings intelligence and audit trail.",
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
            One financial brain for every AI agent.
          </h1>
          <div className="hidden shrink-0 items-center gap-2 rounded border border-border bg-carbon px-2.5 py-1.5 md:flex">
            <LiveDot />
            <span className="font-mono text-[10px] tracking-[0.14em] text-mist">DEMO DATA</span>
          </div>
        </div>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ash">
          Navigate the sidebar, filter decisions and open any transaction to see exactly why
          MeterMind approved, blocked or re-routed the payment.
        </p>
        <div className="mt-8">
          <Dashboard />
        </div>
      </div>
      <Explainability />
    </>
  );
}
