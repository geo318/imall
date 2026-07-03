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

async function extractBackendError(
  response: Response,
  fallback: string,
  context: string,
): Promise<string> {
  const raw = await response.text();
  let message = fallback;
  let parsedBody: Record<string, unknown> | null = null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    parsedBody = parsed;
    const parsedError = typeof parsed.error === "string" ? parsed.error : null;
    const parsedMessage = typeof parsed.message === "string" ? parsed.message : null;
    message = parsedError || parsedMessage || message;

    // Prefer specific backend message when the top-level error is generic.
    if (parsedError?.startsWith("Failed to ") && parsedMessage) {
      message = parsedMessage;
    }
  } catch {
    message = raw || message;
  }

  if (process.env.NODE_ENV === "development") {
    console.error(`[carts.actions] ${context} failed`, {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      body: raw || null,
      parsedBody,
      parsedMessage: message,
    });
  }

  return message;
}

function extractActionError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export type CartActionResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };

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
 * Safe server action wrapper for client usage.
 * Returns structured result instead of throwing to avoid hard 500 responses.
 */
export async function createCartSafe(): Promise<CartActionResult<{ id: string }>> {
  try {
    const cart = await createCart();
    return { ok: true, data: cart };
  } catch (error) {
    return {
      ok: false,
      error: extractActionError(error, "Failed to create cart"),
    };
  }
}

/**
 * Get cart by ID
 */
export async function getCart(cartId: string) {
  const response = await backendRequest(`/carts/${cartId}`);

  if (!response.ok) {
    if (response.status === 404 || response.status === 409) {
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
 * Safe server action wrapper for client usage.
 * Returns structured result instead of throwing to avoid hard 500 responses.
 */
export async function addToCartSafe(
  cartId: string,
  variantId: string,
  qty: number,
): Promise<CartActionResult<null>> {
  try {
    await addToCart(cartId, variantId, qty);
    return { ok: true, data: null };
  } catch (error) {
    return {
      ok: false,
      error: extractActionError(error, "Failed to add to cart"),
    };
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

export type StartInstallmentCheckoutInput = {
  provider?: "credo" | "keepz";
  credoVariant?: "zero" | "standard";
  paymentType?: "card" | "installments";
  installmentLength?: number;
  clientFullName?: string;
  mobile?: string;
  email?: string;
  factAddress?: string;
  personalNumber?: string;
  isForeign?: boolean;
};

export type StartInstallmentCheckoutResult = {
  orderCode: string;
  redirectUrl: string;
  provider?: "credo" | "keepz";
  paymentType?: "card" | "installments";
};

export async function startInstallmentCheckout(
  cartId: string,
  payload: StartInstallmentCheckoutInput,
): Promise<StartInstallmentCheckoutResult> {
  console.info("[carts.action] startInstallmentCheckout request", {
    cartId,
    hasClientFullName: Boolean(payload.clientFullName?.trim()),
    hasMobile: Boolean(payload.mobile?.trim()),
    hasEmail: Boolean(payload.email?.trim()),
    hasFactAddress: Boolean(payload.factAddress?.trim()),
    provider: payload.provider ?? "credo",
    paymentType: payload.paymentType ?? "installments",
    hasPersonalNumber: Boolean(payload.personalNumber?.trim()),
    installmentLength: payload.installmentLength ?? null,
  });

  const response = await backendRequest(`/carts/${cartId}/checkout/installments/start`, {
    method: "POST",
    body: payload,
  });

  if (!response.ok) {
    const errorMessage = await extractBackendError(
      response,
      "Failed to start installment checkout",
      "startInstallmentCheckout",
    );
    if (response.status === 404 && errorMessage === "NOT_FOUND") {
      throw new Error("Installment API endpoint not found. Restart API dev server and retry.");
    }
    throw new Error(errorMessage);
  }

  const result = (await response.json()) as StartInstallmentCheckoutResult;
  console.info("[carts.action] startInstallmentCheckout response", {
    cartId,
    orderCode: result.orderCode,
    redirectUrl: result.redirectUrl,
  });
  return result;
}

export type InstallmentStatusResult = {
  orderCode: string;
  statusId: number | null;
  statusName: string;
  checkoutCompleted: boolean;
  statusProvider?: "credo" | "keepz";
};

export async function syncInstallmentCheckoutStatus(
  cartId: string,
  orderCode: string,
  options: {
    provider?: "credo" | "keepz";
    paymentType?: "card" | "installments";
  } = {},
): Promise<InstallmentStatusResult> {
  const response = await backendRequest(`/carts/${cartId}/checkout/installments/status`, {
    method: "POST",
    body: {
      orderCode,
      provider: options.provider,
      paymentType: options.paymentType,
    },
  });

  if (!response.ok) {
    const errorMessage = await extractBackendError(
      response,
      "Failed to check installment status",
      "syncInstallmentCheckoutStatus",
    );
    if (response.status === 404 && errorMessage === "NOT_FOUND") {
      throw new Error("Installment status endpoint not found. Restart API dev server and retry.");
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export type RegisterManualInstallmentSaleInput = {
  provider: "crystal";
  comment?: string;
};

export type RegisterManualInstallmentSaleResult = {
  checkoutCompleted: boolean;
  orders?: Array<{
    orderId: string;
    tenantId: string;
    total: number;
    currency: string;
  }> | null;
};

export async function registerManualInstallmentSale(
  cartId: string,
  payload: RegisterManualInstallmentSaleInput,
): Promise<RegisterManualInstallmentSaleResult> {
  const response = await backendRequest(`/carts/${cartId}/checkout/installments/manual`, {
    method: "POST",
    body: payload,
  });

  if (!response.ok) {
    const errorMessage = await extractBackendError(
      response,
      "Failed to register manual installment sale",
      "registerManualInstallmentSale",
    );
    throw new Error(errorMessage);
  }

  return response.json();
}
