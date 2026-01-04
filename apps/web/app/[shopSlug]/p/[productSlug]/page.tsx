"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface ProductDetail {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  variants: {
    id: string;
    sku: string | null;
    price: string;
    currency: string;
  }[];
}

export default function ProductPage({
  params,
}: {
  params: { shopSlug: string; productSlug: string };
}) {
  const { shopSlug, productSlug } = params;
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [adding, setAdding] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    async function loadProduct() {
      try {
        const domain = process.env.NEXT_PUBLIC_DOMAIN;
        const res = await fetch(`${domain}/api/shops/${shopSlug}/products/${productSlug}`);
        if (res.ok) {
          const data = (await res.json()) as ProductDetail;
          setProduct(data);
          if (data.variants?.[0]) {
            setSelectedVariantId(data.variants[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadProduct();
  }, [shopSlug, productSlug]);

  const ensureCart = async (): Promise<string> => {
    const key = `cart:${shopSlug}`;
    const cached = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (cached) return cached;
    const domain = process.env.NEXT_PUBLIC_DOMAIN;
    const res = await fetch(`${domain}/api/shops/${shopSlug}/carts`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to create cart");
    const data = (await res.json()) as { id: string };
    localStorage.setItem(key, data.id);
    return data.id;
  };

  const addToCart = async () => {
    if (!selectedVariantId) return;
    try {
      setAdding(true);
      const cartId = await ensureCart();
      const domain = process.env.NEXT_PUBLIC_DOMAIN;
      const res = await fetch(`${domain}/api/shops/${shopSlug}/carts/${cartId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: selectedVariantId, qty: 1 }),
      });
      if (!res.ok) {
        throw new Error("Failed to add to cart");
      }
      router.push(`/${shopSlug}/cart`);
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return <p className="p-4">Loading…</p>;
  }
  if (!product) {
    return <p className="p-4">Product not found.</p>;
  }
  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">{product.title}</h1>
      {product.description && <p className="text-gray-600">{product.description}</p>}

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-800">Variants</p>
        <div className="flex flex-wrap gap-2">
          {product.variants.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedVariantId(v.id)}
              className={`rounded border px-3 py-2 text-sm ${
                selectedVariantId === v.id
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {v.sku ?? "Default"} • {v.price} {v.currency}
            </button>
          ))}
          {product.variants.length === 0 && (
            <p className="text-sm text-slate-600">No variants available.</p>
          )}
        </div>
      </div>

      <button
        type="button"
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
        onClick={addToCart}
        disabled={!selectedVariantId || adding}
      >
        {adding ? "Adding..." : "Add to cart"}
      </button>
    </div>
  );
}
