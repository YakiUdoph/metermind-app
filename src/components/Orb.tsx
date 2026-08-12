import { useEffect, useRef } from "react";

/**
 * MeterMind orb — a computational financial core.
 * Canvas 2D: layered orbital rings, a lattice shell, capital particles that
 * settle on the core, and a faint ledger arc. It notices the cursor and tilts
 * toward it slowly; it never chases.
 */
export function Orb({ className = "", size = 520 }: { className?: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let isVisible = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Pause drawing when canvas is scrolled off-screen or tab is backgrounded
    const io = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.05 },
    );
    io.observe(canvas);

    const onVisibilityChange = () => {
      if (document.hidden) isVisible = false;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // pointer awareness (normalised -1..1), heavily damped
    const target = { x: 0, y: 0 };
    const eased = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      target.x = Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width * 1.4)));
      target.y = Math.max(-1, Math.min(1, (e.clientY - cy) / (rect.height * 1.4)));
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const RINGS = [
      { r: 0.46, tilt: 0.28, speed: 0.06, dots: 46, lime: false },
      { r: 0.37, tilt: -0.42, speed: -0.09, dots: 34, lime: true },
      { r: 0.28, tilt: 0.62, speed: 0.13, dots: 26, lime: false },
    ];

    const nodes = Array.from({ length: 26 }, (_, i) => ({
      a: (i / 26) * Math.PI * 2,
      rad: 0.5 + Math.random() * 0.34,
      sp: 0.05 + Math.random() * 0.12,
      s: 0.6 + Math.random() * 1.5,
      lime: i % 7 === 0,
    }));

    let raf = 0;
    let t = 0;
    const start = performance.now();

    const draw = (now: number) => {
      t = (now - start) / 1000;
      if (reduce) t = 0;

      eased.x += (target.x - eased.x) * 0.035;
      eased.y += (target.y - eased.y) * 0.035;

      const cx = w / 2 + eased.x * 14;
      const cy = h / 2 + eased.y * 14;
      const R = Math.min(w, h) / 2;

      ctx.clearRect(0, 0, w, h);

      // atmospheric halo
      const halo = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
      halo.addColorStop(0, "rgba(228,242,34,0.055)");
      halo.addColorStop(0.45, "rgba(160,170,180,0.035)");
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // ambient data nodes with parallax
      nodes.forEach((n) => {
        const a = n.a + t * n.sp;
        const px = cx + Math.cos(a) * R * n.rad + eased.x * 26 * n.rad;
        const py = cy + Math.sin(a) * R * n.rad * 0.82 + eased.y * 26 * n.rad;
        ctx.fillStyle = n.lime ? "rgba(228,242,34,0.75)" : "rgba(210,216,224,0.28)";
        ctx.beginPath();
        ctx.arc(px, py, n.s, 0, Math.PI * 2);
        ctx.fill();
      });

      // core sphere
      const core = ctx.createRadialGradient(
        cx - R * 0.16 + eased.x * 8,
        cy - R * 0.2 + eased.y * 8,
        R * 0.02,
        cx,
        cy,
        R * 0.42,
      );
      core.addColorStop(0, "rgba(58,62,66,0.95)");
      core.addColorStop(0.5, "rgba(20,22,24,0.98)");
      core.addColorStop(1, "rgba(8,9,10,1)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.42, 0, Math.PI * 2);
      ctx.fill();

      // rim light
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.42, 0, Math.PI * 2);
      ctx.stroke();

      // inner lattice — meridians on the core
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.42, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = "rgba(140,150,160,0.14)";
      for (let i = 0; i < 7; i++) {
        const phase = t * 0.15 + (i / 7) * Math.PI;
        const k = Math.cos(phase);
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.abs(k) * R * 0.42, R * 0.42, eased.x * 0.25, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 1; i < 5; i++) {
        const y = cy - R * 0.42 + (i / 5) * R * 0.84;
        const rr = Math.sqrt(Math.max(0, (R * 0.42) ** 2 - (y - cy) ** 2));
        ctx.beginPath();
        ctx.ellipse(cx, y, rr, rr * 0.16, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // lime scan sweep (the "thinking" pass)
      const sweepY = cy - R * 0.42 + ((t * 0.22) % 1) * R * 0.84;
      const sweep = ctx.createLinearGradient(0, sweepY - 18, 0, sweepY + 18);
      sweep.addColorStop(0, "rgba(228,242,34,0)");
      sweep.addColorStop(0.5, "rgba(228,242,34,0.16)");
      sweep.addColorStop(1, "rgba(228,242,34,0)");
      ctx.fillStyle = sweep;
      ctx.fillRect(cx - R * 0.45, sweepY - 18, R * 0.9, 36);
      ctx.restore();

      // orbital rings of capital
      RINGS.forEach((ring, idx) => {
        const rr = R * ring.r;
        const tilt = ring.tilt + eased.y * 0.22;
        const yScale = Math.max(0.12, Math.abs(Math.cos(tilt)) * 0.55 + 0.1);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(eased.x * 0.14 + idx * 0.2);
        ctx.strokeStyle = ring.lime ? "rgba(228,242,34,0.22)" : "rgba(120,128,138,0.28)";
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.ellipse(0, 0, rr, rr * yScale, 0, 0, Math.PI * 2);
        ctx.stroke();

        for (let i = 0; i < ring.dots; i++) {
          const a = (i / ring.dots) * Math.PI * 2 + t * ring.speed;
          const px = Math.cos(a) * rr;
          const py = Math.sin(a) * rr * yScale;
          const depth = (Math.sin(a) + 1) / 2;
          const alpha = 0.12 + depth * 0.6;
          const hot = ring.lime && i % 6 === 0;
          ctx.fillStyle = hot
            ? `rgba(228,242,34,${0.35 + depth * 0.6})`
            : `rgba(224,228,234,${alpha * 0.55})`;
          ctx.beginPath();
          ctx.arc(px, py, hot ? 1.9 : 1.15, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // ledger arc — a settled transaction pulse travelling the outer edge
      const arcA = t * 0.5;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(eased.x * 0.1);
      ctx.strokeStyle = "rgba(228,242,34,0.5)";
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 0.46, R * 0.46 * 0.42, 0, arcA, arcA + 0.42);
      ctx.stroke();
      ctx.restore();

      if (!reduce && isVisible) {
        raf = requestAnimationFrame(draw);
      }
    };

    if (reduce) {
      draw(performance.now());
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ width: "100%", maxWidth: size, aspectRatio: "1 / 1", display: "block" }}
    />
  );
}
