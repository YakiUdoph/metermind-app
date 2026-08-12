import { Link } from "@tanstack/react-router";
import type { ReactNode, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("eyebrow", className)}>{children}</div>;
}

export function Section({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("border-t border-border/70 py-20 md:py-28", className)}>
      <div className="mx-auto w-full max-w-[1200px] px-5 md:px-8">{children}</div>
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  sub,
  align = "left",
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 text-[30px] leading-[1.1] text-paper md:text-[40px]">{title}</h2>
      {sub ? <p className="mt-4 text-[15px] leading-relaxed text-fog">{sub}</p> : null}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "quiet";
  size?: "sm" | "md";
};

const btnBase =
  "inline-flex select-none items-center justify-center gap-2 rounded-md font-medium transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:opacity-50 disabled:pointer-events-none";

const btnVariant = {
  primary:
    "bg-lime text-[oklch(0.16_0.02_116)] hover:brightness-110 shadow-[0_1px_0_0_rgba(255,255,255,0.35)_inset]",
  ghost:
    "border border-border bg-obsidian text-mist hover:border-smoke hover:bg-graphite hover:text-paper",
  quiet: "text-fog hover:text-paper",
} as const;

const btnSize = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-[14px]" } as const;

export function Btn({ variant = "primary", size = "md", className, ...rest }: BtnProps) {
  return <button className={cn(btnBase, btnVariant[variant], btnSize[size], className)} {...rest} />;
}

export function BtnLink({
  to,
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  to?: string;
  href?: string;
  variant?: "primary" | "ghost" | "quiet";
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
}) {
  const cls = cn(btnBase, btnVariant[variant], btnSize[size], className);
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={cls}>
      {children}
    </a>
  );
}

export function Card({
  children,
  className,
  raised,
}: {
  children: ReactNode;
  className?: string;
  raised?: boolean;
}) {
  return (
    <div className={cn(raised ? "surface-raised" : "surface", "rounded-xl", className)}>
      {children}
    </div>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex h-1.5 w-1.5", className)}>
      <span className="animate-livedot absolute inset-0 rounded-full bg-lime" />
      <span className="absolute inset-0 rounded-full bg-lime/40" />
    </span>
  );
}
