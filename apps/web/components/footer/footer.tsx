"use client";

import { Instagram, ShoppingBag, Twitter, Youtube } from "lucide-react";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";
import { Copyright } from "./copyright";

export function Footer() {
  const t = useTranslations();
  const footerLinks = {
    product: [
      { label: t("footer.links.products"), href: "/products" },
      { label: t("footer.links.vendors"), href: "/vendors" },
      { label: t("footer.links.auctions"), href: "/products?type=auction" },
      { label: t("footer.links.newArrivals"), href: "/products?sort=newest" },
    ],
    company: [
      { label: t("footer.links.about"), href: "/about" },
      { label: t("footer.links.faq"), href: "/faq" },
      { label: t("footer.links.contact"), href: "/about" },
      { label: t("footer.links.careers"), href: "/about" },
    ],
    legal: [
      { label: t("footer.links.privacy"), href: "/faq" },
      { label: t("footer.links.terms"), href: "/faq" },
      { label: t("footer.links.cookies"), href: "/faq" },
    ],
  } as const;

  return (
    <footer className="mt-16 border-t border-border bg-secondary/30">
      <div className="container py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600">
                <ShoppingBag className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">
                Market<span className="text-emerald-600">Hub</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">{t("footer.tagline")}</p>
            <div className="flex gap-3">
              <Link
                href="#"
                className="p-2 rounded-full bg-secondary hover:bg-emerald-600 hover:text-white transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </Link>
              <Link
                href="#"
                className="p-2 rounded-full bg-secondary hover:bg-emerald-600 hover:text-white transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </Link>
              <Link
                href="#"
                className="p-2 rounded-full bg-secondary hover:bg-emerald-600 hover:text-white transition-colors"
                aria-label="YouTube"
              >
                <Youtube className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-semibold mb-4">{t("footer.headings.product")}</h4>
            <ul className="space-y-2">
              {footerLinks.product.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-semibold mb-4">{t("footer.headings.company")}</h4>
            <ul className="space-y-2">
              {footerLinks.company.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="font-semibold mb-4">{t("footer.headings.legal")}</h4>
            <ul className="space-y-2">
              {footerLinks.legal.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">
                © 2024 MarketHub. All rights reserved.
              </p>
            }
          >
            <Copyright />
          </Suspense>
          <p className="text-sm text-muted-foreground">{t("footer.madeWithCare")}</p>
        </div>
      </div>
    </footer>
  );
}
