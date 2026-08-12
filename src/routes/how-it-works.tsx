import { createFileRoute } from "@tanstack/react-router";
import { HowItWorks, RuleBuilder, Savings, FinalCta } from "@/components/sections";
import { Eyebrow } from "@/components/primitives";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How MeterMind works — from request to settled payment" },
      {
        name: "description",
        content:
          "Connect agents, set rules in plain language, let MeterMind evaluate budget, policy, provider, price and risk before any payment executes.",
      },
      { property: "og:title", content: "How MeterMind works" },
      {
        property: "og:description",
        content: "Connect, set rules, evaluate, pay, optimize — the five steps of autonomous spend control.",
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
          Intelligence between the agent and the invoice.
        </h1>
      </div>
      <HowItWorks />
      <RuleBuilder />
      <Savings />
      <FinalCta />
    </>
  );
}
