import { createFileRoute } from "@tanstack/react-router";
import { Pricing, Security, FinalCta } from "@/components/sections";
import { Eyebrow } from "@/components/primitives";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — MeterMind plans for agent spend control" },
      {
        name: "description",
        content:
          "Free for testing, $15/month for builders, $60/month for teams running multiple agents, and custom enterprise controls.",
      },
      { property: "og:title", content: "Pricing — MeterMind" },
      {
        property: "og:description",
        content: "Free, Pro at $15/month, Business at $60/month, and custom Enterprise controls.",
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-[1200px] px-5 pt-14 pb-4 md:px-8">
        <Eyebrow>Pricing</Eyebrow>
        <h1 className="mt-4 max-w-2xl text-[32px] leading-[1.1] text-paper md:text-[42px]">
          Subscription pricing. No surprises in the ledger.
        </h1>
      </div>
      <Pricing />
      <Security />
      <FinalCta />
    </>
  );
}
