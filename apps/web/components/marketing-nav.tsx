import { MarketHubLogo } from "@/assets";
import { Button } from "@repo/ui/button";
import Link from "next/link";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Shop" },
  { href: "/demo-shop", label: "Vendors" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
];

export function MarketingNav() {
  return (
    <nav className="sticky top-0 z-30 w-full border-b border-slate-200/60 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-inner">
            <MarketHubLogo width={18} height={18} />
          </span>
          <span className="text-lg tracking-tight">
            Market<span className="text-emerald-600">Hub</span>
          </span>
        </Link>

        <div className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-emerald-700"
              prefetch
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="hidden text-sm font-semibold text-slate-700 md:inline-flex"
          >
            <Link href="/demo-shop" prefetch>
              Explore
            </Link>
          </Button>
          <Button size="sm" className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-700">
            <Link href="/admin/demo-shop" prefetch>
              Start Selling
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
