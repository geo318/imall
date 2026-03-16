export type VariantInventoryInput = {
  stock?: string | null | undefined;
  trackInventory?: boolean | undefined;
};

export function resolveTrackInventory(variant: VariantInventoryInput, isAuction: boolean) {
  if (isAuction) {
    return true;
  }
  if (typeof variant.trackInventory === "boolean") {
    return variant.trackInventory;
  }
  if (!variant.stock) {
    return false;
  }
  const qty = Number(variant.stock);
  return Number.isFinite(qty) && qty > 0;
}

export function resolveStockQty(
  variant: VariantInventoryInput,
  isAuction: boolean,
  trackInventory: boolean,
) {
  if (isAuction || !trackInventory || !variant.stock) {
    return 0;
  }
  const qty = Number(variant.stock);
  if (!Number.isFinite(qty) || qty <= 0) {
    return 0;
  }
  return Math.floor(qty);
}
