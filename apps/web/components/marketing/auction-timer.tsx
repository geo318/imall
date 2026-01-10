"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  endsAt: string;
};

/**
 * Client component that calculates and displays time remaining for an auction
 */
export function AuctionTimer({ endsAt }: Props) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    const updateTimer = () => {
      const endsAtTime = new Date(endsAt).getTime();
      if (!Number.isFinite(endsAtTime)) {
        setTimeLeft(null);
        return;
      }

      const diffMs = endsAtTime - Date.now();
      if (diffMs <= 0) {
        setTimeLeft("soon");
        return;
      }

      const totalMinutes = Math.floor(diffMs / 60_000);
      const days = Math.floor(totalMinutes / (60 * 24));
      const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
      const mins = totalMinutes % 60;

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${mins}m`);
      } else {
        setTimeLeft(`${mins}m`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
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
