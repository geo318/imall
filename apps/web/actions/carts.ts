"use server";

import { auth } from "@clerk/nextjs/server";
import { env } from "@repo/shared";

/**
 * Helper to get Clerk token for backend requests
 */
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

/**
 * Helper to make authenticated backend requests
 */
async function backendRequest(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
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

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return response;
}

/**
 * Create a new cart
 */
export async function createCart(): Promise<{ id: string }> {
  const response = await backendRequest("/carts", {
    method: "POST",
  });

  if (!response.ok) {
    const errorData = await response.text();
    let errorMessage = "Failed to create cart";

    try {
      const parsed = JSON.parse(errorData);
      errorMessage = parsed.error || parsed.message || errorMessage;
    } catch {
      errorMessage = errorData || errorMessage;
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Get cart by ID
 */
export async function getCart(cartId: string) {
  const response = await backendRequest(`/carts/${cartId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Cart not found");
    }

    const errorData = await response.text();
    let errorMessage = "Failed to load cart";

    try {
      const parsed = JSON.parse(errorData);
      errorMessage = parsed.error || parsed.message || errorMessage;
    } catch {
      errorMessage = errorData || errorMessage;
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Add item to cart
 */
export async function addToCart(cartId: string, variantId: string, qty: number): Promise<void> {
  const response = await backendRequest(`/carts/${cartId}/items`, {
    method: "POST",
    body: { variantId, qty },
  });

  if (!response.ok) {
    const errorData = await response.text();
    let errorMessage = "Failed to add to cart";

    try {
      const parsed = JSON.parse(errorData);
      errorMessage = parsed.error || parsed.message || errorMessage;
    } catch {
      errorMessage = errorData || errorMessage;
    }

    throw new Error(errorMessage);
  }
}

/**
 * Update cart item quantity
 */
export async function updateCartItemQty(
  cartId: string,
  itemId: string,
  qty: number,
): Promise<void> {
  const response = await backendRequest(`/carts/${cartId}/items/${itemId}`, {
    method: "PATCH",
    body: { qty },
  });

  if (!response.ok) {
    const errorData = await response.text();
    let errorMessage = "Failed to update cart item";

    try {
      const parsed = JSON.parse(errorData);
      errorMessage = parsed.error || parsed.message || errorMessage;
    } catch {
      errorMessage = errorData || errorMessage;
    }

    throw new Error(errorMessage);
  }
}

/**
 * Remove item from cart
 */
export async function removeCartItem(cartId: string, itemId: string): Promise<void> {
  const response = await backendRequest(`/carts/${cartId}/items/${itemId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.text();
    let errorMessage = "Failed to remove cart item";

    try {
      const parsed = JSON.parse(errorData);
      errorMessage = parsed.error || parsed.message || errorMessage;
    } catch {
      errorMessage = errorData || errorMessage;
    }

    throw new Error(errorMessage);
  }
}

/**
 * Checkout cart
 */
export async function checkoutCart(cartId: string): Promise<void> {
  const response = await backendRequest(`/carts/${cartId}/checkout`, {
    method: "POST",
  });

  if (!response.ok) {
    const errorData = await response.text();
    let errorMessage = "Checkout failed";

    try {
      const parsed = JSON.parse(errorData);
      errorMessage = parsed.error || parsed.message || errorMessage;
    } catch {
      errorMessage = errorData || errorMessage;
    }

    throw new Error(errorMessage);
  }
}
