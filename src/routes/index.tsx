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
      { title: "MeterMind — Financial intelligence for AI agents" },
      {
        name: "description",
        content:
          "MeterMind gives AI agents budgets, payment rules and spending intelligence: it approves, blocks, routes and explains every machine-to-machine payment.",
      },
      { property: "og:title", content: "MeterMind — Financial intelligence for AI agents" },
      {
        property: "og:description",
        content:
          "Autonomous payment control for the agent economy. Budgets, policy, routing and audit in one surface.",
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
