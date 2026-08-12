import { createFileRoute } from "@tanstack/react-router";
import { HowItWorks, RuleBuilder, Savings, FinalCta } from "@/components/sections";
import { Eyebrow } from "@/components/primitives";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How MeterMind works — from task to purchased service" },
      {
        name: "description",
        content:
          "Task, discover, compare, select, buy, measure, learn — how MeterMind buys the right service for every agent task.",
      },
      { property: "og:title", content: "How MeterMind works" },
      {
        property: "og:description",
        content: "Task, discover, compare, select, buy, measure, learn.",
      },
    ],
  }),
  component: HowPage,
});

function HowPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-[1200px] px-5 pt-14 pb-4 md:px-8">
        <Eyebrow>How it works</Eyebrow>
        <h1 className="mt-4 max-w-2xl text-[32px] leading-[1.1] text-paper md:text-[42px]">
          The procurement department for AI agents.
        </h1>
      </div>
      <HowItWorks />
      <RuleBuilder />
      <Savings />
      <FinalCta />
    </>
  );
}
