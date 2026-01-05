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
      <div className="card-hover relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
        <div className="relative aspect-square overflow-hidden bg-slate-100">
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover transition duration-500 group-hover:scale-105"
            sizes="(min-width: 1024px) 25vw, 50vw"
            priority={id === "1"}
          />
          {(isAuction || tag) && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-amber-900">
              <span aria-hidden>⏳</span>
              {tag ?? "Auction"}
            </span>
          )}
        </div>
        <div className="p-4">
          <p className="mb-1 text-xs text-slate-500">{vendor}</p>
          <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 transition-colors group-hover:text-emerald-700">
            {title}
          </h3>
          {isAuction ? (
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-slate-500">Current bid</span>
                <span className="font-semibold text-emerald-700">${currentBid?.toFixed(2)}</span>
              </div>
              {endsIn && (
                <div className="flex items-center gap-1 text-xs text-amber-700">
                  <span aria-hidden>🕒</span>
                  <span>Ends in {endsIn}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {price !== undefined && price !== null
                ? `$${price.toFixed(2)}${currency ? ` ${currency}` : ""}`
                : "View product"}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
