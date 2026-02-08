import type { ReactNode } from "react";
import { Button } from "@repo/ui/button";
import {
  createSuperadminCategory,
  deleteSuperadminCategory,
  listSuperadminCategories,
  listSuperadminShops,
  superadminLogout,
  updateShopAuction,
  updateShopSelling,
  updateSuperadminCategory,
  type SuperadminCategory,
  type SuperadminCategoryRelation,
} from "@/app/actions/superadmin";
import { Link } from "@/i18n/navigation.server";

type CategoryNode = SuperadminCategory & { children: CategoryNode[] };

function buildCategoryTree(
  categories: SuperadminCategory[],
  relations: SuperadminCategoryRelation[],
): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  const childToParent = new Map<string, string>();

  for (const category of categories) {
    map.set(category.id, { ...category, children: [] });
  }

  for (const rel of relations) {
    const parent = map.get(rel.parentId);
    const child = map.get(rel.childId);
    if (parent && child) {
      parent.children.push(child);
      if (!childToParent.has(child.id)) {
        childToParent.set(child.id, parent.id);
      }
    }
  }

  const roots: CategoryNode[] = [];
  for (const node of map.values()) {
    if (!childToParent.has(node.id)) {
      roots.push(node);
    }
  }

  return roots;
}

function getParentId(
  relations: SuperadminCategoryRelation[],
  childId: string,
): string | undefined {
  const match = relations.find((rel) => rel.childId === childId);
  return match?.parentId;
}

function renderCategoryRows(
  nodes: CategoryNode[],
  categories: SuperadminCategory[],
  relations: SuperadminCategoryRelation[],
  depth = 0,
): ReactNode {
  return nodes.flatMap((node) => {
    const row = (
      <tr key={node.id} className={node.deletedAt ? "opacity-50" : undefined}>
        <td className="px-4 py-3">
          <div style={{ paddingLeft: `${depth * 18}px` }} className="font-medium text-slate-900">
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
          <form action={updateSuperadminCategory} className="flex flex-wrap gap-2 items-center">
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
              defaultValue={getParentId(relations, node.id) ?? ""}
              className="h-8 rounded-md border border-slate-200 px-2 text-xs"
            >
              <option value="">Root</option>
              {categories
                .filter((category) => category.id !== node.id && !category.deletedAt)
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
          <form action={deleteSuperadminCategory}>
            <input type="hidden" name="id" value={node.id} />
            <Button type="submit" size="sm" variant="ghost">
              Soft delete
            </Button>
          </form>
        </td>
      </tr>
    );

    return [row, ...renderCategoryRows(node.children, categories, relations, depth + 1)];
  });
}

export default async function SuperadminPage() {
  let shops: Awaited<ReturnType<typeof listSuperadminShops>> = [];
  let categories: SuperadminCategory[] = [];
  let relations: SuperadminCategoryRelation[] = [];
  let loadError: string | null = null;

  try {
    shops = await listSuperadminShops();
    const categoryPayload = await listSuperadminCategories();
    categories = categoryPayload.categories;
    relations = categoryPayload.relations;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unauthorized";
  }

  if (loadError) {
    return (
      <div className="container py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm max-w-xl">
          <h1 className="text-2xl font-semibold text-slate-900">Superadmin access required</h1>
          <p className="mt-2 text-sm text-slate-600">
            {loadError === "Unauthorized"
              ? "Please sign in to manage shops and categories."
              : loadError}
          </p>
          <div className="mt-4">
            <Link href="/superadmin/login" className="inline-flex">
              <Button size="sm">Go to sign in</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tree = buildCategoryTree(categories, relations);

  return (
    <div className="container py-10 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Superadmin
          </p>
          <h1 className="text-3xl font-bold text-slate-900">Shops</h1>
          <p className="text-sm text-slate-600">
            Manage seller permissions and jump into any shop.
          </p>
        </div>
        <form action={superadminLogout}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Shop</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Auction</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shops.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No shops found.
                </td>
              </tr>
            ) : (
              shops.map((shop) => (
                <tr key={shop.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{shop.name}</td>
                  <td className="px-4 py-3 text-slate-600">{shop.slug}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                        shop.canSell
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {shop.canSell ? "Selling enabled" : "Pending approval"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                        shop.canAuction
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {shop.canAuction ? "Auction enabled" : "Auction disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <form action={updateShopSelling}>
                        <input type="hidden" name="slug" value={shop.slug} />
                        <input type="hidden" name="canSell" value={(!shop.canSell).toString()} />
                        <Button
                          type="submit"
                          size="sm"
                          variant={shop.canSell ? "outline" : "primary"}
                        >
                          {shop.canSell ? "Disable" : "Enable"}
                        </Button>
                      </form>
                      <form action={updateShopAuction}>
                        <input type="hidden" name="slug" value={shop.slug} />
                        <input
                          type="hidden"
                          name="canAuction"
                          value={(!shop.canAuction).toString()}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant={shop.canAuction ? "outline" : "secondary"}
                        >
                          {shop.canAuction ? "Disable auctions" : "Enable auctions"}
                        </Button>
                      </form>
                      <Link href={`/admin/${shop.slug}`} className="inline-flex">
                        <Button size="sm" variant="outline">
                          Open admin
                        </Button>
                      </Link>
                      <Link href={`/${shop.slug}`} className="inline-flex">
                        <Button size="sm" variant="ghost">
                          View shop
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Category tree</h2>
          <p className="text-sm text-slate-600">
            Create multi-level categories and manage parent relationships. Deleted categories are
            hidden.
          </p>
        </div>
        <div className="px-6 py-4 border-b border-slate-100">
          <form action={createSuperadminCategory} className="flex flex-wrap gap-2 items-end">
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
              >
                <option value="">Root</option>
                {categories
                  .filter((category) => !category.deletedAt)
                  .map((category) => (
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
            <Button type="submit" size="sm">
              Add category
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
            {tree.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No categories yet.
                </td>
              </tr>
            ) : (
              renderCategoryRows(tree, categories, relations)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
