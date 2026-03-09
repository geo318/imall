"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation.client";
import type { InitialHeaderAuth } from "@/lib/header-auth";
import { Header } from "./header";

type HeaderClientProps = {
  initialHeaderAuth: InitialHeaderAuth;
};

export function HeaderClient({ initialHeaderAuth }: HeaderClientProps) {
  const { isLoaded, isSignedIn: clerkIsSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const isSignedIn = isLoaded ? Boolean(clerkIsSignedIn) : initialHeaderAuth.isSignedIn;

  const { data: shops } = useQuery({
    queryKey: ["my-shops"],
    queryFn: async () => {
      const response = await fetch("/api/shops/mine");
      if (!response.ok) {
        return [];
      }
      return response.json();
    },
    enabled: isSignedIn,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const primaryShopSlug = Array.isArray(shops) ? shops[0]?.slug : undefined;
  const liveUserDisplayName =
    user?.firstName ??
    user?.username ??
    user?.fullName ??
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ??
    null;
  const userDisplayName = isLoaded ? liveUserDisplayName : initialHeaderAuth.userDisplayName;
  const isUserNameLoading = isSignedIn && !isLoaded && !initialHeaderAuth.userDisplayName;

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <Header
      isSignedIn={isSignedIn}
      signOut={handleSignOut}
      primaryShopSlug={primaryShopSlug ?? null}
      userDisplayName={userDisplayName}
      isUserNameLoading={isUserNameLoading}
    />
  );
}
