"use server";

import { auth } from "@clerk/nextjs/server";
import { env } from "@repo/shared";

export type UserOrder = {
  id: string;
  tenantId: string;
  shopSlug: string | null;
  shopName: string | null;
  status: string | null;
  paymentMethod: string;
  total: string;
  currency: string;
  createdAt: string;
  itemCount: number;
};

async function getAuthToken(): Promise<string | null> {
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
        // Token not available
      }
    }

    return token;
  } catch {
    return null;
  }
}

async function backendRequest(path: string): Promise<Response> {
  const token = await getAuthToken();
  const url = `${env.BACKEND_URL}/api${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, {
    method: "GET",
    headers,
  });
}

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  const raw = await response.text();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as { error?: string; message?: string };
    return parsed.error || parsed.message || fallback;
  } catch {
    return raw || fallback;
  }
}

export async function getMyOrders(): Promise<UserOrder[]> {
  const response = await backendRequest("/users/me/orders");
  if (response.status === 401) return [];
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "Failed to load orders"));
  }

  const payload = (await response.json()) as { orders?: UserOrder[] };
  return payload.orders ?? [];
}
