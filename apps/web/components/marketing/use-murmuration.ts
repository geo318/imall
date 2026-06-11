"use client";

import { type RefObject, useEffect, useRef } from "react";

export type IconNode = {
  x: number;
  y: number;
  icon: string;
  anchor?: "center" | "top" | "bottom";
  renderY?: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
  targetNode: number;
  isIcon: boolean;
  iconGlyph: string | null;
};

type MurmurationSnapshot = {
  savedAt: number;
  particles: Particle[];
  time: number;
  mouseX: number;
  mouseY: number;
};

const DEV_REUSE_WINDOW_MS = 2_000;
const MAX_DPR = 1.5;
let cachedMurmurationSnapshot: MurmurationSnapshot | null = null;

export function useMurmuration(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  iconNodes: ReadonlyArray<IconNode>,
  prefersReducedMotion: boolean,
) {
  const iconNodesRef = useRef<ReadonlyArray<IconNode>>([]);

  useEffect(() => {
    iconNodesRef.current = iconNodes;
  }, [iconNodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const cores = navigator.hardwareConcurrency ?? 8;
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean; downlink?: number } }
    ).connection;
    const isLowEnd =
      isCoarsePointer ||
      Boolean(connection?.saveData) ||
      deviceMemory <= 4 ||
      cores <= 4 ||
      (typeof connection?.downlink === "number" && connection.downlink < 1.5);
    const frameMs = prefersReducedMotion ? 1000 / 24 : isLowEnd ? 1000 / 30 : 1000 / 45;
    const particleCount = prefersReducedMotion ? 72 : isLowEnd ? 120 : 256;
    const iconParticleCount = prefersReducedMotion ? 0 : isLowEnd ? 6 : 14;
    const mouseRepulsionStrength = prefersReducedMotion ? 0.3 : isLowEnd ? 0.38 : 0.45;
    const speedLimit = prefersReducedMotion ? 1.85 : isLowEnd ? 2.1 : 2.45;
    const timeStep = prefersReducedMotion ? 0.0029 : isLowEnd ? 0.00335 : 0.00395;
    const canTrackPointer = !isCoarsePointer && !prefersReducedMotion;

    let animId = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    let lastFrameAt = 0;
    let isPageVisible = !document.hidden;
    let isInViewport = true;
    let observer: IntersectionObserver | null = null;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      // Draw in CSS pixels, not device pixels.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const NUM = particleCount;
    const ICON_PARTICLES = iconParticleCount;
    const ICON_GLYPHS = ["🛒", "🏷️", "📦", "💳", "⭐", "🛍️", "❤️", "🚚", "🏪", "✨", "💎", "🎁"];
    const w = () => canvas.width / dpr;
    const h = () => canvas.height / dpr;
    const canReuseCachedSnapshot =
      cachedMurmurationSnapshot &&
      Date.now() - cachedMurmurationSnapshot.savedAt < DEV_REUSE_WINDOW_MS &&
      cachedMurmurationSnapshot.particles.length === NUM;

    let particles: Particle[] = [];
    if (canReuseCachedSnapshot) {
      particles = (cachedMurmurationSnapshot as MurmurationSnapshot).particles.map((particle) => ({
        ...particle,
      }));
    } else {
      const initialNodes = iconNodesRef.current;
      const hasInitialNodes = initialNodes.length > 0;

      for (let i = 0; i < NUM; i++) {
        const isIcon = i < ICON_PARTICLES;
        const targetNode = hasInitialNodes ? Math.floor(Math.random() * initialNodes.length) : -1;
        let x = Math.random() * w();
        let y = Math.random() * h();

        if (hasInitialNodes && targetNode >= 0 && i < Math.floor(NUM * 0.35)) {
          const node = initialNodes[targetNode] as IconNode;
          const theta = Math.random() * Math.PI * 2;
          const radius = 16 + Math.random() * 34;
          x = node.x + Math.cos(theta) * radius;
          y = node.y + Math.sin(theta) * radius;
        }

        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          size: isIcon ? 2.2 : 1.5 + Math.random() * 2.5,
          hue: 150 + Math.random() * 25,
          targetNode,
          isIcon,
          iconGlyph: isIcon ? (ICON_GLYPHS[i % ICON_GLYPHS.length] ?? "✨") : null,
        });
      }
    }

    let mouseX = canReuseCachedSnapshot
      ? (cachedMurmurationSnapshot as MurmurationSnapshot).mouseX
      : -1000;
    let mouseY = canReuseCachedSnapshot
      ? (cachedMurmurationSnapshot as MurmurationSnapshot).mouseY
      : -1000;
    let time = canReuseCachedSnapshot ? (cachedMurmurationSnapshot as MurmurationSnapshot).time : 0;

    const onMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        mouseX = -1000;
        mouseY = -1000;
        return;
      }
      mouseX = event.clientX - rect.left;
      mouseY = event.clientY - rect.top;
    };

    if (canTrackPointer) {
      window.addEventListener("mousemove", onMove, { passive: true });
    }

    const shouldAnimate = () => isPageVisible && isInViewport;

    const loop = (timestamp: number) => {
      if (!shouldAnimate()) {
        animId = 0;
        return;
      }

      if (lastFrameAt !== 0 && timestamp - lastFrameAt < frameMs) {
        animId = requestAnimationFrame(loop);
        return;
      }

      lastFrameAt = timestamp;
      time += timeStep;
      const W = w();
      const H = h();
      ctx.clearRect(0, 0, W, H);
      const nodes = iconNodesRef.current;

      // Soft halo around icon anchors (adopted from shop-spark).
      for (const node of nodes) {
        const pulse = 0.6 + Math.sin(time * 3 + node.x * 0.01) * 0.4;
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 72);
        gradient.addColorStop(0, `hsla(160, 84%, 45%, ${0.1 * pulse})`);
        gradient.addColorStop(0.5, `hsla(160, 84%, 40%, ${0.03 * pulse})`);
        gradient.addColorStop(1, "hsla(160, 84%, 35%, 0)");
        ctx.beginPath();
        ctx.arc(node.x, node.y, 72, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Two orbiting attractor points.
      const ax1 = W * 0.5 + Math.cos(time * 0.7) * W * 0.25;
      const ay1 = H * 0.4 + Math.sin(time * 0.9) * H * 0.22;
      const ax2 = W * 0.5 + Math.cos(time * 0.5 + 2) * W * 0.3;
      const ay2 = H * 0.6 + Math.sin(time * 0.6 + 1) * H * 0.2;

      for (let i = 0; i < NUM; i++) {
        const p = particles[i] as Particle;

        if ((p.targetNode < 0 || p.targetNode >= nodes.length) && nodes.length > 0) {
          p.targetNode = Math.floor(Math.random() * nodes.length);
        } else if (nodes.length > 0 && Math.random() < 0.002) {
          p.targetNode = Math.floor(Math.random() * nodes.length);
        }

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

        // Primary icon-target orbit force (adopted from shop-spark).
        if (p.targetNode >= 0 && p.targetNode < nodes.length) {
          const node = nodes[p.targetNode] as IconNode;
          const tx = node.x - p.x;
          const ty = node.y - p.y;
          const td = Math.sqrt(tx * tx + ty * ty) + 1;
          p.vx += (tx / td) * 0.014 + (-ty / td) * 0.007;
          p.vy += (ty / td) * 0.014 + (tx / td) * 0.007;
        }

        // Keep local coordinated swarms around each shop icon.
        for (const node of nodes) {
          const nx = node.x - p.x;
          const ny = node.y - p.y;
          const nDistSq = nx * nx + ny * ny;
          if (nDistSq > 1 && nDistSq < 52_900) {
            const nDist = Math.sqrt(nDistSq);
            const inv = 1 / nDist;
            const falloff = 1 - nDist / 230;
            const pull = 0.015 * falloff;
            const swirl = 0.007 * falloff;
            p.vx += nx * inv * pull;
            p.vy += ny * inv * pull;
            p.vx += -ny * inv * swirl;
            p.vy += nx * inv * swirl;
          }
        }

        // Mouse repulsion.
        const mx = p.x - mouseX;
        const my = p.y - mouseY;
        const md = Math.sqrt(mx * mx + my * my) + 1;
        if (md < 130) {
          p.vx += (mx / md) * mouseRepulsionStrength;
          p.vy += (my / md) * mouseRepulsionStrength;
        }

        // Speed limit.
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > speedLimit) {
          p.vx = (p.vx / speed) * speedLimit;
          p.vy = (p.vy / speed) * speedLimit;
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

        // Nearby links to icon anchors (adopted from shop-spark).
        for (const node of nodes) {
          const nx = node.x - p.x;
          const ny = node.y - p.y;
          const nDistSq = nx * nx + ny * ny;
          if (nDistSq < 8_100) {
            const nDist = Math.sqrt(nDistSq);
            const alpha = (1 - nDist / 90) * 0.22;
            ctx.beginPath();
            ctx.strokeStyle = `hsla(160, 84%, 55%, ${alpha})`;
            ctx.lineWidth = 0.7;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(node.x, node.y);
            ctx.stroke();
          }
        }

        if (p.isIcon && p.iconGlyph) {
          const iconAlpha = 0.38 + Math.sin(time * 2.6 + i * 0.45) * 0.14;
          ctx.save();
          ctx.globalAlpha = Math.max(0.22, iconAlpha);
          ctx.font = "13px 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(p.iconGlyph, p.x, p.y);
          ctx.restore();
        } else {
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
      }

      animId = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (animId !== 0 || !shouldAnimate()) return;
      lastFrameAt = 0;
      animId = requestAnimationFrame(loop);
    };

    const stopLoop = () => {
      if (animId === 0) return;
      cancelAnimationFrame(animId);
      animId = 0;
    };

    const onVisibilityChange = () => {
      isPageVisible = !document.hidden;
      if (shouldAnimate()) startLoop();
      else stopLoop();
    };

    document.addEventListener("visibilitychange", onVisibilityChange, { passive: true });

    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          isInViewport = entry?.isIntersecting ?? true;
          if (shouldAnimate()) startLoop();
          else stopLoop();
        },
        { threshold: 0.05 },
      );
      observer.observe(canvas);
    }

    startLoop();

    return () => {
      cachedMurmurationSnapshot = {
        savedAt: Date.now(),
        particles: particles.map((particle) => ({ ...particle })),
        time,
        mouseX,
        mouseY,
      };
      stopLoop();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", resize);
      if (canTrackPointer) {
        window.removeEventListener("mousemove", onMove);
      }
    };
  }, [canvasRef, prefersReducedMotion]);
}
