"use client";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Textarea } from "@repo/ui/textarea";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";

type Props = {
  shopSlug: string;
  initialName: string;
  initialBankDetails: string | null;
  initialPayoutAccount: string | null;
  initialPayoutNotes: string | null;
  initialOrderNotes: string | null;
  initialInventoryNotes: string | null;
  initialSellerEmail: string | null;
  initialSellerPhone: string | null;
  initialSellerRules: string | null;
};

export function ShopSettingsForm({
  shopSlug,
  initialName,
  initialBankDetails,
  initialPayoutAccount,
  initialPayoutNotes,
  initialOrderNotes,
  initialInventoryNotes,
  initialSellerEmail,
  initialSellerPhone,
  initialSellerRules,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [bankDetails, setBankDetails] = useState(initialBankDetails ?? "");
  const [payoutAccount, setPayoutAccount] = useState(initialPayoutAccount ?? "");
  const [payoutNotes, setPayoutNotes] = useState(initialPayoutNotes ?? "");
  const [orderNotes, setOrderNotes] = useState(initialOrderNotes ?? "");
  const [inventoryNotes, setInventoryNotes] = useState(initialInventoryNotes ?? "");
  const [sellerEmail, setSellerEmail] = useState(initialSellerEmail ?? "");
  const [sellerPhone, setSellerPhone] = useState(initialSellerPhone ?? "");
  const [sellerRules, setSellerRules] = useState(initialSellerRules ?? "");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/${shopSlug}/settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            bankDetails,
            payoutAccount,
            payoutNotes,
            orderNotes,
            inventoryNotes,
            sellerEmail,
            sellerPhone,
            sellerRules,
          }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || t("adminSettings.errors.updateFailed"));
        }

        toast.success(t("adminSettings.toasts.saved"));
        const nextSlug = payload.slug ?? shopSlug;
        if (nextSlug !== shopSlug) {
          router.push(`/admin/${nextSlug}/settings`);
          return;
        }
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("adminSettings.errors.updateFailed"),
        );
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="shop-name">{t("adminSettings.fields.shopName.label")}</Label>
        <Input
          id="shop-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("adminSettings.fields.shopName.placeholder")}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="bank-details">{t("adminSettings.fields.bankDetails.label")}</Label>
        <Textarea
          id="bank-details"
          value={bankDetails}
          onChange={(event) => setBankDetails(event.target.value)}
          placeholder={t("adminSettings.fields.bankDetails.placeholder")}
          className="min-h-[100px]"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="payout-account">{t("adminSettings.fields.payoutAccount.label")}</Label>
          <Input
            id="payout-account"
            value={payoutAccount}
            onChange={(event) => setPayoutAccount(event.target.value)}
            placeholder={t("adminSettings.fields.payoutAccount.placeholder")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="payout-notes">{t("adminSettings.fields.payoutNotes.label")}</Label>
          <Textarea
            id="payout-notes"
            value={payoutNotes}
            onChange={(event) => setPayoutNotes(event.target.value)}
            placeholder={t("adminSettings.fields.payoutNotes.placeholder")}
            className="min-h-[100px]"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="order-notes">{t("adminSettings.fields.orderNotes.label")}</Label>
        <Textarea
          id="order-notes"
          value={orderNotes}
          onChange={(event) => setOrderNotes(event.target.value)}
          placeholder={t("adminSettings.fields.orderNotes.placeholder")}
          className="min-h-[100px]"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="inventory-notes">{t("adminSettings.fields.inventoryNotes.label")}</Label>
        <Textarea
          id="inventory-notes"
          value={inventoryNotes}
          onChange={(event) => setInventoryNotes(event.target.value)}
          placeholder={t("adminSettings.fields.inventoryNotes.placeholder")}
          className="min-h-[100px]"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="seller-email">{t("adminSettings.fields.sellerEmail.label")}</Label>
          <Input
            id="seller-email"
            type="email"
            value={sellerEmail}
            onChange={(event) => setSellerEmail(event.target.value)}
            placeholder={t("adminSettings.fields.sellerEmail.placeholder")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="seller-phone">{t("adminSettings.fields.sellerPhone.label")}</Label>
          <Input
            id="seller-phone"
            value={sellerPhone}
            onChange={(event) => setSellerPhone(event.target.value)}
            placeholder={t("adminSettings.fields.sellerPhone.placeholder")}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="seller-rules">{t("adminSettings.fields.sellerRules.label")}</Label>
        <Textarea
          id="seller-rules"
          value={sellerRules}
          onChange={(event) => setSellerRules(event.target.value)}
          placeholder={t("adminSettings.fields.sellerRules.placeholder")}
          className="min-h-[120px]"
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {t("adminSettings.actions.save")}
        </Button>
      </div>
    </form>
  );
}
