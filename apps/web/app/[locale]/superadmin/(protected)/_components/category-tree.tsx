"use client";

import { type ReactElement, useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@repo/ui/button";

type CategoryAction = (formData: FormData) => void | Promise<void>;

export type SuperadminCategoryNode = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  parentId: string | null;
  hasChildren: boolean;
};

type CategoryOption = { id: string; name: string };

type Props = {
  roots: SuperadminCategoryNode[];
  createAction: CategoryAction;
  updateAction: CategoryAction;
  deleteAction: CategoryAction;
};

export function SuperadminCategoryTree({
  roots,
  createAction,
  updateAction,
  deleteAction,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [childrenById, setChildrenById] = useState<Record<string, SuperadminCategoryNode[]>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [treeError, setTreeError] = useState<string | null>(null);

  const [options, setOptions] = useState<CategoryOption[] | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);

  const loadOptions = useCallback(async () => {
    if (options || optionsLoading) return;
    setOptionsLoading(true);
    try {
      const res = await fetch("/api/superadmin/categories/list");
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to load categories");
      }
      const data = (await res.json()) as CategoryOption[];
      setOptions(data);
    } catch (error) {
      setTreeError(error instanceof Error ? error.message : "Failed to load categories");
    } finally {
      setOptionsLoading(false);
    }
  }, [options, optionsLoading]);

  const handleToggle = useCallback(
    async (node: SuperadminCategoryNode) => {
      setTreeError(null);
      const nodeKey = node.id || node.slug;
      if (!nodeKey || nodeKey === "undefined") {
        setTreeError("Missing category id");
        return;
      }
      if (expanded.has(nodeKey)) {
        const next = new Set(expanded);
        next.delete(nodeKey);
        setExpanded(next);
        return;
      }

      if (!childrenById[nodeKey]) {
        const nextLoading = new Set(loadingIds);
        nextLoading.add(nodeKey);
        setLoadingIds(nextLoading);
        try {
          const res = await fetch(
            `/api/superadmin/categories/${encodeURIComponent(nodeKey)}/children`,
          );
          if (!res.ok) {
            const message = await res.text();
            throw new Error(message || "Failed to load categories");
          }
          const data = (await res.json()) as SuperadminCategoryNode[];
          setChildrenById((prev) => ({ ...prev, [nodeKey]: data }));
        } catch (error) {
          setTreeError(error instanceof Error ? error.message : "Failed to load categories");
          return;
        } finally {
          setLoadingIds((prev) => {
            const next = new Set(prev);
            next.delete(nodeKey);
            return next;
          });
        }
      }

      setExpanded((prev) => new Set(prev).add(nodeKey));
    },
    [childrenById, expanded, loadingIds],
  );

  const optionRows = useMemo(
    () =>
      (options ?? []).map((category) => ({
        id: category.id,
        name: category.name,
      })),
    [options],
  );

  const renderRows = useCallback(
    (nodes: SuperadminCategoryNode[], depth = 0): ReactElement[] => {
      const rows: ReactElement[] = [];

      for (const node of nodes) {
        const nodeKey = node.id || node.slug;
        const isExpanded = expanded.has(nodeKey);
        const isLoading = loadingIds.has(nodeKey);
        const children = childrenById[nodeKey] ?? [];

        rows.push(
          <tr key={nodeKey} className={node.deletedAt ? "opacity-50" : undefined}>
            <td className="px-4 py-3">
              <div
                style={{ paddingLeft: `${depth * 18}px` }}
                className="flex items-center gap-2 font-medium text-slate-900"
              >
                {node.hasChildren ? (
                  <button
                    type="button"
                    onClick={() => handleToggle(node)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                ) : (
                  <span className="inline-flex h-6 w-6" />
                )}
                {node.name}
              </div>
            </td>
            <td className="px-4 py-3 text-slate-600">{node.slug}</td>
            <td className="px-4 py-3">
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                  node.isActive
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {node.isActive ? "Active" : "Disabled"}
              </span>
            </td>
            <td className="px-4 py-3">
              <form action={updateAction} className="flex flex-wrap gap-2 items-center">
                <input type="hidden" name="id" value={node.id} />
                <input
                  name="name"
                  defaultValue={node.name}
                  className="h-8 rounded-md border border-slate-200 px-2 text-xs"
                  placeholder="Name"
                />
                <input
                  name="slug"
                  defaultValue={node.slug}
                  className="h-8 rounded-md border border-slate-200 px-2 text-xs"
                  placeholder="Slug"
                />
                <select
                  name="parentId"
                  defaultValue={node.parentId ?? ""}
                  className="h-8 rounded-md border border-slate-200 px-2 text-xs"
                  onFocus={loadOptions}
                >
                  <option value="">Root</option>
                  {optionRows
                    .filter((category) => category.id !== node.id)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
                <label className="text-xs text-slate-600 flex items-center gap-1">
                  <input
                    type="checkbox"
                    name="isActive"
                    value="true"
                    defaultChecked={node.isActive}
                  />
                  Active
                </label>
                <Button type="submit" size="sm" variant="outline">
                  Save
                </Button>
              </form>
            </td>
            <td className="px-4 py-3">
              <form action={deleteAction}>
                <input type="hidden" name="id" value={node.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Soft delete
                </Button>
              </form>
            </td>
          </tr>,
        );

        if (isExpanded && children.length > 0) {
          rows.push(...renderRows(children, depth + 1));
        }
      }

      return rows;
    },
    [childrenById, deleteAction, expanded, handleToggle, loadingIds, optionRows, updateAction, loadOptions],
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Category tree</h2>
        <p className="text-sm text-slate-600">
          Expand a category to load its children. Categories are loaded on demand.
        </p>
        {treeError ? <p className="text-sm text-red-600">{treeError}</p> : null}
      </div>
      <div className="px-6 py-4 border-b border-slate-100">
        <form action={createAction} className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-600">Name</label>
            <input
              name="name"
              className="h-9 rounded-md border border-slate-200 px-3 text-sm"
              placeholder="Category name"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-600">Slug</label>
            <input
              name="slug"
              className="h-9 rounded-md border border-slate-200 px-3 text-sm"
              placeholder="optional"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-600">Parent</label>
            <select
              name="parentId"
              className="h-9 rounded-md border border-slate-200 px-3 text-sm"
              defaultValue=""
              onFocus={loadOptions}
            >
              <option value="">Root</option>
              {optionRows.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 pb-1">
            <input type="checkbox" name="isActive" value="true" defaultChecked />
            Active
          </label>
          <Button type="submit" size="sm" disabled={optionsLoading}>
            {optionsLoading ? "Loading..." : "Add category"}
          </Button>
        </form>
      </div>
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Slug</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Edit</th>
            <th className="px-4 py-3 font-medium">Delete</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {roots.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                No categories yet.
              </td>
            </tr>
          ) : (
            renderRows(roots)
          )}
        </tbody>
      </table>
    </div>
  );
}
