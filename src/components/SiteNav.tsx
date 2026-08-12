import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { BtnLink } from "./primitives";
import { cn } from "@/lib/utils";

const links = [
  { label: "Product", to: "/product" },
  { label: "Run a Task", to: "/run-task" },
  { label: "How it Works", to: "/how-it-works" },
  { label: "Developers", to: "/developers" },
  { label: "Pricing", to: "/pricing" },
];

export function MeterMindMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cn("h-4 w-4", className)} aria-hidden="true">
      <rect x="1.5" y="1.5" width="17" height="17" rx="4" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M5 13.5V7l5 4 5-4v6.5" stroke="var(--lime)" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
    </svg>
  );
}

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b transition-colors duration-300",
        scrolled ? "border-border bg-void/80 backdrop-blur-xl" : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3.5 md:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2 text-paper">
          <MeterMindMark />
          <span className="text-[15px] tracking-[-0.01em]">MeterMind</span>
        </Link>

        <nav className="hidden justify-center gap-1 md:flex" aria-label="Main Navigation">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-md px-3 py-1.5 text-[13px] text-fog transition-colors duration-200 hover:bg-obsidian hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
              activeProps={{ className: "text-paper bg-obsidian font-medium" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            to="/product"
            className="rounded-md px-3 py-1.5 text-[13px] text-fog transition-colors hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
          >
            Sign in
          </Link>
          <BtnLink to="/run-task" size="sm">
            Run a Task
          </BtnLink>
        </div>

        <button
          className="col-start-3 flex h-9 w-9 items-center justify-center rounded-md border border-border text-mist transition-colors hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-border bg-void/95 px-5 py-4 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="border-b border-border/60 py-3 text-[15px] text-mist"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex gap-2">
            <BtnLink to="/run-task" className="flex-1">
              Run a Task
            </BtnLink>
          </div>
        </div>
      ) : null}
    </header>
  );
}
