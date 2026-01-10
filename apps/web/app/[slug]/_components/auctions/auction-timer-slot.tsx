"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import type { ApiProduct } from "@/lib/services/products.service";
import { cn } from "@/lib/utils";

type Props = {
  auction: NonNullable<ApiProduct["variants"][0]["auction"]>;
};

/**
 * Dynamic slot: Auction timer (needs real-time data)
 */
export function AuctionTimerSlot({ auction }: Props) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isEnding, setIsEnding] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const endsAt = new Date(auction.endsAt).getTime();
      const diff = endsAt - now;

      if (diff <= 0) {
        setTimeLeft("Ended");
        setIsEnding(false);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }

      setIsEnding(diff < 5 * 60 * 1000); // Less than 5 minutes
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [auction.endsAt]);

  const isAuctionEnded = timeLeft === "Ended";

  const getTimerBackground = () => {
    if (isAuctionEnded) return "bg-slate-100";
    if (isEnding) return "bg-destructive/10";
    return "bg-warning/10";
  };

  const getTimerIconColor = () => {
    if (isAuctionEnded) return "text-slate-600";
    if (isEnding) return "text-destructive";
    return "text-warning";
  };

  const getTimerTextColor = () => {
    if (isAuctionEnded) return "text-slate-600";
    if (isEnding) return "text-destructive";
    return "";
  };

  return (
    <div className={cn("flex items-center gap-3 p-4 rounded-xl", getTimerBackground())}>
      <Clock className={cn("h-5 w-5", getTimerIconColor())} />
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">
          {isAuctionEnded ? "Auction status" : "Auction ends in"}
        </p>
        <p className={cn("font-bold text-lg", getTimerTextColor())}>
          {isAuctionEnded ? "Ended" : timeLeft}
        </p>
      </div>
    </div>
  );
}
