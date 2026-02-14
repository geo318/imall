"use client";

export function Copyright() {
  const year = new Date().getFullYear();
  return <p className="text-sm text-muted-foreground">© {year} iMall. All rights reserved.</p>;
}
