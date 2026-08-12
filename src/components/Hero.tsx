import { ArrowRight } from "lucide-react";
import { ProcurementStage } from "./ProcurementStage";
import { BtnLink, LiveDot } from "./primitives";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="grid-field pointer-events-none absolute inset-0 opacity-[0.5] [mask-image:radial-gradient(ellipse_at_60%_35%,black,transparent_72%)]" />
      <div className="relative mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-12 px-5 pt-16 pb-20 md:px-8 md:pt-24 md:pb-28 lg:grid-cols-[1fr_0.95fr]">
        <div>
          <div className="eyebrow">Autonomous procurement for AI</div>
          <h1 className="mt-5 max-w-xl text-[36px] leading-[1.05] tracking-[-0.03em] text-paper sm:text-[46px] lg:text-[58px]">
            Your AI knows what to do.
            <span className="mt-2 block text-fog">MeterMind knows what to buy.</span>
          </h1>
          <p className="mt-6 max-w-lg text-[15px] leading-[1.65] text-ash">
            Give your agents a task and a budget. MeterMind discovers, evaluates and purchases the
            best services automatically — optimizing every dollar they spend.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <BtnLink to="/run-task">
              Run a Task <ArrowRight size={14} />
            </BtnLink>
            <BtnLink to="/how-it-works" variant="ghost">
              See How It Works
            </BtnLink>
          </div>

          <div className="mt-8 inline-flex items-center gap-2 rounded border border-border bg-carbon/60 px-2.5 py-1.5">
            <LiveDot />
            <span className="font-mono text-[10px] tracking-[0.14em] text-mist uppercase">
              Procurement Engine Online
            </span>
          </div>
        </div>

        <ProcurementStage />
      </div>
    </section>
  );
}
