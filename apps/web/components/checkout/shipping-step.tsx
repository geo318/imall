"use client";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { MapPin, Truck } from "lucide-react";
import type { UserShippingAddress } from "@/actions/user-addresses";
import { Link } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";
import { getAddressDisplayLabel, type ShippingFormState } from "./types";

type ShippingStepProps = {
  shippingForm: ShippingFormState;
  onShippingFieldChange: (field: keyof ShippingFormState, value: string) => void;
  savedAddresses: UserShippingAddress[];
  addressesLoading: boolean;
  selectedAddressId: string | null;
  onApplySavedAddress: (address: UserShippingAddress) => void;
  addressMessage: string | null;
  addressActionPending: boolean;
  saveAddressDisabled: boolean;
  submitting: boolean;
  onSaveAddress: () => Promise<unknown> | unknown;
  onContinue: () => Promise<void> | void;
};

export function ShippingStep({
  shippingForm,
  onShippingFieldChange,
  savedAddresses,
  addressesLoading,
  selectedAddressId,
  onApplySavedAddress,
  addressMessage,
  addressActionPending,
  saveAddressDisabled,
  submitting,
  onSaveAddress,
  onContinue,
}: ShippingStepProps) {
  const t = useTranslations();

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Truck className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-semibold">{t("checkout.shipping.title")}</h2>
      </div>

      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-700">
            {t("checkout.shipping.savedAddresses")}
          </p>
          <Link href="/account/addresses" className="text-xs text-emerald-700 hover:underline">
            {t("checkout.shipping.manageAddresses")}
          </Link>
        </div>

        {addressesLoading ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            {t("checkout.shipping.loadingAddresses")}
          </div>
        ) : savedAddresses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            {t("checkout.shipping.noSavedAddresses")}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {savedAddresses.map((address) => (
              <button
                type="button"
                key={address.id}
                onClick={() => onApplySavedAddress(address)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  selectedAddressId === address.id
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-200 hover:border-emerald-300"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-slate-900">
                    {getAddressDisplayLabel(address)}
                  </span>
                  {address.isDefault ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      {t("checkout.shipping.defaultBadge")}
                    </span>
                  ) : null}
                </div>
                <p className="line-clamp-2 text-xs text-slate-600">
                  {address.addressLine1}, {address.city}
                  {address.region ? `, ${address.region}` : ""}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">{t("checkout.shipping.firstName")}</Label>
          <Input
            id="firstName"
            placeholder={t("checkout.shipping.firstNamePlaceholder")}
            value={shippingForm.firstName}
            onChange={(event) => onShippingFieldChange("firstName", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">{t("checkout.shipping.lastName")}</Label>
          <Input
            id="lastName"
            placeholder={t("checkout.shipping.lastNamePlaceholder")}
            value={shippingForm.lastName}
            onChange={(event) => onShippingFieldChange("lastName", event.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="email">{t("checkout.shipping.email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            value={shippingForm.email}
            onChange={(event) => onShippingFieldChange("email", event.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">{t("checkout.shipping.address")}</Label>
          <Input
            id="address"
            placeholder={t("checkout.shipping.addressPlaceholder")}
            value={shippingForm.address}
            onChange={(event) => onShippingFieldChange("address", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">{t("checkout.shipping.city")}</Label>
          <Input
            id="city"
            placeholder={t("checkout.shipping.cityPlaceholder")}
            value={shippingForm.city}
            onChange={(event) => onShippingFieldChange("city", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">{t("checkout.shipping.state")}</Label>
          <Input
            id="state"
            placeholder={t("checkout.shipping.statePlaceholder")}
            value={shippingForm.state}
            onChange={(event) => onShippingFieldChange("state", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zip">{t("checkout.shipping.zip")}</Label>
          <Input
            id="zip"
            placeholder={t("checkout.shipping.zipPlaceholder")}
            value={shippingForm.zip}
            onChange={(event) => onShippingFieldChange("zip", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">{t("checkout.shipping.phone")}</Label>
          <Input
            id="phone"
            placeholder={t("checkout.shipping.phonePlaceholder")}
            value={shippingForm.phone}
            onChange={(event) => onShippingFieldChange("phone", event.target.value)}
          />
        </div>
      </div>

      {addressMessage ? <p className="mt-4 text-sm text-emerald-700">{addressMessage}</p> : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="sm:w-auto"
          disabled={addressActionPending || submitting || saveAddressDisabled}
          onClick={() => void onSaveAddress()}
        >
          <MapPin className="mr-2 h-4 w-4" />
          {t("checkout.shipping.saveAddress")}
        </Button>
        <Button
          onClick={() => void onContinue()}
          className="w-full sm:flex-1"
          size="lg"
          disabled={submitting || addressActionPending}
        >
          {t("checkout.actions.continueToPayment")}
        </Button>
      </div>
    </div>
  );
}
