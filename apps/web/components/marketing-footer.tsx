import { MarketHubLogo } from "@/assets";
import { Instagram, ShoppingBag, Twitter, Youtube } from "lucide-react";
import Link from "next/link";

export function MarketingFooter() {
  const footerLinks = {
    product: [
      { label: "Products", href: "/products" },
      { label: "Vendors", href: "/vendors" },
      { label: "Auctions", href: "/products?type=auction" },
      { label: "New arrivals", href: "/products?sort=newest" },
    ],
    company: [
      { label: "About", href: "/about" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/about" },
      { label: "Careers", href: "/about" },
    ],
    legal: [
      { label: "Privacy", href: "/faq" },
      { label: "Terms", href: "/faq" },
      { label: "Cookies", href: "/faq" },
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
            <p className="text-sm text-muted-foreground max-w-xs">
              The trusted multi-vendor marketplace for unique products. Buy, sell, and auction with
              confidence.
            </p>
            <div className="flex gap-3">
              <a
                href="#"
                className="p-2 rounded-full bg-secondary hover:bg-emerald-600 hover:text-white transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="p-2 rounded-full bg-secondary hover:bg-emerald-600 hover:text-white transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="p-2 rounded-full bg-secondary hover:bg-emerald-600 hover:text-white transition-colors"
                aria-label="YouTube"
              >
                <Youtube className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
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
            <h4 className="font-semibold mb-4">Company</h4>
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
            <h4 className="font-semibold mb-4">Legal</h4>
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
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} MarketHub. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">Made with care for vendors worldwide.</p>
        </div>
      </div>
    </footer>
  );
}
