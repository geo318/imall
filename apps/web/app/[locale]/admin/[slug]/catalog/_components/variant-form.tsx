"use client";

import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card, CardContent } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Plus, X } from "lucide-react";
import LazyImage from "@/components/shared/lazy-image";
import { DEFAULT_CURRENCY_CODE } from "@/lib/utils/currency";
import type { VariantFormData, VariantOptionPairFormData } from "./product-form.schema";

type Variant = VariantFormData & { id?: string };

type Props = {
  variants: Partial<Variant>[];
  onVariantsChange: (variants: Partial<Variant>[]) => void;
  isAuction: boolean;
  optionLibrary: Array<{
    id: string;
    optionKey: string;
    optionName: string;
    values: string[];
    valueItems?: Array<{
      value: string;
      thumbnailUrl?: string;
    }>;
  }>;
  variantErrors?: Array<Partial<Record<keyof VariantFormData, string>>>;
};

const CUSTOM_OPTION_VALUE = "__custom__";

export function VariantForm({
  variants,
  onVariantsChange,
  isAuction,
  optionLibrary,
  variantErrors = [],
}: Props) {
  const optionByKey = new Map(optionLibrary.map((option) => [option.optionKey, option]));

  const resolveKnownThumbnail = (optionKey: string | undefined, optionValue: string) => {
    if (!optionKey) {
      return undefined;
    }
    const option = optionByKey.get(optionKey);
    if (!option?.valueItems || option.valueItems.length === 0) {
      return undefined;
    }

    const normalizedValue = optionValue.trim().toLowerCase();
    if (!normalizedValue) {
      return undefined;
    }

    const known = option.valueItems.find(
      (item) => item.value.trim().toLowerCase() === normalizedValue && item.thumbnailUrl,
    );
    return known?.thumbnailUrl;
  };

  const addVariant = () => {
    if (isAuction) {
      return;
    }
    onVariantsChange([
      ...variants,
      {
        price: "",
        currency: DEFAULT_CURRENCY_CODE,
        isAuction: isAuction,
        stock: "",
        auctionStartBid: "",
        auctionMinIncrement: "",
        auctionBuyNow: "",
        auctionStartsAt: "",
        auctionEndsAt: "",
        optionPairs: [],
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

  const addOptionPair = (variantIndex: number) => {
    if (optionLibrary.length === 0) {
      return;
    }
    const updated = [...variants];
    const currentVariant = updated[variantIndex];
    if (!currentVariant) {
      return;
    }
    const currentPairs = Array.isArray(currentVariant.optionPairs)
      ? [...currentVariant.optionPairs]
      : [];
    const firstOption = optionLibrary[0];
    currentPairs.push({
      optionName: firstOption?.optionName ?? "",
      optionKey: firstOption?.optionKey ?? undefined,
      optionValue: "",
      optionThumbnail: "",
    });
    updated[variantIndex] = { ...currentVariant, optionPairs: currentPairs };
    onVariantsChange(updated);
  };

  const removeOptionPair = (variantIndex: number, pairIndex: number) => {
    const updated = [...variants];
    const currentVariant = updated[variantIndex];
    if (!currentVariant || !Array.isArray(currentVariant.optionPairs)) {
      return;
    }
    const nextPairs = currentVariant.optionPairs.filter((_, index) => index !== pairIndex);
    updated[variantIndex] = { ...currentVariant, optionPairs: nextPairs };
    onVariantsChange(updated);
  };

  const updateOptionPair = (
    variantIndex: number,
    pairIndex: number,
    field: keyof VariantOptionPairFormData,
    value: string,
  ) => {
    const updated = [...variants];
    const currentVariant = updated[variantIndex];
    if (!currentVariant) {
      return;
    }
    const currentPairs = Array.isArray(currentVariant.optionPairs)
      ? [...currentVariant.optionPairs]
      : [];
    const existingPair = currentPairs[pairIndex] ?? {
      optionName: "",
      optionValue: "",
      optionKey: undefined,
      optionThumbnail: undefined,
    };
    const nextPair: VariantOptionPairFormData = {
      optionName: existingPair.optionName ?? "",
      optionValue: existingPair.optionValue ?? "",
      optionKey: existingPair.optionKey ?? undefined,
      optionThumbnail: existingPair.optionThumbnail ?? undefined,
      [field]: value,
    };
    currentPairs[pairIndex] = nextPair;
    updated[variantIndex] = { ...currentVariant, optionPairs: currentPairs };
    onVariantsChange(updated);
  };

  const updateOptionSelection = (variantIndex: number, pairIndex: number, selected: string) => {
    const updated = [...variants];
    const currentVariant = updated[variantIndex];
    if (!currentVariant) {
      return;
    }

    const currentPairs = Array.isArray(currentVariant.optionPairs)
      ? [...currentVariant.optionPairs]
      : [];
    const existingPair = currentPairs[pairIndex] ?? {
      optionName: "",
      optionValue: "",
      optionKey: undefined,
      optionThumbnail: undefined,
    };

    if (selected === CUSTOM_OPTION_VALUE) {
      currentPairs[pairIndex] = {
        ...existingPair,
        optionName: "",
        optionKey: undefined,
      };
    } else {
      const option = optionByKey.get(selected);
      if (!option) {
        return;
      }
      const knownThumbnail =
        (existingPair.optionThumbnail?.trim() ?? "") ||
        resolveKnownThumbnail(option.optionKey, existingPair.optionValue ?? "");
      currentPairs[pairIndex] = {
        ...existingPair,
        optionName: option.optionName,
        optionKey: option.optionKey,
        optionThumbnail: knownThumbnail || "",
      };
    }

    updated[variantIndex] = { ...currentVariant, optionPairs: currentPairs };
    onVariantsChange(updated);
  };

  const updateOptionValue = (variantIndex: number, pairIndex: number, value: string) => {
    const updated = [...variants];
    const currentVariant = updated[variantIndex];
    if (!currentVariant) {
      return;
    }

    const currentPairs = Array.isArray(currentVariant.optionPairs)
      ? [...currentVariant.optionPairs]
      : [];
    const existingPair = currentPairs[pairIndex] ?? {
      optionName: "",
      optionValue: "",
      optionKey: undefined,
      optionThumbnail: undefined,
    };

    const hasManualThumbnail = Boolean(existingPair.optionThumbnail?.trim());
    const knownThumbnail = resolveKnownThumbnail(existingPair.optionKey, value);
    currentPairs[pairIndex] = {
      ...existingPair,
      optionValue: value,
      optionThumbnail: hasManualThumbnail ? existingPair.optionThumbnail : knownThumbnail || "",
    };

    updated[variantIndex] = { ...currentVariant, optionPairs: currentPairs };
    onVariantsChange(updated);
  };

  return (
    <div className="space-y-4">
      {variants.map((variant, index) => {
        const label = isAuction ? "Auction setup" : `Variant ${index + 1}`;
        const errors = variantErrors[index] ?? {};
        const optionPairs = Array.isArray(variant.optionPairs) ? variant.optionPairs : [];
        return (
          <Card
            key={variant.id ?? index}
            className={isAuction ? "border-2 border-amber-400 bg-amber-50/40" : undefined}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">{label}</h4>
                  {isAuction && <Badge className="bg-amber-100 text-amber-900">Auction</Badge>}
                </div>
                {variants.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeVariant(index)}
                    disabled={isAuction}
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
                  {errors.sku ? <p className="text-xs text-destructive">{errors.sku}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`currency-${index}`}>Currency</Label>
                  <Input
                    id={`currency-${index}`}
                    value={variant.currency ?? ""}
                    onChange={(e) => updateVariant(index, "currency", e.target.value)}
                    placeholder={DEFAULT_CURRENCY_CODE}
                  />
                  {errors.currency ? (
                    <p className="text-xs text-destructive">{errors.currency}</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Variant options</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addOptionPair(index)}
                    className="h-8 px-2"
                    disabled={optionLibrary.length === 0}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add option
                  </Button>
                </div>

                {optionLibrary.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No tenant options found. Create them in Catalog - Variant options first.
                  </p>
                ) : optionPairs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Add attributes like color, size, or storage for this variant.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {optionPairs.map((pair, pairIndex) => (
                      <div
                        key={`variant-option-pair-${index}-${pairIndex}`}
                        className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_1fr_1.2fr_auto]"
                      >
                        <Select
                          value={
                            pair.optionKey && optionByKey.has(pair.optionKey)
                              ? pair.optionKey
                              : CUSTOM_OPTION_VALUE
                          }
                          onValueChange={(value) => updateOptionSelection(index, pairIndex, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                          <SelectContent>
                            {optionLibrary.map((option) => (
                              <SelectItem key={option.id} value={option.optionKey}>
                                {option.optionName}
                              </SelectItem>
                            ))}
                            <SelectItem value={CUSTOM_OPTION_VALUE}>Custom name</SelectItem>
                          </SelectContent>
                        </Select>
                        {pair.optionKey && optionByKey.has(pair.optionKey) ? (
                          <Input disabled value={pair.optionName ?? ""} placeholder="Option name" />
                        ) : (
                          <Input
                            value={pair.optionName ?? ""}
                            onChange={(e) =>
                              updateOptionPair(index, pairIndex, "optionName", e.target.value)
                            }
                            placeholder="Option name"
                          />
                        )}
                        <Input
                          value={pair.optionValue ?? ""}
                          onChange={(e) => updateOptionValue(index, pairIndex, e.target.value)}
                          placeholder="Option value (e.g. Red)"
                          list={`variant-option-values-${index}-${pairIndex}`}
                        />
                        <div className="space-y-1">
                          <Input
                            value={pair.optionThumbnail ?? ""}
                            onChange={(e) =>
                              updateOptionPair(index, pairIndex, "optionThumbnail", e.target.value)
                            }
                            placeholder="Thumbnail URL (optional)"
                          />
                          {pair.optionThumbnail ? (
                            <LazyImage
                              src={pair.optionThumbnail}
                              alt={`${pair.optionValue || "Option"} thumbnail`}
                              width={32}
                              height={32}
                              className="h-8 w-8 rounded object-cover border border-slate-200"
                            />
                          ) : null}
                        </div>
                        <datalist id={`variant-option-values-${index}-${pairIndex}`}>
                          {(pair.optionKey && optionByKey.get(pair.optionKey)?.valueItems
                            ? optionByKey.get(pair.optionKey)?.valueItems
                            : (pair.optionKey && optionByKey.get(pair.optionKey)?.values
                                ? optionByKey
                                    .get(pair.optionKey)
                                    ?.values.map((value) => ({ value, thumbnailUrl: undefined }))
                                : [])
                          )?.map((item) => (
                            <option
                              key={`${item.value}-${item.thumbnailUrl ?? ""}`}
                              value={item.value}
                            />
                          ))}
                        </datalist>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOptionPair(index, pairIndex)}
                          className="text-destructive hover:text-destructive h-9 w-9 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {errors.optionPairs ? (
                  <p className="text-xs text-destructive">{errors.optionPairs}</p>
                ) : null}
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
                      {errors.auctionStartBid ? (
                        <p className="text-xs text-destructive">{errors.auctionStartBid}</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`minIncrement-${index}`}>Min Increment *</Label>
                      <Input
                        id={`minIncrement-${index}`}
                        type="number"
                        step="0.01"
                        value={variant.auctionMinIncrement || ""}
                        onChange={(e) =>
                          updateVariant(index, "auctionMinIncrement", e.target.value)
                        }
                        placeholder="1.00"
                        required
                      />
                      {errors.auctionMinIncrement ? (
                        <p className="text-xs text-destructive">{errors.auctionMinIncrement}</p>
                      ) : null}
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
                    {errors.auctionBuyNow ? (
                      <p className="text-xs text-destructive">{errors.auctionBuyNow}</p>
                    ) : null}
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
                      {errors.auctionStartsAt ? (
                        <p className="text-xs text-destructive">{errors.auctionStartsAt}</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`endsAt-${index}`}>Ends At</Label>
                      <Input
                        id={`endsAt-${index}`}
                        type="datetime-local"
                        value={variant.auctionEndsAt || ""}
                        onChange={(e) => updateVariant(index, "auctionEndsAt", e.target.value)}
                      />
                      {errors.auctionEndsAt ? (
                        <p className="text-xs text-destructive">{errors.auctionEndsAt}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`price-${index}`}>Price *</Label>
                    <Input
                      id={`price-${index}`}
                      type="number"
                      step="0.01"
                      value={variant.price ?? ""}
                      onChange={(e) => updateVariant(index, "price", e.target.value)}
                      placeholder="0.00"
                      required
                    />
                    {errors.price ? (
                      <p className="text-xs text-destructive">{errors.price}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`stock-${index}`}>Stock Qty</Label>
                    <Input
                      id={`stock-${index}`}
                      type="number"
                      min="0"
                      step="1"
                      value={variant.stock ?? ""}
                      onChange={(e) => updateVariant(index, "stock", e.target.value)}
                      placeholder="0"
                    />
                    {errors.stock ? (
                      <p className="text-xs text-destructive">{errors.stock}</p>
                    ) : null}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Button
        type="button"
        variant="outline"
        onClick={addVariant}
        className="w-full"
        disabled={isAuction}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Variant
      </Button>
      {isAuction && (
        <p className="text-xs text-muted-foreground">
          Auctions use a single variant. Disable auction mode to add more.
        </p>
      )}
    </div>
  );
}
