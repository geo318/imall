export const CART_STORAGE_KEY = "cart";
export const CART_STORAGE_UPDATED_EVENT = "imall:cart-storage-updated";

export function readCartIdFromStorage(key: string = CART_STORAGE_KEY): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

export function writeCartIdToStorage(cartId: string, key: string = CART_STORAGE_KEY): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, cartId);
  dispatchCartStorageUpdated(cartId, key);
}

export function clearCartIdFromStorage(key: string = CART_STORAGE_KEY): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
  dispatchCartStorageUpdated(null, key);
}

export function dispatchCartStorageUpdated(
  cartId: string | null,
  key: string = CART_STORAGE_KEY,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CART_STORAGE_UPDATED_EVENT, {
      detail: { key, cartId },
    }),
  );
}
