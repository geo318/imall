import { Button } from "@repo/ui/button";
import { listSuperadminShops, superadminLogout, updateShopSelling } from "@/app/actions/superadmin";
import { Link } from "@/i18n/navigation.server";

export default async function SuperadminPage() {
  const shops = await listSuperadminShops();

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
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shops.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
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
                    <div className="flex flex-wrap gap-2">
                      <form action={updateShopSelling}>
                        <input type="hidden" name="slug" value={shop.slug} />
                        <input type="hidden" name="canSell" value={(!shop.canSell).toString()} />
                        <Button type="submit" size="sm" variant={shop.canSell ? "outline" : null}>
                          {shop.canSell ? "Disable" : "Enable"}
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
    </div>
  );
}
