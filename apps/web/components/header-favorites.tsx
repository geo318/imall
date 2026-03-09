"use client";

import { useUser } from "@clerk/nextjs";
import { Button } from "@repo/ui/button";
import { Dropdown, DropdownItem } from "@repo/ui/dropdown";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { useEffect } from "react";
import LazyImage from "@/components/shared/lazy-image";
import { useRouter } from "@/i18n/navigation.client";
import { getProductIdentifier } from "@/lib/api/products";
import { FAVORITES_UPDATED_EVENT } from "@/lib/favorites-sync";
import { formatCurrencyAmount } from "@/lib/utils/currency";

type FavoriteItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  tenantSlug: string;
  tenantName: string;
  price: string;
  currency: string;
  imageUrl: string | null;
  favoritedAt: Date | string | null;
};

export function HeaderFavorites() {
  const { isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: favoritesData } = useQuery<{ items: FavoriteItem[] }>({
    queryKey: ["favorites"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/favorites", { cache: "no-store" });
        if (!response.ok) {
          return { items: [] };
        }
        const data = await response.json();
        // Ensure data has the expected structure
        if (!data || typeof data !== "object") {
          return { items: [] };
        }
        return {
          items: Array.isArray(data.items) ? data.items : [],
        };
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[HeaderFavorites] Error fetching favorites:", error);
        }
        return { items: [] };
      }
    },
    enabled: isSignedIn,
    staleTime: 0,
    retry: false, // Don't retry on error to avoid spam
  });

  useEffect(() => {
    if (!isSignedIn) return;

    const refetchFavorites = () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"], refetchType: "active" });
    };

    window.addEventListener(FAVORITES_UPDATED_EVENT, refetchFavorites);
    return () => window.removeEventListener(FAVORITES_UPDATED_EVENT, refetchFavorites);
  }, [isSignedIn, queryClient]);

  const favorites = favoritesData?.items ?? [];
  const favoritesCount = favorites.length;

  const openFavoriteProduct = (item: FavoriteItem) => {
    const productIdentifier = getProductIdentifier(item.id, item.slug);
    if (productIdentifier && productIdentifier !== "unknown") {
      router.push(`/${productIdentifier}`);
      return;
    }
    if (item.tenantSlug) {
      router.push(`/${item.tenantSlug}`);
    }
  };

  if (!isSignedIn) {
    return null;
  }

  return (
    <Dropdown
      trigger={
        <Button variant="ghost" size="sm" className="relative rounded-full" aria-label="Favorites">
          <Heart className="h-5 w-5" />
          {favoritesCount > 0 ? (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
              {favoritesCount}
            </span>
          ) : null}
        </Button>
      }
      triggerAsChild
      align="right"
    >
      <div className="py-1 w-80 max-h-96 overflow-y-auto">
        {favorites.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            <Heart className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p>No favorites yet</p>
            <p className="text-xs mt-1">Start adding products you love!</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-2 border-b border-border">
              <p className="text-sm font-semibold">Favorites ({favoritesCount})</p>
            </div>
            <div className="py-1">
              {favorites.map((item) => {
                return (
                  <DropdownItem
                    key={item.id}
                    onClick={() => openFavoriteProduct(item)}
                    className="items-start p-3"
                  >
                    <div className="flex items-start gap-3">
                      {item.imageUrl ? (
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                          <LazyImage
                            src={item.imageUrl}
                            alt={item.title}
                            width={64}
                            height={64}
                            wrapperContainerStyles="absolute inset-0"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center">
                          <Heart className="h-6 w-6 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-1">{item.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {item.tenantName}
                        </p>
                        <p className="text-sm font-semibold text-emerald-600 mt-1">
                          {formatCurrencyAmount(item.price, item.currency)}
                        </p>
                      </div>
                    </div>
                  </DropdownItem>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Dropdown>
  );
}
