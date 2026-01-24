import axios from "axios";
import { tryCatch } from "../utils";

export type CartItem = {
  id: string;
  qty: number;
  availableQty?: number;
  variantId?: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  productImageUrl?: string | null;
  price: string;
  currency: string;
  sku: string | null;
};

export type Cart = {
  id: string;
  status: string;
  items: CartItem[];
};

export async function createCart(): Promise<{ id: string }> {
  const [data, error] = await tryCatch(axios.post<{ id: string }>(`/api/carts`));

  if (error) {
    if (axios.isAxiosError(error)) {
      console.error("[Cart Service] Create cart error:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        message: error.message,
      });
      const message =
        typeof error.response?.data === "string"
          ? error.response.data
          : error.response?.data?.error || error.response?.data?.message || error.message;
      throw new Error(message || "Failed to create cart");
    }
    throw new Error("Failed to create cart");
  }

  return data.data;
}

export async function getCart(cartId: string): Promise<Cart> {
  const [data, error] = await tryCatch(axios.get<Cart>(`/api/carts/${cartId}`));

  if (error) {
    if (axios.isAxiosError(error)) {
      console.error("[Cart Service] Get cart error:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        message: error.message,
      });
      const message =
        typeof error.response?.data === "string"
          ? error.response.data
          : error.response?.data?.error || error.response?.data?.message || error.message;

      // If cart not found (404), return a more specific error
      if (error.response?.status === 404) {
        throw new Error(message || "Cart not found");
      }

      throw new Error(message || "Failed to load cart");
    }
    throw new Error("Failed to load cart");
  }

  return data.data;
}

export async function addToCart(cartId: string, variantId: string, qty: number): Promise<void> {
  const [, error] = await tryCatch(axios.post(`/api/carts/${cartId}/items`, { variantId, qty }));

  if (error) {
    if (axios.isAxiosError(error)) {
      const message =
        typeof error.response?.data === "string"
          ? error.response.data
          : error.response?.data?.error || error.response?.data?.message || error.message;
      throw new Error(message || "Failed to add to cart");
    }
    throw new Error("Failed to add to cart");
  }
}

export async function checkoutCart(cartId: string): Promise<void> {
  const [, error] = await tryCatch(axios.post(`/api/carts/${cartId}/checkout`));

  if (error) {
    if (axios.isAxiosError(error)) {
      const message =
        typeof error.response?.data === "string"
          ? error.response.data
          : error.response?.data?.error || error.response?.data?.message || error.message;
      throw new Error(message || "Checkout failed");
    }
    throw new Error("Checkout failed");
  }
}

export async function updateCartItemQty(
  cartId: string,
  itemId: string,
  qty: number,
): Promise<void> {
  const [, error] = await tryCatch(axios.patch(`/api/carts/${cartId}/items/${itemId}`, { qty }));

  if (error) {
    if (axios.isAxiosError(error)) {
      const message =
        typeof error.response?.data === "string"
          ? error.response.data
          : error.response?.data?.error || error.response?.data?.message || error.message;
      throw new Error(message || "Failed to update cart item");
    }
    throw new Error("Failed to update cart item");
  }
}

export async function removeCartItem(cartId: string, itemId: string): Promise<void> {
  const [, error] = await tryCatch(axios.delete(`/api/carts/${cartId}/items/${itemId}`));

  if (error) {
    if (axios.isAxiosError(error)) {
      const message =
        typeof error.response?.data === "string"
          ? error.response.data
          : error.response?.data?.error || error.response?.data?.message || error.message;
      throw new Error(message || "Failed to remove cart item");
    }
    throw new Error("Failed to remove cart item");
  }
}
