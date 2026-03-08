"use server";

import { auth } from "@clerk/nextjs/server";
import { env } from "@repo/shared";

export type UserShippingAddress = {
  id: string;
  label: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  addressLine1: string;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UserShippingAddressInput = {
  label?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  addressLine1: string;
  city: string;
  region?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
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

async function backendRequest(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
  } = {},
): Promise<Response> {
  const token = await getAuthToken();
  const url = `${env.BACKEND_URL}/api${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
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

export async function getMyShippingAddresses(): Promise<UserShippingAddress[]> {
  const response = await backendRequest("/users/me/addresses");
  if (response.status === 401) return [];
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "Failed to load addresses"));
  }

  const payload = (await response.json()) as { addresses?: UserShippingAddress[] };
  return payload.addresses ?? [];
}

export async function createMyShippingAddress(
  input: UserShippingAddressInput,
): Promise<UserShippingAddress> {
  const response = await backendRequest("/users/me/addresses", {
    method: "POST",
    body: input,
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "Failed to save address"));
  }

  const payload = (await response.json()) as { address?: UserShippingAddress };
  if (!payload.address) {
    throw new Error("Failed to save address");
  }
  return payload.address;
}

export async function updateMyShippingAddress(
  addressId: string,
  input: Partial<UserShippingAddressInput>,
): Promise<UserShippingAddress> {
  const response = await backendRequest(`/users/me/addresses/${addressId}`, {
    method: "PATCH",
    body: input,
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "Failed to update address"));
  }

  const payload = (await response.json()) as { address?: UserShippingAddress };
  if (!payload.address) {
    throw new Error("Failed to update address");
  }
  return payload.address;
}

export async function setDefaultShippingAddress(addressId: string): Promise<UserShippingAddress> {
  return updateMyShippingAddress(addressId, { isDefault: true });
}

export async function deleteMyShippingAddress(addressId: string): Promise<void> {
  const response = await backendRequest(`/users/me/addresses/${addressId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "Failed to delete address"));
  }
}
