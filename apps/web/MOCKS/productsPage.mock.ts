import type { MarketingProduct } from "@/components/marketing/product-card";

export const productCategoriesMock = [
  {
    name: "Art & Collectibles",
    blurb: "Original works, rare finds, and curated collectibles.",
    color: "from-emerald-100 to-white",
  },
  {
    name: "Fashion",
    blurb: "Apparel, accessories, and vintage pieces.",
    color: "from-amber-100 to-white",
  },
  {
    name: "Home & Living",
    blurb: "Furniture, decor, and everyday essentials.",
    color: "from-sky-100 to-white",
  },
  {
    name: "Electronics",
    blurb: "Devices, audio, cameras, and smart tech.",
    color: "from-indigo-100 to-white",
  },
  {
    name: "Jewelry",
    blurb: "Fine, handmade, and statement jewelry.",
    color: "from-rose-100 to-white",
  },
  {
    name: "Sports & Outdoors",
    blurb: "Gear for active, outdoor, and fitness lifestyles.",
    color: "from-cyan-100 to-white",
  },
  {
    name: "Books & Media",
    blurb: "Books, vinyl, and collectible media.",
    color: "from-violet-100 to-white",
  },
  {
    name: "Handmade Crafts",
    blurb: "Artisan goods from independent makers.",
    color: "from-orange-100 to-white",
  },
];

export const productPicksMock: MarketingProduct[] = [
  {
    id: "p1",
    slug: "midnight-desk-set",
    title: "Midnight Desk Set",
    price: 210,
    vendor: "Desk Lab",
    image: "https://picsum.photos/id/1051/800/800",
    href: "/demo-shop/midnight-desk-set",
  },
  {
    id: "p2",
    slug: "vintage-illustration",
    title: "Vintage Illustration",
    price: 0,
    vendor: "Modern Gallery",
    image: "https://picsum.photos/id/1047/800/800",
    isAuction: true,
    currentBid: 128,
    endsAt: new Date(Date.now() + 1 * 60 * 60 * 1000 + 20 * 60 * 1000).toISOString(),
    tag: "Live now",
    href: "/demo-shop/vintage-illustration",
  },
  {
    id: "p3",
    slug: "sculpted-planter-duo",
    title: "Sculpted Planter Duo",
    price: 58,
    vendor: "Eco Living",
    image: "https://picsum.photos/id/1048/800/800",
    tag: "New",
    href: "/demo-shop/sculpted-planter-duo",
  },
];
