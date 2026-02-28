"use client";

import { useRef } from "react";
import { useMurmuration } from "./use-murmuration";

export function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useMurmuration(canvasRef);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="hero-canvas-layer absolute inset-0 h-full w-full"
    />
  );
}
