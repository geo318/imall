"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Header } from "./header";

export function HeaderClient() {
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return <Header isSignedIn={isSignedIn} signOut={handleSignOut} />;
}
