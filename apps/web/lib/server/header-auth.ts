import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import type { InitialHeaderAuth } from "@/lib/header-auth";

function resolveUserDisplayName(user: Awaited<ReturnType<typeof currentUser>>): string | null {
  if (!user) {
    return null;
  }

  return (
    user.username ??
    user.firstName ??
    user.fullName ??
    user.primaryEmailAddress?.emailAddress?.split("@")[0] ??
    null
  );
}

export async function getInitialHeaderAuth(): Promise<InitialHeaderAuth> {
  "use cache: private";

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
