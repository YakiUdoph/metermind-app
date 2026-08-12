import { useEffect, useRef } from "react";

/** Extremely restrained computational cursor trace. Desktop pointers only. */
export function CursorTrail() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    type P = { x: number; y: number; vx: number; vy: number; life: number; lime: boolean };
    let particles: P[] = [];
    let last = { x: 0, y: 0, has: false };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (last.has) {
        const d = Math.hypot(e.clientX - last.x, e.clientY - last.y);
        if (d > 14 && particles.length < 60) {
          particles.push({
            x: e.clientX,
            y: e.clientY,
            vx: (Math.random() - 0.5) * 0.25,
            vy: (Math.random() - 0.5) * 0.25 - 0.1,
            life: 1,
            lime: Math.random() < 0.28,
          });
        }
      }
      last = { x: e.clientX, y: e.clientY, has: true };
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf = 0;
    const loop = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particles = particles.filter((p) => p.life > 0);
      particles.forEach((p) => {
        p.life -= 0.035;
        p.x += p.vx;
        p.y += p.vy;
        const a = Math.max(0, p.life) * (p.lime ? 0.8 : 0.35);
        ctx.fillStyle = p.lime ? `rgba(228,242,34,${a})` : `rgba(220,226,232,${a})`;
        ctx.fillRect(p.x, p.y, 1.5, 1.5);
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 hidden md:block"
    />
  );
}
