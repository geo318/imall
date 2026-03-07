import type { Product } from "@/lib/types/products";

export type PriceBounds = [number, number];

function toFinitePrice(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : NaN;

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export function getProductMinPrice(product: Product): number | null {
  const variantPrices = product.variants
    .map((variant) => toFinitePrice(variant.price))
    .filter((price): price is number => price !== null);

  if (variantPrices.length > 0) {
    return Math.min(...variantPrices);
  }

  return toFinitePrice(product.priceMin);
}

export function derivePriceBounds(products: Product[]): PriceBounds | null {
  const prices = products
    .map((product) => getProductMinPrice(product))
    .filter((price): price is number => price !== null);

  if (prices.length === 0) {
    return null;
  }

  const min = Math.floor(Math.min(...prices));
  const max = Math.ceil(Math.max(...prices));

  return [min, max];
}

export function clampPriceRange(range: PriceBounds, bounds: PriceBounds): PriceBounds {
  const min = Math.min(Math.max(range[0], bounds[0]), bounds[1]);
  const max = Math.max(Math.min(range[1], bounds[1]), bounds[0]);

  if (min > max) {
    return bounds;
  }

  return [min, max];
}
