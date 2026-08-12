import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/Hero";
import {
  ProductSection,
  Explainability,
  HowItWorks,
  RuleBuilder,
  Savings,
  Pricing,
  Developers,
  Security,
  FinalCta,
} from "@/components/sections";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MeterMind — Autonomous procurement for AI agents" },
      {
        name: "description",
        content:
          "Give your agents a task and a budget. MeterMind discovers providers, compares price, quality and reliability, buys the best value and proves the savings.",
      },
      { property: "og:title", content: "MeterMind — Autonomous procurement for AI agents" },
      {
        property: "og:description",
        content:
          "Give your agents a task and a budget. MeterMind discovers providers, compares price, quality and reliability, buys the best value and proves the savings.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <Hero />
      <ProductSection />
      <Explainability />
      <HowItWorks />
      <RuleBuilder />
      <Savings />
      <Developers />
      <Security />
      <Pricing />
      <FinalCta />
    </>
  );
}
