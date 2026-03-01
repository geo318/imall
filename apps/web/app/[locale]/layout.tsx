import type { Metadata } from "next";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { QueryProvider } from "@/context/query-provider";
import { defaultLocale, type Locale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { I18nProvider } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { ClerkProviderWrapper } from "../_components/clerk-provider-wrapper";
import { LayoutWrapper } from "../_components/layout-wrapper";
import "../globals.css";

const geistSans = localFont({
  src: "../../public/fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "../../public/fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});
const firago = localFont({
  src: [
    {
      path: "../../public/fonts/Firago-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/Firago-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/Firago-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-firago",
});

export const metadata: Metadata = {
  title: "MyShop | Multi-tenant commerce with carts and auctions",
  description: "Tenant-based shops with carts, auctions, inventory, and admin workspace.",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  const messages = await getDictionary(locale as Locale);
  const isGeorgian = locale === "ka";

  return (
    <html lang={locale}>
      <body
        className={cn(
          "antialiased",
          isGeorgian ? "font-firago" : "font-sans",
          geistSans.variable,
          geistMono.variable,
          firago.variable,
        )}
      >
        <Suspense fallback={null}>
          <ClerkProviderWrapper>
            <QueryProvider>
              <I18nProvider locale={(locale as Locale) ?? defaultLocale} messages={messages}>
                <LayoutWrapper>{children}</LayoutWrapper>
              </I18nProvider>
            </QueryProvider>
          </ClerkProviderWrapper>
        </Suspense>
        <Toaster />
      </body>
    </html>
  );
}
