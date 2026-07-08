/**
 * AnimatedBackground
 *
 * Full-screen fixed canvas that renders a drifting particle-network effect
 * inspired by unicorn.studio / threat-intelligence network visualizations.
 *
 * Design notes:
 * - ~70 particles in teal/cyan palette matching Riley's primary color
 * - Lines drawn between particles within connection range, opacity by distance
 * - Subtle pulse on random particles to mimic "active nodes"
 * - Performance: uses requestAnimationFrame, reuses typed arrays, respects
 *   prefers-reduced-motion
 */

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  pulse: number;      // 0..1 oscillation phase
  pulseSpeed: number;
  active: boolean;    // bright "active node" highlight
}

const PARTICLE_COUNT = 68;
const CONNECTION_DIST = 160;
const SPEED = 0.22;

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef  = useRef<number>(0);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize handler
    function resize() {
      if (!canvas) return;
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // Initialise particles
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: rand(0, window.innerWidth),
      y: rand(0, window.innerHeight),
      vx: rand(-SPEED, SPEED),
      vy: rand(-SPEED, SPEED),
      size: rand(1.2, 2.8),
      pulse: rand(0, Math.PI * 2),
      pulseSpeed: rand(0.008, 0.022),
      active: Math.random() < 0.15,
    }));

    if (prefersReduced) {
      // Static render only — no animation loop
      drawFrame(ctx, canvas, particles, 0);
      return;
    }

    let lastTime = 0;
    function loop(time: number) {
      if (!canvas || !ctx) return;
      const dt = Math.min(time - lastTime, 32); // cap at ~30fps delta
      lastTime = time;

      // Update
      for (const p of particles) {
        p.x += p.vx * (dt / 16);
        p.y += p.vy * (dt / 16);
        p.pulse += p.pulseSpeed * (dt / 16);

        // Wrap at edges with a small margin
        const m = 20;
        if (p.x < -m) p.x = canvas.width + m;
        if (p.x > canvas.width + m) p.x = -m;
        if (p.y < -m) p.y = canvas.height + m;
        if (p.y > canvas.height + m) p.y = -m;
      }

      drawFrame(ctx, canvas, particles, time);
      frameRef.current = requestAnimationFrame(loop);
    }

    frameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        opacity: 0.28,
      }}
    />
  );
}

/** Pure draw call — separated so static and animated paths share it */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  particles: Particle[],
  _time: number,
) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Primary purple: hsl(272, 100%, 54%) ≈ #8400ff toned down to warm grey-violet
  const PRIMARY   = { r: 132, g: 110, b: 160 };
  // Accent purple: rgba(132, 0, 255) — MagicBento brand
  const ACCENT    = { r: 132, g: 0,   b: 255 };

  // Draw connections
  for (let i = 0; i < particles.length; i++) {
    const a = particles[i];
    for (let j = i + 1; j < particles.length; j++) {
      const b = particles[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > CONNECTION_DIST) continue;

      const alpha = (1 - dist / CONNECTION_DIST) * 0.25;
      // Active node pair gets a brighter line
      const isHot = a.active || b.active;
      const col = isHot ? ACCENT : PRIMARY;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},${isHot ? alpha * 1.6 : alpha})`;
      ctx.lineWidth = isHot ? 0.6 : 0.35;
      ctx.stroke();
    }
  }

  // Draw nodes
  for (const p of particles) {
    const pulseFactor = 0.6 + Math.sin(p.pulse) * 0.4; // 0.2..1.0

    if (p.active) {
      // Glowing active node — outer halo
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 7);
      gradient.addColorStop(0, `rgba(${ACCENT.r},${ACCENT.g},${ACCENT.b},${0.3 * pulseFactor})`);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 6, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${ACCENT.r},${ACCENT.g},${ACCENT.b},${0.7 * pulseFactor})`;
      ctx.fill();
    } else {
      // Regular node
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${PRIMARY.r},${PRIMARY.g},${PRIMARY.b},${0.3 * pulseFactor})`;
      ctx.fill();
    }
  }
}
