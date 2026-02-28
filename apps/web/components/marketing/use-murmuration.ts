"use client";

import { type RefObject, useEffect } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
};

export function useMurmuration(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      // Draw in CSS pixels, not device pixels.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const NUM = 144;
    const particles: Particle[] = [];
    const w = () => canvas.width / dpr;
    const h = () => canvas.height / dpr;

    for (let i = 0; i < NUM; i++) {
      particles.push({
        x: Math.random() * w(),
        y: Math.random() * h(),
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: 1.5 + Math.random() * 2.5,
        hue: 150 + Math.random() * 25,
      });
    }

    let mouseX = -1000;
    let mouseY = -1000;
    let time = 0;

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    canvas.addEventListener("mousemove", onMove);

    const loop = () => {
      time += 0.004;
      const W = w();
      const H = h();
      ctx.clearRect(0, 0, W, H);

      // Two orbiting attractor points.
      const ax1 = W * 0.5 + Math.cos(time * 0.7) * W * 0.25;
      const ay1 = H * 0.4 + Math.sin(time * 0.9) * H * 0.22;
      const ax2 = W * 0.5 + Math.cos(time * 0.5 + 2) * W * 0.3;
      const ay2 = H * 0.6 + Math.sin(time * 0.6 + 1) * H * 0.2;

      for (let i = 0; i < NUM; i++) {
        const p = particles[i] as Particle;

        // Simplified flocking.
        let avgVx = 0;
        let avgVy = 0;
        let sepX = 0;
        let sepY = 0;
        let neighbors = 0;

        for (let j = 0; j < NUM; j++) {
          if (i === j) continue;
          const o = particles[j] as Particle;
          const dx = o.x - p.x;
          const dy = o.y - p.y;
          const dist = dx * dx + dy * dy;
          if (dist < 6400) {
            // 80px radius
            const d = Math.sqrt(dist);
            avgVx += o.vx;
            avgVy += o.vy;
            neighbors++;
            if (d < 25) {
              sepX -= dx / d;
              sepY -= dy / d;
            }
          }
        }

        if (neighbors > 0) {
          p.vx += (avgVx / neighbors - p.vx) * 0.02;
          p.vy += (avgVy / neighbors - p.vy) * 0.02;
        }

        p.vx += sepX * 0.05;
        p.vy += sepY * 0.05;

        // Attract to orbiting points.
        const d1x = ax1 - p.x;
        const d1y = ay1 - p.y;
        const d1 = Math.sqrt(d1x * d1x + d1y * d1y) + 1;
        p.vx += (d1x / d1) * 0.012;
        p.vy += (d1y / d1) * 0.012;

        const d2x = ax2 - p.x;
        const d2y = ay2 - p.y;
        const d2 = Math.sqrt(d2x * d2x + d2y * d2y) + 1;
        p.vx += (d2x / d2) * 0.008;
        p.vy += (d2y / d2) * 0.008;

        // Mouse repulsion.
        const mx = p.x - mouseX;
        const my = p.y - mouseY;
        const md = Math.sqrt(mx * mx + my * my) + 1;
        if (md < 130) {
          p.vx += (mx / md) * 0.5;
          p.vy += (my / md) * 0.5;
        }

        // Speed limit.
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 2.5) {
          p.vx = (p.vx / speed) * 2.5;
          p.vy = (p.vy / speed) * 2.5;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Wrap.
        if (p.x < -20) p.x = W + 20;
        if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20;
        if (p.y > H + 20) p.y = -20;

        // Connections.
        for (let j = i + 1; j < NUM; j++) {
          const o = particles[j] as Particle;
          const dx = o.x - p.x;
          const dy = o.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 65) {
            const alpha = (1 - dist / 65) * 0.18;
            ctx.beginPath();
            ctx.strokeStyle = `hsla(${p.hue}, 84%, 45%, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(o.x, o.y);
            ctx.stroke();
          }
        }

        // Draw dot with glow.
        const glow = 0.45 + Math.sin(time * 3 + i) * 0.15;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 84%, 55%, ${glow})`;
        ctx.shadowColor = `hsla(${p.hue}, 84%, 50%, 0.5)`;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMove);
    };
  }, [canvasRef]);
}
