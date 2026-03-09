"use client";

import { useTranslations } from "@/i18n/provider";

type AuthCopyrightProps = {
  className?: string;
};

export function AuthCopyright({ className }: AuthCopyrightProps) {
  const t = useTranslations();
  const year = new Date().getFullYear();
  return <p className={className}>{t("auth.layout.rightsReserved", { year })}</p>;
}
