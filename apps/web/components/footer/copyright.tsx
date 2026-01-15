"use client";

export function Copyright() {
  const year = new Date().getFullYear();
  return <p className="text-sm text-muted-foreground">© {year} MarketHub. All rights reserved.</p>;
}
