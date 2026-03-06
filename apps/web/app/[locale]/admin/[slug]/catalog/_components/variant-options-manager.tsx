"use client";

import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import LazyImage from "@/components/shared/lazy-image";
import { Link } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";

type VariantOptionItem = {
  id: string;
  optionKey: string;
  optionName: string;
  values: string[];
  valueItems?: Array<{
    value: string;
    thumbnailUrl?: string;
  }>;
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Unknown error");

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && "error" in data && String(data.error)) ||
      "Request failed";
    throw new Error(message);
  }

  return data as T;
}

type Props = {
  shopSlug: string;
};

export function VariantOptionsManager({ shopSlug }: Props) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [newOptionName, setNewOptionName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const queryKey = ["tenant-variant-options", shopSlug];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () =>
      apiRequest<{ items: VariantOptionItem[] }>(`/api/admin/${shopSlug}/variant-options`),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { optionName: string }) =>
      apiRequest<{ item: VariantOptionItem }>(`/api/admin/${shopSlug}/variant-options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setNewOptionName("");
      queryClient.invalidateQueries({ queryKey });
      toast.success(t("adminVariantOptions.toasts.optionAdded"));
    },
    onError: (error: Error) => {
      if (error.message === "NOT_FOUND") {
        toast.error(t("adminVariantOptions.toasts.apiNotFound"));
        return;
      }
      toast.error(error.message || t("adminVariantOptions.toasts.optionAddFailed"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { optionId: string; optionName: string }) =>
      apiRequest<{ item: VariantOptionItem }>(
        `/api/admin/${shopSlug}/variant-options/${payload.optionId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ optionName: payload.optionName }),
        },
      ),
    onSuccess: () => {
      setEditingId(null);
      setEditingName("");
      queryClient.invalidateQueries({ queryKey });
      toast.success(t("adminVariantOptions.toasts.optionUpdated"));
    },
    onError: (error: Error) => {
      toast.error(error.message || t("adminVariantOptions.toasts.optionUpdateFailed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (optionId: string) =>
      apiRequest<{ success: boolean }>(`/api/admin/${shopSlug}/variant-options/${optionId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(t("adminVariantOptions.toasts.optionRemoved"));
    },
    onError: (error: Error) => {
      toast.error(error.message || t("adminVariantOptions.toasts.optionRemoveFailed"));
    },
  });

  const items = data?.items ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>{t("adminVariantOptions.title")}</CardTitle>
              <CardDescription>{t("adminVariantOptions.description")}</CardDescription>
            </div>
            <Link href={`/admin/${shopSlug}/catalog`}>
              <Button variant="outline" size="sm">
                {t("adminVariantOptions.actions.backToCatalog")}
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-2">
              <Label htmlFor="new-option-name">{t("adminVariantOptions.newOptionName")}</Label>
              <div className="flex gap-2">
                <Input
                  id="new-option-name"
                  value={newOptionName}
                  onChange={(event) => setNewOptionName(event.target.value)}
                  placeholder={t("adminVariantOptions.newOptionPlaceholder")}
                />
                <Button
                  type="button"
                  onClick={() =>
                    createMutation.mutate({
                      optionName: newOptionName.trim(),
                    })
                  }
                  disabled={!newOptionName.trim() || createMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("adminVariantOptions.actions.add")}
                </Button>
              </div>
            </div>

            {isLoading ? (
              <p className="text-sm text-slate-500">{t("adminVariantOptions.loading")}</p>
            ) : error ? (
              <p className="text-sm text-destructive">
                {t("adminVariantOptions.loadFailed", { error: errorMessage(error) })}
              </p>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-500">{t("adminVariantOptions.empty")}</p>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const isEditing = editingId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-3"
                    >
                      <div className="flex items-center gap-3">
                        {isEditing ? (
                          <Input
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            placeholder={t("adminVariantOptions.optionNamePlaceholder")}
                          />
                        ) : (
                          <div>
                            <div className="font-medium text-slate-900">{item.optionName}</div>
                            <div className="text-xs text-slate-500">
                              {t("adminVariantOptions.keyLabel", { key: item.optionKey })}
                            </div>
                          </div>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() =>
                                  updateMutation.mutate({
                                    optionId: item.id,
                                    optionName: editingName.trim(),
                                  })
                                }
                                disabled={!editingName.trim() || updateMutation.isPending}
                              >
                                {t("adminVariantOptions.actions.save")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditingName("");
                                }}
                              >
                                {t("adminVariantOptions.actions.cancel")}
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingId(item.id);
                                  setEditingName(item.optionName);
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-1" />
                                {t("adminVariantOptions.actions.rename")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                onClick={() => {
                                  const confirmed = window.confirm(
                                    t("adminVariantOptions.deleteConfirm", {
                                      name: item.optionName,
                                    }),
                                  );
                                  if (!confirmed) return;
                                  deleteMutation.mutate(item.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                {t("adminVariantOptions.actions.delete")}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {item.values.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-xs text-slate-600">
                            {t("adminVariantOptions.knownValues")}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(item.valueItems?.length
                              ? item.valueItems
                              : item.values.map((value) => ({ value, thumbnailUrl: undefined })))
                              .slice(0, 10)
                              .map((valueItem) => (
                                <span
                                  key={`${valueItem.value}-${valueItem.thumbnailUrl ?? ""}`}
                                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                                >
                                  {valueItem.thumbnailUrl ? (
                                    <LazyImage
                                      src={valueItem.thumbnailUrl}
                                      alt={valueItem.value}
                                      width={16}
                                      height={16}
                                      className="h-4 w-4 rounded object-cover"
                                    />
                                  ) : null}
                                  {valueItem.value}
                                </span>
                              ))}
                            {item.values.length > 10 ? (
                              <span className="text-xs text-slate-500">
                                {t("adminVariantOptions.moreValues", {
                                  count: item.values.length - 10,
                                })}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">
                          {t("adminVariantOptions.noValuesUsed")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
