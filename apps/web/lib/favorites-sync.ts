export const FAVORITES_UPDATED_EVENT = "imall:favorites-updated";

export function dispatchFavoritesUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FAVORITES_UPDATED_EVENT));
}
