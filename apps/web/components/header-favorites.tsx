"use client";

import { useUser } from "@clerk/nextjs";
import { Button } from "@repo/ui/button";
import { Dropdown, DropdownItem } from "@repo/ui/dropdown";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { Link } from "@/i18n/navigation.client";
import LazyImage from "@/components/shared/lazy-image";
import { getProductIdentifier } from "@/lib/api/products";

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

  const { data: favoritesData } = useQuery<{ items: FavoriteItem[] }>({
    queryKey: ["favorites"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/favorites");
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
        console.error("[HeaderFavorites] Error fetching favorites:", error);
        return { items: [] };
      }
    },
    enabled: isSignedIn,
    staleTime: 30_000,
    retry: false, // Don't retry on error to avoid spam
  });

  const favorites = favoritesData?.items ?? [];
  const favoritesCount = favorites.length;

  if (!isSignedIn) {
    return null;
  }

  return (
    <Dropdown
      trigger={
        <Button variant="ghost" size="sm" className="rounded-full">
          <Heart className="h-5 w-5" />
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
                const productIdentifier = getProductIdentifier(item.id, item.slug);
                return (
                  <DropdownItem key={item.id} asChild>
                    <Link
                      href={`/${productIdentifier}`}
                      className="flex items-start gap-3 p-3 hover:bg-slate-50 transition-colors"
                    >
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
                          {item.price} {item.currency}
                        </p>
                      </div>
                    </Link>
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
