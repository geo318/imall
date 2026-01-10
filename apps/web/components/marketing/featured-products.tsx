import { type MarketingProduct, ProductCard } from "./product-card";

type Props = {
  products: MarketingProduct[];
};

export function FeaturedProducts({ products }: Props) {
  return (
    <section className="py-14 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            Featured <span className="text-gradient">Products</span>
          </h2>
          <p className="mt-2 text-slate-600">
            Discover our handpicked selection of unique items from top vendors
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>
      </div>
    </section>
  );
}
