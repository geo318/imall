import { auth } from "@clerk/nextjs/server";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || `http://localhost:3001`;
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
  if (!token) {
    throw new Error("Unauthorized: Authentication required");
  }

  const headers: HeadersInit = {
    ...(options.headers ?? {}),
  };

  let body: unknown;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    if (!headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
  }

  if (!headers["Authorization"] && !headers.authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${resolveApiPath(path)}`, {
    method: options.method ?? "GET",
    headers,
    body: body as BodyInit | undefined,
  });

  return response;
}
