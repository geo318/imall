import type { MarketingProduct } from "@/components/marketing/product-card";

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
