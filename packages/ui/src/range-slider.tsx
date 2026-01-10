"use client";

import { cn } from "./utils";

export type RangeSliderProps = {
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
};

export function RangeSlider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className,
}: Readonly<RangeSliderProps>) {
  const [lo, hi] = value;
  const left = Math.min(lo, hi);
  const right = Math.max(lo, hi);

  return (
    <div className={cn("space-y-2", className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={left}
        onChange={(e) => {
          const nextLeft = Number(e.target.value);
          onValueChange([Math.min(nextLeft, right), right]);
        }}
        className="w-full accent-[hsl(var(--primary))]"
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={right}
        onChange={(e) => {
          const nextRight = Number(e.target.value);
          onValueChange([left, Math.max(nextRight, left)]);
        }}
        className="w-full accent-[hsl(var(--primary))]"
      />
    </div>
  );
}
