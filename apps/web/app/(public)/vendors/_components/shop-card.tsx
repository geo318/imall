import { Badge } from "@repo/ui/badge";
import { CheckCircle, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Shop } from "@/lib/server/shops";

type Props = {
  shop: Shop;
};

export function ShopCard({ shop }: Props) {
  return (
    <Link
      href={`/${shop.slug}`}
      className="group bg-white rounded-3xl border border-slate-200/50 p-6 hover:shadow-lg hover:border-emerald-300 transition-all duration-300"
    >
      {/* Vendor Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className="h-16 w-16 rounded-2xl bg-slate-100 ring-2 ring-emerald-500/10 relative overflow-hidden">
          <Image
            src={`https://picsum.photos/seed/${shop.slug}/120/120`}
            alt={shop.name}
            fill
            className="object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg truncate group-hover:text-emerald-600 transition-colors">
              {shop.name}
            </h3>
            <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          </div>
          <p className="text-sm text-slate-500 truncate">{shop.slug}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="font-medium">5.0</span>
          <span className="text-slate-500">(0)</span>
        </div>
      </div>

      {/* Badge */}
      <div className="mt-5 flex items-center justify-between text-sm">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
          View Shop
        </Badge>
      </div>
    </Link>
  );
}
