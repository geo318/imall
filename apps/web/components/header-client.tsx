"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation.client";
import { Header } from "./header";

export function HeaderClient() {
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const { data: shops } = useQuery({
    queryKey: ["my-shops"],
    queryFn: async () => {
      const response = await fetch("/api/shops/mine");
      if (!response.ok) {
        return [];
      }
      return response.json();
    },
    enabled: Boolean(isSignedIn),
    staleTime: 60_000,
    retry: false,
  });

  const primaryShopSlug = Array.isArray(shops) ? shops[0]?.slug : undefined;

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <Header
      isSignedIn={isSignedIn}
      signOut={handleSignOut}
      primaryShopSlug={primaryShopSlug ?? null}
    />
  );
}
