"use client";

import { Button } from "@repo/ui/button";
import { motion } from "motion/react";
import { useTranslations } from "@/i18n/provider";
import { Link } from "@/i18n/navigation.client";

export function HeroSection() {
  const t = useTranslations();
  const stats = [
    { label: t("home.hero.stats.products"), value: "10K+" },
    { label: t("home.hero.stats.vendors"), value: "500+" },
    { label: t("home.hero.stats.buyers"), value: "50K+" },
  ];
  return (
    <section className="relative overflow-hidden bg-gradient-hero">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 25,
              duration: 0.3,
            }}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm shadow-emerald-100"
          >
            <span aria-hidden>✨</span>
            <span>{t("home.hero.badge")}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              delay: 0.05,
            }}
            className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl"
          >
            {t.rich("home.hero.title", {
              highlight: (chunks) => <span className="text-gradient">{chunks}</span>,
            })}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              delay: 0.1,
            }}
            className="mt-4 text-lg text-slate-600 sm:text-xl"
          >
            {t("home.hero.description")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              delay: 0.15,
            }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Button
                size="lg"
                className="bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700"
              >
                <Link href="/products" prefetch>
                  {t("home.hero.ctaShop")}
                </Link>
              </Button>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Button
                size="lg"
                variant="outline"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                <Link href="/vendors" prefetch>
                  {t("home.hero.ctaVendor")}
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              delay: 0.2,
            }}
            className="mt-12 grid grid-cols-3 gap-4 border-t border-slate-200/70 pt-8"
          >
            {stats.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                  delay: 0.25 + index * 0.05,
                }}
              >
                <p className="text-2xl font-bold text-gradient sm:text-3xl">{item.value}</p>
                <p className="text-sm text-slate-500">{item.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 100,
          damping: 20,
          duration: 0.6,
        }}
        className="pointer-events-none absolute -left-10 top-10 h-72 w-72 rounded-full bg-emerald-100/50 blur-3xl"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 100,
          damping: 20,
          duration: 0.6,
          delay: 0.1,
        }}
        className="pointer-events-none absolute -right-10 bottom-10 h-96 w-96 rounded-full bg-emerald-100/50 blur-3xl"
      />
    </section>
  );
}
