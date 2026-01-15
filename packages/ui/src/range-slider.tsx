"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import React from "react";
import { cn } from "./utils";

interface RangeSliderProps extends React.ComponentProps<typeof SliderPrimitive.Root> {
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  minRange?: number;
}

const RangeSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  RangeSliderProps
>(({ className, value, onValueChange, min, max, step = 1, minRange, disabled, ...props }, ref) => {
  // Ensure values are in correct order (min, max)
  const sortedValue: [number, number] = [
    Math.min(value[0], value[1]),
    Math.max(value[0], value[1]),
  ];

  const handleValueChange = React.useCallback(
    (newValue: number[]) => {
      if (newValue.length === 2) {
        const [low, high] = newValue as [number, number];
        const sorted = [Math.min(low, high), Math.max(low, high)] as [number, number];
        onValueChange(sorted);
      }
    },
    [onValueChange],
  );

  // Calculate minStepsBetweenThumbs based on minRange
  const minStepsBetweenThumbs = minRange !== undefined ? Math.ceil(minRange / step) : 1;

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        "h-6", // Ensure enough height for thumbs
        className,
      )}
      value={sortedValue}
      onValueChange={handleValueChange}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      minStepsBetweenThumbs={minStepsBetweenThumbs}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow rounded-full bg-slate-200 dark:bg-slate-800">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-white shadow-md ring-offset-background transition-colors cursor-grab active:cursor-grabbing hover:border-primary/80 hover:bg-slate-50 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:bg-slate-950 dark:hover:bg-slate-900 pointer-events-auto" />
      <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-white shadow-md ring-offset-background transition-colors cursor-grab active:cursor-grabbing hover:border-primary/80 hover:bg-slate-50 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:bg-slate-950 dark:hover:bg-slate-900 pointer-events-auto" />
    </SliderPrimitive.Root>
  );
});
RangeSlider.displayName = "RangeSlider";

export { RangeSlider };
export type { RangeSliderProps };
