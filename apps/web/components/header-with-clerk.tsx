"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "@/i18n/navigation.client";
import { Header } from "./header";

export function HeaderWithClerk() {
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const userDisplayName =
    user?.username ??
    user?.firstName ??
    user?.fullName ??
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ??
    null;

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <Header isSignedIn={isSignedIn} signOut={handleSignOut} userDisplayName={userDisplayName} />
  );
}
