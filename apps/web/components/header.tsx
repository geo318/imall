"use client";

import { Button } from "@repo/ui/button";
import { Dropdown, DropdownItem, DropdownSeparator } from "@repo/ui/dropdown";
import { Input } from "@repo/ui/input";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Menu, Search, Settings, ShoppingBag, User, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getCart } from "@/actions/carts";
import { MarketHubLogo } from "@/assets";
import { locales } from "@/i18n/config";
import { Link, usePathname, useRouter, useSearchParams } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";
import type { CartItem } from "@/lib/api/cart";
import { cn } from "@/lib/utils";
import { HeaderFavorites } from "./header-favorites";
import { LanguageSwitcher } from "./language-switcher";

type HeaderProps = {
  isSignedIn?: boolean;
  signOut?: () => void | Promise<void>;
  primaryShopSlug?: string | null;
  userDisplayName?: string | null;
};

export function Header({
  isSignedIn = false,
  signOut,
  primaryShopSlug,
  userDisplayName,
}: HeaderProps) {
  const t = useTranslations();
  const navLinks = [
    { href: "/products", label: t("nav.products") },
    { href: "/faq", label: t("nav.faq") },
  ];
  const pathname = usePathname();
  const localePattern = new RegExp(`^/(${locales.join("|")})(?=/|$)`);
  const normalizedPath = pathname.replace(localePattern, "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const qParam = searchParams.get("search") ?? searchParams.get("q") ?? "";
  const adminHref = primaryShopSlug ? `/admin/${primaryShopSlug}` : "/sell";

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [q, setQ] = useState(qParam);
  const [cartId, setCartId] = useState<string | null>(null);

  useEffect(() => setQ(qParam), [qParam]);

  useEffect(() => {
    const id = globalThis.window ? globalThis.window.localStorage.getItem("cart") : null;
    setCartId(id);
  }, []);

  const { data: cartData } = useQuery({
    queryKey: ["cart", cartId],
    queryFn: () => getCart(cartId as string),
    enabled: Boolean(cartId),
    staleTime: 10_000,
    retry: false,
  });

  const cartCount = useMemo(() => {
    const items = cartData?.items ?? [];
    return items.reduce((sum: number, item: CartItem) => sum + (item.qty ?? 0), 0);
  }, [cartData]);

  function pushSearch(nextQ: string) {
    const next = nextQ.trim();
    const sp = new URLSearchParams(searchParams.toString());
    // Use `search` in the URL (shop-spark style). Keep `q` cleared for backward-compat.
    sp.delete("q");
    if (next) sp.set("search", next);
    else sp.delete("search");
    router.push(sp.toString() ? `/products?${sp.toString()}` : "/products");
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-slate-50">
      <div className="container flex h-16 items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600">
            <MarketHubLogo width={18} height={18} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight hidden sm:inline">
            <span className="text-emerald-600 font-extrabold tracking-wide text-xl">i</span>Mall
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-full transition-colors",
                normalizedPath === link.href
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Search - Centered */}
        <div className="hidden md:flex items-center flex-1 max-w-md">
          <form
            className="flex items-center w-full"
            onSubmit={(e) => {
              e.preventDefault();
              pushSearch(q);
              setQ("");
            }}
          >
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("nav.searchPlaceholder")}
                className="h-9 pl-10 pr-4 w-full bg-white border-slate-200 rounded-lg"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-slate-500 hover:text-slate-900" />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0 ml-auto">
          <LanguageSwitcher />
          <HeaderFavorites />
          <Button variant="ghost" size="sm" className="rounded-full relative">
            <Link href="/cart">
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-emerald-600 text-white text-xs rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              ) : null}
            </Link>
          </Button>
          {isSignedIn ? (
            <>
              <span className="text-sm text-slate-600">
                {userDisplayName ? `Hi, ${userDisplayName}` : "Hi"}
              </span>
              <Dropdown
                trigger={
                  <div className="inline-flex items-center justify-center rounded-full p-2 text-sm font-medium transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
                    <User className="h-5 w-5" />
                  </div>
                }
                align="right"
              >
                <div className="py-1">
                  <DropdownItem asChild>
                    <Link href={adminHref} className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      {primaryShopSlug ? t("nav.admin") : t("nav.createShop")}
                    </Link>
                  </DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem
                    onClick={() => {
                      signOut?.();
                    }}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("nav.signOut")}
                  </DropdownItem>
                </div>
              </Dropdown>
            </>
          ) : (
            <Link href="/sign-in" prefetch>
              <Button
                size="sm"
                className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 rounded-lg"
              >
                {t("nav.signIn")}
              </Button>
            </Link>
          )}
        </div>

        {/* Mobile Actions */}
        <div className="flex md:hidden items-center gap-1 flex-1">
          <form
            className="flex items-center flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              pushSearch(q);
              setQ("");
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("nav.searchPlaceholder")}
                className="h-9 pl-10 pr-4 w-full"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-slate-500 hover:text-slate-900" />
                </button>
              )}
            </div>
          </form>
          <HeaderFavorites />
          <LanguageSwitcher className="ml-1" />
          <Button variant="ghost" size="sm" className="rounded-full relative">
            <Link href="/cart">
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-emerald-600 text-white text-xs rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              ) : null}
            </Link>
          </Button>
          <button
            onClick={() => setIsMenuOpen((v) => !v)}
            type="button"
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="container py-4 flex flex-col space-y-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-4 border-t border-border flex flex-col space-y-2">
              {isSignedIn ? (
                <>
                  <Link href={adminHref} className="w-full">
                    <Button variant="outline" className="w-full">
                      <Settings className="h-4 w-4 mr-2" />
                      {primaryShopSlug ? t("nav.admin") : t("nav.createShop")}
                    </Button>
                  </Link>
                  <Button
                    className="w-full bg-red-600 text-white hover:bg-red-700"
                    onClick={() => {
                      signOut?.();
                      setIsMenuOpen(false);
                    }}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {t("nav.signOut")}
                  </Button>
                </>
              ) : (
                <Link href="/sign-in" className="w-full">
                  <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-700">
                    {t("nav.signIn")}
                  </Button>
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
