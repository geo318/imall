"use client";

import { Button } from "@repo/ui/button";
import { Dropdown, DropdownItem, DropdownSeparator } from "@repo/ui/dropdown";
import { Input } from "@repo/ui/input";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  Search,
  Settings,
  ShoppingBag,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCart } from "@/actions/carts";
import { MarketHubLogo } from "@/assets";
import { Link, useRouter, useSearchParams } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";
import type { CartItem } from "@/lib/api/cart";
import { HeaderFavorites } from "./header-favorites";
import { LanguageSwitcher } from "./language-switcher";
import { MegaMenu, megaCategories } from "./mega-menu";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const qParam = searchParams.get("search") ?? searchParams.get("q") ?? "";
  const adminHref = primaryShopSlug ? `/admin/${primaryShopSlug}` : "/sell";

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [expandedMobileCat, setExpandedMobileCat] = useState<string | null>(null);
  const [q, setQ] = useState(qParam);
  const [cartId, setCartId] = useState<string | null>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQ(qParam), [qParam]);

  useEffect(() => {
    const id = globalThis.window ? globalThis.window.localStorage.getItem("cart") : null;
    setCartId(id);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div ref={categoryRef} className="relative">
        <div className="container flex h-16 items-center gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1 flex-shrink-0">
            <MarketHubLogo width={32} height={32} className="h-8 w-8" />
            <span className="font-bold text-xl hidden sm:inline -ml-1">Mall</span>
          </Link>

          {/* Categories Trigger */}
          <div className="relative hidden md:block flex-shrink-0">
            <button
              onMouseEnter={() => setIsCategoryOpen(true)}
              onClick={() => setIsCategoryOpen((prev) => !prev)}
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              type="button"
            >
              <Menu className="h-4 w-4" />
              All Categories
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${isCategoryOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {/* Desktop Search - Centered */}
          <form
            className="hidden md:flex flex-1 max-w-xl mx-auto"
            onSubmit={(e) => {
              e.preventDefault();
              pushSearch(q);
              setQ("");
            }}
          >
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("nav.searchPlaceholder")}
                className="w-full pl-10 pr-10"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          </form>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0 ml-auto">
            <LanguageSwitcher />
            <HeaderFavorites />
            <Link href="/cart">
              <Button variant="ghost" size="sm" className="relative">
                <ShoppingBag className="h-5 w-5" />
                {cartCount > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
                    {cartCount}
                  </span>
                ) : null}
              </Button>
            </Link>
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
                <Button size="sm">{t("nav.signIn")}</Button>
              </Link>
            )}
          </div>

          {/* Mobile Actions */}
          <div className="flex md:hidden items-center gap-1 flex-1">
            <form
              className="flex flex-1"
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
                  className="w-full pl-10 pr-10"
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => setQ("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            </form>
            <HeaderFavorites />
            <LanguageSwitcher className="ml-1" />
            <Link href="/cart">
              <Button variant="ghost" size="sm" className="relative">
                <ShoppingBag className="h-5 w-5" />
                {cartCount > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
                    {cartCount}
                  </span>
                ) : null}
              </Button>
            </Link>
            <button onClick={() => setIsMenuOpen((prev) => !prev)} className="p-2" type="button">
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        <div className="hidden md:block">
          <MegaMenu isOpen={isCategoryOpen} onClose={() => setIsCategoryOpen(false)} />
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t bg-background max-h-[80vh] overflow-y-auto">
          <nav className="container py-4 flex flex-col space-y-1">
            <span className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Categories
            </span>
            {megaCategories.map((category) => (
              <div key={category.name}>
                <button
                  onClick={() =>
                    setExpandedMobileCat(expandedMobileCat === category.name ? null : category.name)
                  }
                  className="w-full flex items-center justify-between px-2 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 rounded-md transition-colors"
                  type="button"
                >
                  <span className="flex items-center gap-3">
                    <span>{category.icon}</span>
                    {category.name}
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      expandedMobileCat === category.name ? "rotate-90" : ""
                    }`}
                  />
                </button>
                {expandedMobileCat === category.name && (
                  <div className="pl-10 pb-2 space-y-1">
                    <Link
                      href={`/products?category=${encodeURIComponent(category.name)}`}
                      onClick={() => setIsMenuOpen(false)}
                      className="block py-1.5 text-sm font-medium text-primary"
                    >
                      All {category.name}
                    </Link>
                    {category.subcategories.map((subcategory) => (
                      <Link
                        key={subcategory.name}
                        href={`/products?category=${encodeURIComponent(category.name)}&sub=${encodeURIComponent(subcategory.name)}`}
                        onClick={() => setIsMenuOpen(false)}
                        className="block py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {subcategory.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="my-2 border-t" />
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
                  <Button className="w-full">{t("nav.signIn")}</Button>
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
