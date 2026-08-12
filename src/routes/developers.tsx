import { createFileRoute } from "@tanstack/react-router";
import { Developers, Security, FinalCta } from "@/components/sections";
import { Eyebrow } from "@/components/primitives";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "Developers — MeterMind payment API for AI agents" },
      {
        name: "description",
        content:
          "One call between your agent and its spend. MeterMind checks budget and policy, approves the payment and selects the best permitted route.",
      },
      { property: "og:title", content: "Developers — MeterMind payment API" },
      {
        property: "og:description",
        content: "Budget checks, policy enforcement and routing behind a single SDK call.",
      },
    ],
  }),
  component: DevPage,
});

function DevPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-[1200px] px-5 pt-14 pb-4 md:px-8">
        <Eyebrow>Developers</Eyebrow>
        <h1 className="mt-4 max-w-2xl text-[32px] leading-[1.1] text-paper md:text-[42px]">
          A financial control plane you can call.
        </h1>
      </div>
      <Developers />
      <Security />
      <FinalCta />
    </>
  );
}
