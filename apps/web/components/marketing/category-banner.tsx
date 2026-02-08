import { Button } from "@repo/ui/button";
import Image from "next/image";
import { getTranslations } from "@/i18n/server";
import { getCurrentLocale } from "@/i18n/navigation.server";
import { Link } from "@/i18n/navigation.server";
import { homeCategoriesMock } from "@/MOCKS/homeCategories.mock";

export async function CategoryBanner() {
  const locale = await getCurrentLocale();
  const t = await getTranslations(locale);
  return (
    <section className="bg-emerald-50/60 py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
              {t("categoryBanner.title")}
            </h2>
            <p className="text-sm text-slate-600">{t("categoryBanner.subtitle")}</p>
          </div>
          <Button variant="ghost" className="hidden text-emerald-700 sm:inline-flex">
            <Link href="/products" prefetch>
              {t("categoryBanner.cta")}
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {homeCategoriesMock.map((category) => (
            <Link
              key={category.name}
              href="/products"
              className="group relative block overflow-hidden rounded-2xl"
              prefetch
            >
              <div className="relative h-48">
                <Image
                  src={category.image}
                  alt={category.name}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-105"
                  sizes="(min-width: 1024px) 33vw, 100vw"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                <h3 className="text-lg font-semibold">{category.name}</h3>
                <p className="text-sm text-white/80">{category.count}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
