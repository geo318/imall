import { Footer } from "@/components/footer/footer";
import { MarketingNav } from "@/components/marketing-nav";
import { ShopProducts } from "./shop-products";

type Props = {
  shopSlug: string;
  shopName: string;
};

export function ShopProfileClient({ shopSlug, shopName }: Props) {
  return (
    <div className="min-h-screen bg-slate-50">
      <MarketingNav />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">{shopName}</h1>
          <p className="mt-2 text-slate-600">Shop profile for {shopSlug}</p>
        </div>

        <ShopProducts shopSlug={shopSlug} />
      </div>
      <Footer />
    </div>
  );
}
