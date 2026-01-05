import { homeCategoriesMock } from "@/MOCKS/homeCategories.mock";
import { Button } from "@repo/ui/button";
import Image from "next/image";
import Link from "next/link";

export function CategoryBanner() {
  return (
    <section className="bg-emerald-50/60 py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
              Browse by category
            </h2>
            <p className="text-sm text-slate-600">Find exactly what you&apos;re looking for</p>
          </div>
          <Button variant="ghost" className="hidden text-emerald-700 sm:inline-flex">
            <Link href="/products" prefetch>
              View all
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
