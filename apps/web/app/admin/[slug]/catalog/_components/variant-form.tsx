"use client";

import { Button } from "@repo/ui/button";
import { Card, CardContent } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Plus, X } from "lucide-react";
import type { VariantFormData } from "./product-form.schema";

type Variant = VariantFormData;

type Props = {
  variants: Partial<Variant>[];
  onVariantsChange: (variants: Partial<Variant>[]) => void;
  isAuction: boolean;
};

export function VariantForm({ variants, onVariantsChange, isAuction }: Props) {
  const addVariant = () => {
    onVariantsChange([
      ...variants,
      {
        price: "",
        currency: "USD",
        isAuction: isAuction,
        auctionStartBid: "",
        auctionMinIncrement: "",
        auctionBuyNow: "",
        auctionStartsAt: "",
        auctionEndsAt: "",
      },
    ]);
  };

  const removeVariant = (index: number) => {
    onVariantsChange(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof Variant, value: string | boolean) => {
    const updated = [...variants];
    if (updated[index]) {
      updated[index] = { ...updated[index], [field]: value };
    }
    onVariantsChange(updated);
  };

  return (
    <div className="space-y-4">
      {variants.map((variant, index) => (
        <Card key={variant.sku || index}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-4">
              <h4 className="font-semibold">Variant {index + 1}</h4>
              {variants.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeVariant(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`sku-${index}`}>SKU (optional)</Label>
                <Input
                  id={`sku-${index}`}
                  value={variant.sku || ""}
                  onChange={(e) => updateVariant(index, "sku", e.target.value)}
                  placeholder="SKU-001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`currency-${index}`}>Currency</Label>
                <Input
                  id={`currency-${index}`}
                  value={variant.currency}
                  onChange={(e) => updateVariant(index, "currency", e.target.value)}
                  placeholder="USD"
                />
              </div>
            </div>

            {isAuction ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`startBid-${index}`}>Starting Bid *</Label>
                    <Input
                      id={`startBid-${index}`}
                      type="number"
                      step="0.01"
                      value={variant.auctionStartBid || ""}
                      onChange={(e) => updateVariant(index, "auctionStartBid", e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`minIncrement-${index}`}>Min Increment *</Label>
                    <Input
                      id={`minIncrement-${index}`}
                      type="number"
                      step="0.01"
                      value={variant.auctionMinIncrement || ""}
                      onChange={(e) => updateVariant(index, "auctionMinIncrement", e.target.value)}
                      placeholder="1.00"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`buyNow-${index}`}>Buy Now Price (optional)</Label>
                  <Input
                    id={`buyNow-${index}`}
                    type="number"
                    step="0.01"
                    value={variant.auctionBuyNow || ""}
                    onChange={(e) => updateVariant(index, "auctionBuyNow", e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`startsAt-${index}`}>Starts At</Label>
                    <Input
                      id={`startsAt-${index}`}
                      type="datetime-local"
                      value={variant.auctionStartsAt || ""}
                      onChange={(e) => updateVariant(index, "auctionStartsAt", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`endsAt-${index}`}>Ends At</Label>
                    <Input
                      id={`endsAt-${index}`}
                      type="datetime-local"
                      value={variant.auctionEndsAt || ""}
                      onChange={(e) => updateVariant(index, "auctionEndsAt", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <Label htmlFor={`price-${index}`}>Price *</Label>
                <Input
                  id={`price-${index}`}
                  type="number"
                  step="0.01"
                  value={variant.price}
                  onChange={(e) => updateVariant(index, "price", e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Button type="button" variant="outline" onClick={addVariant} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Add Variant
      </Button>
    </div>
  );
}
