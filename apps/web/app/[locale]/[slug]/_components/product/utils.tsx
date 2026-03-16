import { AlertCircle, CheckCircle, Package } from "lucide-react";
import type { ReactNode } from "react";

export type StockStatus = "sold" | "low" | "in_stock" | "unknown" | "out_of_stock";

export function getStockStatus(
  availableQty: number | undefined,
  trackInventory: boolean | undefined,
): StockStatus {
  if (trackInventory === false) {
    return "in_stock";
  }
  if (availableQty === undefined) {
    return "unknown";
  }
  if (availableQty <= 0) {
    return "sold";
  }
  if (availableQty < 10) {
    return "low";
  }
  return "in_stock";
}

export function getAvailabilityIcon(status: StockStatus): ReactNode {
  if (status === "sold" || status === "out_of_stock") {
    return <AlertCircle className="h-5 w-5 text-red-500" />;
  }
  if (status === "low") {
    return <AlertCircle className="h-5 w-5 text-warning" />;
  }
  if (status === "in_stock") {
    return <CheckCircle className="h-5 w-5 text-green-500" />;
  }
  return <Package className="h-5 w-5 text-muted-foreground" />;
}
