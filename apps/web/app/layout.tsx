import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Suspense } from "react";

import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { QueryProvider } from "../context/query-provider";
import { ClerkProviderWrapper } from "./_components/clerk-provider-wrapper";
import { LayoutWrapper } from "./_components/layout-wrapper";

const geistSans = localFont({
  src: "../public/fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "../public/fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "MyShop | Multi-tenant commerce with carts and auctions",
  description: "Tenant-based shops with carts, auctions, inventory, and admin workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cn("font-sans antialiased", geistSans.variable, geistMono.variable)}>
        <Suspense fallback={null}>
          <ClerkProviderWrapper>
            <QueryProvider>
              <LayoutWrapper>{children}</LayoutWrapper>
            </QueryProvider>
          </ClerkProviderWrapper>
        </Suspense>
        <Toaster />
      </body>
    </html>
  );
}
