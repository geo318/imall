import { auth } from "@clerk/nextjs/server";
import { env } from "@repo/shared";
import { getSuperadminSession } from "@/lib/superadmin";
import { resolveBackendBase } from "../_utils/backend";

const API_BASE = resolveBackendBase();
const API_PREFIX = "/api";

function resolveApiPath(path: string) {
  if (path.startsWith(API_PREFIX)) {
    return path;
  }

  if (path.startsWith("/")) {
    return `${API_PREFIX}${path}`;
  }

  return `${API_PREFIX}/${path}`;
}

async function resolveToken(): Promise<string | null> {
  try {
    const authResult = await auth();
    if (!authResult.userId) {
      return null;
    }

    let token = await authResult.getToken();
    if (!token) {
      try {
        token = await authResult.getToken({
          template: "integration_fallback",
        });
      } catch {
        // Silently continue
      }
    }

    return token;
  } catch {
    return null;
  }
}

export async function getAdminToken(): Promise<string | null> {
  return resolveToken();
}

interface BackendRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  headers?: HeadersInit;
}

export async function backendRequest(path: string, options: BackendRequestOptions = {}) {
  const token = options.token ?? (await resolveToken());
  const session = await getSuperadminSession();
  const hasSuperadmin = Boolean(session);

  if (!token && !hasSuperadmin) {
    throw new Error("Unauthorized: Authentication required");
  }

  const headers = new Headers(options.headers ?? {});

  let body: unknown;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  if (!headers.has("Authorization")) {
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  if (hasSuperadmin && !headers.has("X-Superadmin-Email")) {
    headers.set("X-Superadmin-Email", env.SUPERADMIN_EMAIL);
    headers.set("X-Superadmin-Password", env.SUPERADMIN_PASSWORD);
  }

  const response = await fetch(`${API_BASE}${resolveApiPath(path)}`, {
    method: options.method ?? "GET",
    headers,
    body: body as BodyInit | undefined,
  });

  return response;
}
