import { MarketHubLogo } from "@/assets";
import Link from "next/link";

export function MarketingFooter() {
  const columns = [
    {
      title: "Marketplace",
      links: [
        { href: "/products", label: "Shop products" },
        { href: "/vendors", label: "Become a vendor" },
        { href: "/faq", label: "FAQ" },
      ],
    },
    {
      title: "Company",
      links: [
        { href: "/about", label: "About" },
        { href: "/admin/demo-shop", label: "Admin workspace" },
        { href: "/demo-shop", label: "Demo shop" },
      ],
    },
    {
      title: "Resources",
      links: [
        { href: "https://github.com/", label: "Docs (coming soon)" },
        { href: "#", label: "Status (coming soon)" },
      ],
    },
  ];

  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-6 lg:px-8 lg:grid-cols-[1.5fr_2fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-inner">
              <MarketHubLogo width={18} height={18} />
            </span>
            <span className="text-lg tracking-tight">
              Market<span className="text-emerald-600">Hub</span>
            </span>
          </div>
          <p className="max-w-md text-sm text-slate-600">
            Multi-vendor commerce with carts and auctions, built for modern marketplaces that want
            to onboard sellers quickly and keep buyers engaged.
          </p>
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} MarketHub. All rights reserved.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {columns.map((col) => (
            <div key={col.title} className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">{col.title}</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                {col.links.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="transition-colors hover:text-emerald-700"
                      prefetch={!item.href.startsWith("http")}
                      target={item.href.startsWith("http") ? "_blank" : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
