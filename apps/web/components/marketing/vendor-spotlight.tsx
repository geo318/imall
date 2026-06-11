import Image from "next/image";
import { getSpotlightShops } from "@/app/actions/shops";
import { getCurrentLocale, Link } from "@/i18n/navigation.server";
import { getTranslations } from "@/i18n/server";

// Base = today so displayed totals start under 300 and grow 10-20/day from here.
const BASE_DATE_MS = new Date("2026-06-12").getTime();

const VENDOR_SEED_STATS = [
  { products: 47, salesBase: 180, vendorSeed: 11 },
  { products: 32, salesBase: 220, vendorSeed: 37 },
  { products: 83, salesBase: 260, vendorSeed: 73 },
];

// Deterministic 10-20 increment per vendor per day — same for all users on a given day.
function computeSales(salesBase: number, daysSince: number, vendorSeed: number): number {
  let total = salesBase;
  for (let d = 0; d < daysSince; d++) {
    total += 10 + ((d * 1_234_567 + vendorSeed) >>> 0) % 11;
  }
  return total;
}

function formatCategory(category: string | null) {
  if (!category) return null;
  return category
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function VendorSpotlight() {
  const locale = await getCurrentLocale();
  const t = await getTranslations(locale);
  const vendors = await getSpotlightShops(3);

  if (vendors.length === 0) {
    return null;
  }

  const daysSinceBase = Math.floor((Date.now() - BASE_DATE_MS) / 86_400_000);
  const numberFormatter = new Intl.NumberFormat(locale);

  return (
    <section className="py-14 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            {t.rich("vendorSpotlight.title", {
              highlight: (chunks) => <span className="text-gradient">{chunks}</span>,
            })}
          </h2>
          <p className="mt-2 text-slate-600">{t("vendorSpotlight.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-3">
          {vendors.map((vendor, index) => {
            const seed = VENDOR_SEED_STATS[index] ?? { products: 25, salesBase: 180, vendorSeed: 99 };
            const productCount = vendor.productCount > 0 ? vendor.productCount : seed.products;
            const salesCount = vendor.salesCount > 0 ? vendor.salesCount : computeSales(seed.salesBase, daysSinceBase, seed.vendorSeed);

            return (
              <Link
                key={vendor.id}
                href={`/${vendor.slug}`}
                className="card-hover flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-4 text-center sm:p-6"
                prefetch
              >
                <div className="relative mb-3 h-20 w-20 rounded-full bg-slate-100">
                  <Image
                    src={`https://picsum.photos/seed/${vendor.slug}/200/200`}
                    alt={vendor.name}
                    fill
                    className="object-cover rounded-full"
                    sizes="80px"
                  />
                  <span className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white shadow ring-2 ring-white">
                    ✓
                  </span>
                </div>
                <h3 className="text-base font-semibold text-slate-900">{vendor.name}</h3>
                <p className="text-sm text-slate-600">
                  {formatCategory(vendor.primaryCategory) ?? t("vendorSpotlight.defaultCategory")}
                </p>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <span>{t("vendorSpotlight.products", { count: numberFormatter.format(productCount) })}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500">
                    {t("vendorSpotlight.sales", { count: numberFormatter.format(salesCount) })}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
