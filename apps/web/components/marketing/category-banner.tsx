import { Button } from "@repo/ui/button";
import { homeCategoriesMock } from "@/MOCKS/homeCategories.mock";
import { getTopCategories } from "@/app/actions/categories";
import { getCurrentLocale, Link } from "@/i18n/navigation.server";
import { getTranslations } from "@/i18n/server";

const GRADIENTS = [
  "from-amber-400 via-orange-400 to-rose-500",
  "from-violet-500 via-purple-500 to-pink-500",
  "from-teal-400 via-emerald-400 to-cyan-500",
  "from-sky-400 via-blue-500 to-indigo-500",
  "from-lime-400 via-green-500 to-emerald-600",
];

function formatProductCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K products`;
  return `${n} products`;
}

export async function CategoryBanner() {
  const locale = await getCurrentLocale();
  const t = await getTranslations(locale);

  const apiLocale = locale === "ka" ? "ka" : locale === "ru" ? "ru" : "en";
  const liveCategories = await getTopCategories(3, apiLocale);

  const displayCategories =
    liveCategories.length > 0
      ? liveCategories.map((cat, i) => ({
          name: cat.name,
          icon: cat.icon,
          count: formatProductCount(cat.productCount),
          href: `/products?category=${encodeURIComponent(cat.key)}`,
          gradient: GRADIENTS[i % GRADIENTS.length] ?? "from-slate-400 to-slate-600",
        }))
      : homeCategoriesMock.map((cat, i) => ({
          name: cat.name,
          icon: "📦",
          count: cat.count,
          href: cat.href,
          gradient: GRADIENTS[i % GRADIENTS.length] ?? "from-slate-400 to-slate-600",
        }));

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
          {displayCategories.map((category) => (
            <Link
              key={category.name}
              href={category.href}
              className="group relative block overflow-hidden rounded-2xl"
              prefetch
            >
              <div className={`relative flex h-48 items-center justify-center bg-gradient-to-br ${category.gradient} transition-all duration-500 group-hover:brightness-110`}>
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10" />
                  <div className="absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-white/10" />
                  <div className="absolute bottom-4 right-8 h-16 w-16 rounded-full bg-white/15" />
                </div>
                <span
                  className="relative select-none text-6xl transition-transform duration-500 group-hover:scale-110"
                  aria-hidden="true"
                >
                  {category.icon}
                </span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
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
