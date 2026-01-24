"use client";

import { Clock } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";

type Props = {
  endsAt: string;
};

/**
 * Client component that calculates and displays time remaining for an auction
 * Optimized to only update when the display value changes (not every second)
 */
function AuctionTimerComponent({ endsAt }: Props) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const lastDisplayValueRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const updateTimer = () => {
      const endsAtTime = new Date(endsAt).getTime();
      if (!Number.isFinite(endsAtTime)) {
        if (lastDisplayValueRef.current !== null) {
          setTimeLeft(null);
          lastDisplayValueRef.current = null;
        }
        return;
      }

      const diffMs = endsAtTime - Date.now();
      if (diffMs <= 0) {
        const displayValue = "soon";
        if (lastDisplayValueRef.current !== displayValue) {
          setTimeLeft(displayValue);
          lastDisplayValueRef.current = displayValue;
        }
        return;
      }

      const totalMinutes = Math.floor(diffMs / 60_000);
      const days = Math.floor(totalMinutes / (60 * 24));
      const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
      const mins = totalMinutes % 60;

      let displayValue: string;
      if (days > 0) {
        displayValue = `${days}d ${hours}h`;
      } else if (hours > 0) {
        displayValue = `${hours}h ${mins}m`;
      } else {
        displayValue = `${mins}m`;
      }

      // Only update state if the display value actually changed
      // This prevents unnecessary rerenders when the seconds change but the display doesn't
      if (lastDisplayValueRef.current !== displayValue) {
        setTimeLeft(displayValue);
        lastDisplayValueRef.current = displayValue;
      }
    };

    updateTimer();

    // Use a longer interval for product cards (30 seconds) to reduce rerenders
    // Only update more frequently when close to ending (< 1 hour)
    const endsAtTime = new Date(endsAt).getTime();
    const diffMs = endsAtTime - Date.now();
    const intervalMs = diffMs < 60 * 60 * 1000 ? 1000 : 30 * 1000; // 1s if < 1 hour, else 30s

    intervalRef.current = setInterval(updateTimer, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [endsAt]);

  if (!timeLeft) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 text-xs text-amber-700">
      <Clock className="h-3 w-3" />
      <span>Ends in {timeLeft}</span>
    </div>
  );
}

// Memoize to prevent rerenders when parent rerenders
export const AuctionTimer = memo(AuctionTimerComponent);
