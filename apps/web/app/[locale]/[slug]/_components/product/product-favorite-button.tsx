"use client";

import { useUser } from "@clerk/nextjs";
import { Button } from "@repo/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { dispatchFavoritesUpdated } from "@/lib/favorites-sync";
import { cn } from "@/lib/utils";

type Props = {
  productId: string;
};

export function ProductFavoriteButton({ productId }: Props) {
  const { isSignedIn } = useUser();
  const queryClient = useQueryClient();

  // Check if product is favorited
  const { data: favoriteData } = useQuery<{ isFavorited: boolean }>({
    queryKey: ["favorite-check", productId],
    queryFn: async () => {
      const response = await fetch(`/api/favorites/${productId}`);
      if (!response.ok) {
        return { isFavorited: false };
      }
      return response.json();
    },
    enabled: isSignedIn,
    staleTime: 30_000,
  });

  const isFavorited = favoriteData?.isFavorited ?? false;

  const toggleFavorite = useMutation({
    mutationFn: async (favorited: boolean) => {
      const response = await fetch(`/api/favorites/${productId}`, {
        method: favorited ? "POST" : "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update favorite");
      }

      return response.json();
    },
    onSuccess: (_, favorited) => {
      queryClient.setQueryData(["favorite-check", productId], {
        isFavorited: favorited,
      });
      queryClient.invalidateQueries({ queryKey: ["favorites"], refetchType: "active" });
      dispatchFavoritesUpdated();
      toast.success(favorited ? "Added to favorites" : "Removed from favorites");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update favorite");
    },
  });

  const handleClick = () => {
    if (!isSignedIn) {
      toast.error("Please sign in to add favorites");
      return;
    }

    toggleFavorite.mutate(!isFavorited);
  };

  if (!isSignedIn) {
    return null; // Don't show button if not signed in
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={toggleFavorite.isPending}
      className={cn(
        "gap-2",
        isFavorited && "bg-red-50 border-red-200 text-red-600 hover:bg-red-100",
      )}
    >
      <Heart className={cn("h-4 w-4", isFavorited && "fill-red-600 text-red-600")} />
      <span>{isFavorited ? "Loved" : "Love"}</span>
    </Button>
  );
}
