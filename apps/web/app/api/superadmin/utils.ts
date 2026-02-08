import { env } from "@repo/shared";
import { getSuperadminSession } from "@/lib/superadmin";
import { resolveBackendBase } from "../_utils/backend";

export async function superadminProxy(path: string, init: RequestInit = {}) {
  const session = await getSuperadminSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const headers = new Headers(init.headers ?? {});
  headers.set("X-Superadmin-Email", env.SUPERADMIN_EMAIL);
  headers.set("X-Superadmin-Password", env.SUPERADMIN_PASSWORD);

  const response = await fetch(`${resolveBackendBase()}/api${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  return response;
}
