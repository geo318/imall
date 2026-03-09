import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import type { InitialHeaderAuth } from "@/lib/header-auth";

function resolveUserDisplayName(user: Awaited<ReturnType<typeof currentUser>>): string | null {
  if (!user) {
    return null;
  }

  return (
    user.firstName ??
    user.username ??
    user.fullName ??
    user.primaryEmailAddress?.emailAddress?.split("@")[0] ??
    null
  );
}

export async function getInitialHeaderAuth(): Promise<InitialHeaderAuth> {
  "use cache: private";

  // In development, avoid request-bound auth reads in the shared layout header
  // so route prerender metadata warnings stay quiet during local navigation.
  // Client-side Clerk hydration still resolves signed-in state immediately after load.
  if (process.env.NODE_ENV === "development") {
    return { isSignedIn: false, userDisplayName: null };
  }

  try {
    const { userId } = await auth();
    if (!userId) {
      return { isSignedIn: false, userDisplayName: null };
    }

    const user = await currentUser();
    return {
      isSignedIn: true,
      userDisplayName: resolveUserDisplayName(user),
    };
  } catch {
    return { isSignedIn: false, userDisplayName: null };
  }
}
