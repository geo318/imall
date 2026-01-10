import { Badge } from "@repo/ui/badge";
import { Clock, Gavel } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export type MarketingProduct = {
  id: string;
  title: string;
  price?: number | null;
  currency?: string | null;
  vendor: string;
  image: string;
  isAuction?: boolean;
  currentBid?: number;
  endsIn?: string;
  tag?: string;
  href?: string;
};

export function ProductCard({
  id,
  title,
  price,
  currency,
  vendor,
  image,
  isAuction,
  currentBid,
  endsIn,
  href,
  tag,
}: MarketingProduct) {
  return (
    <Link href={href ?? "/products"} className="group block" prefetch>
      <div className="card-hover relative overflow-hidden rounded-2xl bg-card border border-border/50">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-secondary">
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover transition duration-500 group-hover:scale-105"
            sizes="(min-width: 1024px) 25vw, 50vw"
            priority={id === "1"}
          />
          {(isAuction || tag) && (
            <Badge className="absolute top-3 left-3 bg-amber-200 text-amber-950 gap-1">
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
              {endsIn && (
                <div className="flex items-center gap-1 text-xs text-amber-700">
                  <Clock className="h-3 w-3" />
                  <span>Ends in {endsIn}</span>
                </div>
              )}
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
