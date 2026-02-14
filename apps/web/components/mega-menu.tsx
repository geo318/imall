"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "@/i18n/navigation.client";

type SubCategory = {
  name: string;
};

export type MegaCategory = {
  name: string;
  icon: string;
  subcategories: SubCategory[];
};

export const megaCategories: MegaCategory[] = [
  {
    name: "Art & Collectibles",
    icon: "🎨",
    subcategories: [
      { name: "Paintings" },
      { name: "Sculptures" },
      { name: "Photography" },
      { name: "Digital Art" },
      { name: "Prints & Posters" },
      { name: "Antiques" },
    ],
  },
  {
    name: "Fashion",
    icon: "👗",
    subcategories: [
      { name: "Women's Clothing" },
      { name: "Men's Clothing" },
      { name: "Shoes" },
      { name: "Bags & Accessories" },
      { name: "Watches" },
      { name: "Vintage Fashion" },
    ],
  },
  {
    name: "Home & Living",
    icon: "🏠",
    subcategories: [
      { name: "Furniture" },
      { name: "Decor" },
      { name: "Kitchen & Dining" },
      { name: "Bedding & Bath" },
      { name: "Lighting" },
      { name: "Storage & Organization" },
    ],
  },
  {
    name: "Electronics",
    icon: "💻",
    subcategories: [
      { name: "Phones & Tablets" },
      { name: "Computers & Laptops" },
      { name: "Audio & Headphones" },
      { name: "Cameras" },
      { name: "Smart Home" },
      { name: "Gaming" },
    ],
  },
  {
    name: "Jewelry",
    icon: "💎",
    subcategories: [
      { name: "Necklaces" },
      { name: "Rings" },
      { name: "Earrings" },
      { name: "Bracelets" },
      { name: "Fine Jewelry" },
      { name: "Handmade" },
    ],
  },
  {
    name: "Sports & Outdoors",
    icon: "⚽",
    subcategories: [
      { name: "Exercise Equipment" },
      { name: "Outdoor Recreation" },
      { name: "Sportswear" },
      { name: "Camping & Hiking" },
      { name: "Cycling" },
      { name: "Water Sports" },
    ],
  },
  {
    name: "Books & Media",
    icon: "📚",
    subcategories: [
      { name: "Fiction" },
      { name: "Non-Fiction" },
      { name: "Vinyl & Records" },
      { name: "Comics & Manga" },
      { name: "Rare & Collectible" },
      { name: "Audiobooks" },
    ],
  },
  {
    name: "Handmade Crafts",
    icon: "✂️",
    subcategories: [
      { name: "Pottery & Ceramics" },
      { name: "Woodworking" },
      { name: "Textiles & Fiber" },
      { name: "Candles & Soaps" },
      { name: "Paper Crafts" },
      { name: "Leatherwork" },
    ],
  },
];

function productsHref(category: string, subcategory?: string) {
  const params = new URLSearchParams();
  params.set("category", category);
  if (subcategory) params.set("sub", subcategory);
  return `/products?${params.toString()}`;
}

type MegaMenuProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function MegaMenu({ isOpen, onClose }: MegaMenuProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(
    megaCategories[0]?.name ?? null,
  );
  const activeCat = megaCategories.find((category) => category.name === activeCategory);

  if (!isOpen || !activeCat) return null;

  return (
    <div
      className="absolute left-0 right-0 top-full z-50 border-b bg-popover shadow-xl"
      role="menu"
      aria-label="Categories mega menu"
      onMouseLeave={onClose}
    >
      <div className="container">
        <div className="flex min-h-[340px]">
          <div className="w-64 shrink-0 border-r bg-muted/30 py-2">
            {megaCategories.map((category) => (
              <button
                key={category.name}
                onMouseEnter={() => setActiveCategory(category.name)}
                type="button"
                className={`w-full px-4 py-2.5 text-sm transition-colors ${
                  activeCategory === category.name
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-3">
                    <span className="text-base">{category.icon}</span>
                    {category.name}
                  </span>
                  <ChevronRight className="h-4 w-4 opacity-50" />
                </span>
              </button>
            ))}
          </div>

          <div className="flex-1 p-6">
            <div className="mb-4">
              <Link
                href={productsHref(activeCat.name)}
                onClick={onClose}
                className="text-lg font-semibold text-foreground transition-colors hover:text-primary"
              >
                {activeCat.name}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">Browse all in {activeCat.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-1 lg:grid-cols-3">
              {activeCat.subcategories.map((subcategory) => (
                <Link
                  key={subcategory.name}
                  href={productsHref(activeCat.name, subcategory.name)}
                  onClick={onClose}
                  className="py-2 text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  {subcategory.name}
                </Link>
              ))}
            </div>

            <div className="mt-6 border-t pt-4">
              <Link
                href={productsHref(activeCat.name)}
                onClick={onClose}
                className="text-sm font-medium text-primary hover:underline"
              >
                See all {activeCat.name} →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
