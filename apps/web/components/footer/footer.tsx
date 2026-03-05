"use client";

import { Suspense } from "react";
import { MarketHubLogo } from "@/assets";
import { Link } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";
import { LanguageSwitcher } from "../language-switcher";
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
      { label: t("footer.links.privacy"), href: "/legal?section=privacy-policy" },
      { label: t("footer.links.terms"), href: "/legal?section=terms-of-service" },
      {
        label: t("footer.links.returns"),
        href: "/legal?section=return-and-cancellation-policy",
      },
    ],
  } as const;

  return (
    <footer className="mt-16 border-t border-border bg-secondary/30">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 space-y-4 lg:col-span-1">
            <Link href="/" className="flex items-center gap-1">
              <MarketHubLogo width={32} height={32} className="h-8 w-8" />
              <span className="font-bold text-xl -ml-1">Mall</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">{t("footer.tagline")}</p>
            <LanguageSwitcher />
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
              <p className="text-sm text-muted-foreground">© 2024 iMall. All rights reserved.</p>
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
