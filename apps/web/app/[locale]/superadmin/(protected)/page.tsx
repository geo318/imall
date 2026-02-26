import { Button } from "@repo/ui/button";
import {
  createSuperadminCategory,
  deleteSuperadminCategory,
  listSuperadminCategoryRoots,
  listSuperadminShops,
  seedInitialSuperadminCategories,
  superadminLogout,
  updateShopAuction,
  updateShopSelling,
  updateSuperadminCategory,
} from "@/app/actions/superadmin";
import { Link } from "@/i18n/navigation.server";
import { SuperadminCategoryTree } from "./_components/category-tree";

export default async function SuperadminPage() {
  let shops: Awaited<ReturnType<typeof listSuperadminShops>> = [];
  let categoryRoots: Awaited<ReturnType<typeof listSuperadminCategoryRoots>> = [];
  let loadError: string | null = null;

  try {
    shops = await listSuperadminShops();
    categoryRoots = await listSuperadminCategoryRoots();
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

      <SuperadminCategoryTree
        roots={categoryRoots}
        canSeedInitialCategories={categoryRoots.length === 0}
        createAction={createSuperadminCategory}
        seedInitialAction={seedInitialSuperadminCategories}
        updateAction={updateSuperadminCategory}
        deleteAction={deleteSuperadminCategory}
      />
    </div>
  );
}
