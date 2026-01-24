"use client";

import { Badge } from "@repo/ui/badge";
import { Gavel } from "lucide-react";
import Link from "next/link";
import LazyImage from "@/components/shared/lazy-image";
import { AuctionTimer } from "./auction-timer";

export type MarketingProduct = {
  id: string;
  slug: string;
  title: string;
  price?: number | null;
  currency?: string | null;
  vendor: string;
  image: string;
  isAuction?: boolean;
  currentBid?: number;
  endsAt?: string; // ISO string for auction end time
  tag?: string;
  href?: string;
};

export function ProductCard({
  title,
  price,
  currency,
  vendor,
  image,
  isAuction,
  currentBid,
  endsAt,
  href,
  tag,
}: MarketingProduct) {
  return (
    <Link href={href ?? "/products"} className="group block" prefetch>
      <div className="card-hover relative overflow-hidden rounded-2xl bg-card border border-border/50">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-secondary">
          {image ? (
            <LazyImage
              src={image}
              alt={title}
              width={400}
              height={400}
              className="transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No image
            </div>
          )}
          {(isAuction || tag) && (
            <Badge className="absolute top-3 left-3 bg-amber-200 text-amber-950 gap-1 z-10">
              <Gavel className="h-3 w-3" />
              {tag ?? "Auction"}
            </Badge>
          )}
        </div>
        {/* Content */}
        <div className="p-4">
          <p className="text-xs text-muted-foreground mb-1">{vendor}</p>
          <h3 className="font-semibold text-sm line-clamp-2 mb-2 group-hover:text-emerald-700 transition-colors">
            {title}
          </h3>
          {isAuction ? (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Current bid</span>
                <span className="font-bold text-emerald-700">
                  {currentBid !== undefined && currentBid !== null
                    ? `$${currentBid.toFixed(2)}`
                    : "View"}
                </span>
              </div>
              {endsAt && <AuctionTimer endsAt={endsAt} />}
            </div>
          ) : (
            <p className="font-bold text-lg">
              {price !== undefined && price !== null ? `$${price.toFixed(2)}` : "View product"}
              {currency ? (
                <span className="ml-1 text-sm text-muted-foreground">{currency}</span>
              ) : null}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
