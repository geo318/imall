"use client";

import { Building2, Mail, Phone } from "lucide-react";
import { useTranslations } from "@/i18n/provider";

type ShopBusinessCardProps = {
  legalName?: string | null;
  email?: string | null;
  mobile?: string | null;
  className?: string;
};

type InfoItemProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

function InfoItem({ icon, label, value }: InfoItemProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className="break-all text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function ShopBusinessCard({
  legalName,
  email,
  mobile,
  className,
}: ShopBusinessCardProps) {
  const t = useTranslations();
  const rows = [
    legalName
      ? {
          key: "legalName",
          icon: <Building2 className="h-3.5 w-3.5" />,
          label: t("sellerInfo.legalName"),
          value: legalName,
        }
      : null,
    email
      ? {
          key: "email",
          icon: <Mail className="h-3.5 w-3.5" />,
          label: t("sellerInfo.email"),
          value: email,
        }
      : null,
    mobile
      ? {
          key: "mobile",
          icon: <Phone className="h-3.5 w-3.5" />,
          label: t("sellerInfo.phone"),
          value: mobile,
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; icon: React.ReactNode; label: string; value: string }>;

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <h3 className="font-semibold text-slate-900">{t("sellerInfo.title")}</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <InfoItem key={row.key} icon={row.icon} label={row.label} value={row.value} />
        ))}
      </div>
    </div>
  );
}
