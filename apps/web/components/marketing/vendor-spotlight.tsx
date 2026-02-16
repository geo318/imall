import Image from "next/image";
import { getCurrentLocale, Link } from "@/i18n/navigation.server";
import { getTranslations } from "@/i18n/server";
import { homeVendorsMock } from "@/MOCKS/homeVendors.mock";

export async function VendorSpotlight() {
  const locale = await getCurrentLocale();
  const t = await getTranslations(locale);
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

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {homeVendorsMock.map((vendor) => (
            <Link
              key={vendor.name}
              href={vendor.href ?? "/demo-shop"}
              className="card-hover flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-4 text-center sm:p-6"
              prefetch
            >
              <div className="relative mb-3 h-20 w-20 overflow-hidden rounded-full bg-slate-100">
                <Image
                  src={vendor.avatar}
                  alt={vendor.name}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
                {vendor.verified && (
                  <span className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white shadow ring-2 ring-white">
                    ✓
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold text-slate-900">{vendor.name}</h3>
              <p className="text-sm text-slate-600">{vendor.specialty}</p>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <span>{vendor.rating} ★</span>
                <span className="text-slate-500">
                  {t("vendorSpotlight.sales", { count: vendor.sales })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
