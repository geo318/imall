"use client";

import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingNav } from "@/components/marketing-nav";
import { ProductCard } from "@/components/marketing/product-card";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import {
  Calendar,
  CheckCircle,
  MapPin,
  MessageCircle,
  Package,
  Share2,
  ShoppingBag,
  Star,
} from "lucide-react";
import { useMemo, useState } from "react";

type VendorProduct = {
  id: string;
  title: string;
  price: number;
  image: string;
  vendor: string;
  isAuction?: boolean;
  currentBid?: number;
  endsIn?: string;
};

const vendorData = {
  id: "vintage-finds",
  slug: "vintage-finds",
  name: "Vintage Finds Co.",
  tagline: "Curated vintage & antique treasures",
  description:
    "We specialize in hand-picked vintage clothing, accessories, and home décor from the 60s through 90s. Every item is carefully inspected and authenticated.",
  banner: "https://picsum.photos/seed/shop-banner/1600/600",
  logo: "https://picsum.photos/seed/shop-logo/200/200",
  location: "Brooklyn, NY",
  joinedDate: "March 2022",
  rating: 4.9,
  reviewCount: 342,
  salesCount: 1250,
  productCount: 86,
  verified: true,
  categories: ["Vintage Clothing", "Accessories", "Home Décor"],
};

const vendorProducts: VendorProduct[] = [
  {
    id: "v1",
    title: "Vintage Levi's 501 Jeans",
    price: 85,
    image: "https://picsum.photos/seed/shop-prod-1/400/400",
    vendor: "Vintage Finds Co.",
  },
  {
    id: "v2",
    title: "70s Leather Messenger Bag",
    price: 120,
    image: "https://picsum.photos/seed/shop-prod-2/400/400",
    vendor: "Vintage Finds Co.",
    isAuction: true,
    currentBid: 95,
    endsIn: "2h 15m",
  },
  {
    id: "v3",
    title: "Retro Polaroid Camera",
    price: 150,
    image: "https://picsum.photos/seed/shop-prod-3/400/400",
    vendor: "Vintage Finds Co.",
  },
  {
    id: "v4",
    title: "Vintage Record Player",
    price: 280,
    image: "https://picsum.photos/seed/shop-prod-4/400/400",
    vendor: "Vintage Finds Co.",
    isAuction: true,
    currentBid: 220,
    endsIn: "5h 30m",
  },
  {
    id: "v5",
    title: "80s Denim Jacket",
    price: 95,
    image: "https://picsum.photos/seed/shop-prod-5/400/400",
    vendor: "Vintage Finds Co.",
  },
  {
    id: "v6",
    title: "Antique Brass Lamp",
    price: 175,
    image: "https://picsum.photos/seed/shop-prod-6/400/400",
    vendor: "Vintage Finds Co.",
  },
];

type TabOption = "products" | "about" | "reviews";

export function ShopProfileClient({ shopSlug, shopName }: { shopSlug: string; shopName: string }) {
  const [activeTab, setActiveTab] = useState<TabOption>("products");

  const tabContent = useMemo(() => {
    switch (activeTab) {
      case "about":
        return (
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold mb-4">About {vendorData.name}</h2>
            <p className="text-muted-foreground leading-relaxed">{vendorData.description}</p>
          </div>
        );
      case "reviews":
        return (
          <div className="text-center py-12 text-muted-foreground">
            <p>Reviews coming soon...</p>
          </div>
        );
      default:
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {vendorProducts.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                title={product.title}
                price={product.price}
                vendor={product.vendor}
                image={product.image}
                isAuction={product.isAuction}
                currentBid={product.currentBid}
                endsIn={product.endsIn}
              />
            ))}
          </div>
        );
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-slate-50">
      <MarketingNav />

      <div className="relative h-56 md:h-72 lg:h-80">
        <img
          src={vendorData.banner}
          alt={`${vendorData.name} banner`}
          className="h-full w-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 to-transparent" />
      </div>

      <div className="container mx-auto space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="relative -mt-16 md:-mt-20">
          <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg md:flex-row md:items-end">
            <div className="flex items-start gap-4">
              <div className="h-28 w-28 rounded-2xl border-4 border-white bg-slate-100 shadow">
                <img
                  src={vendorData.logo}
                  alt={`${vendorData.name} logo`}
                  className="h-full w-full rounded-2xl object-cover"
                  loading="lazy"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
                    {vendorData.slug === shopSlug ? vendorData.name : shopName}
                  </h1>
                  {vendorData.verified && (
                    <Badge
                      variant="secondary"
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                    >
                      Verified
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{vendorData.tagline}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" className="gap-2">
                <MessageCircle className="h-4 w-4" />
                Contact
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 text-amber-400" />
            <span className="font-semibold text-slate-900">{vendorData.rating}</span>
            <span>({vendorData.reviewCount} reviews)</span>
          </div>
          <div className="flex items-center gap-1">
            <Package className="h-4 w-4" />
            <span>{vendorData.productCount} products</span>
          </div>
          <div className="flex items-center gap-1">
            <ShoppingBag className="h-4 w-4" />
            <span>{vendorData.salesCount} sales</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            <span>{vendorData.location}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>Joined {vendorData.joinedDate}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {vendorData.categories.map((cat) => (
            <Badge key={cat} variant="secondary" className="rounded-full px-3 py-1 text-xs">
              {cat}
            </Badge>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-wrap gap-3 border-b border-slate-200 pb-2">
            {(["products", "about", "reviews"] as TabOption[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
              Showing {vendorProducts.length} listing{vendorProducts.length !== 1 && "s"}
            </div>
          </div>
          <div className="pt-6">{tabContent}</div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
