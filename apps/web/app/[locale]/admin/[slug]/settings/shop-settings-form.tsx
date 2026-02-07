"use client";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Textarea } from "@repo/ui/textarea";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation.client";

type Props = {
  shopSlug: string;
  initialName: string;
  initialBankDetails: string | null;
  initialPayoutAccount: string | null;
  initialPayoutNotes: string | null;
  initialOrderNotes: string | null;
  initialInventoryNotes: string | null;
};

export function ShopSettingsForm({
  shopSlug,
  initialName,
  initialBankDetails,
  initialPayoutAccount,
  initialPayoutNotes,
  initialOrderNotes,
  initialInventoryNotes,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [bankDetails, setBankDetails] = useState(initialBankDetails ?? "");
  const [payoutAccount, setPayoutAccount] = useState(initialPayoutAccount ?? "");
  const [payoutNotes, setPayoutNotes] = useState(initialPayoutNotes ?? "");
  const [orderNotes, setOrderNotes] = useState(initialOrderNotes ?? "");
  const [inventoryNotes, setInventoryNotes] = useState(initialInventoryNotes ?? "");
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
          }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || "Failed to update settings");
        }

        toast.success("Settings saved");
        const nextSlug = payload.slug ?? shopSlug;
        if (nextSlug !== shopSlug) {
          router.push(`/admin/${nextSlug}/settings`);
          return;
        }
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update settings");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="shop-name">Shop name</Label>
        <Input
          id="shop-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Shop name"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="bank-details">Bank details</Label>
        <Textarea
          id="bank-details"
          value={bankDetails}
          onChange={(event) => setBankDetails(event.target.value)}
          placeholder="Bank name / IBAN / branch"
          className="min-h-[100px]"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="payout-account">Payout account</Label>
          <Input
            id="payout-account"
            value={payoutAccount}
            onChange={(event) => setPayoutAccount(event.target.value)}
            placeholder="Account / IBAN"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="payout-notes">Payout notes</Label>
          <Textarea
            id="payout-notes"
            value={payoutNotes}
            onChange={(event) => setPayoutNotes(event.target.value)}
            placeholder="Payment cadence or requirements"
            className="min-h-[100px]"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="order-notes">Order notes</Label>
        <Textarea
          id="order-notes"
          value={orderNotes}
          onChange={(event) => setOrderNotes(event.target.value)}
          placeholder="Fulfillment instructions"
          className="min-h-[100px]"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="inventory-notes">Inventory notes</Label>
        <Textarea
          id="inventory-notes"
          value={inventoryNotes}
          onChange={(event) => setInventoryNotes(event.target.value)}
          placeholder="Thresholds, restock policy"
          className="min-h-[100px]"
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
