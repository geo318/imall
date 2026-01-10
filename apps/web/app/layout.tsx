import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { LayoutClient } from "./layout-client";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "MyShop | Multi-tenant commerce with carts and auctions",
  description: "Tenant-based shops with carts, auctions, inventory, and admin workspace.",
};

// PPR: Static shell with client providers in Suspense
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cn("font-sans antialiased", geistSans.variable, geistMono.variable)}>
        <Suspense fallback={null}>
          <LayoutClient>{children}</LayoutClient>
        </Suspense>
      </body>
    </html>
  );
}
