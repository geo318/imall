"use client";

import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { ArrowLeft, MapPin, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createMyShippingAddress,
  deleteMyShippingAddress,
  getMyShippingAddresses,
  setDefaultShippingAddress,
  type UserShippingAddress,
  type UserShippingAddressInput,
} from "@/actions/user-addresses";
import { Link } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";

type AddressFormState = {
  label: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  region: string;
  postalCode: string;
};

const EMPTY_FORM: AddressFormState = {
  label: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  addressLine1: "",
  city: "",
  region: "",
  postalCode: "",
};

const sortAddresses = (addresses: UserShippingAddress[]) =>
  [...addresses].sort((left, right) => {
    if (left.isDefault !== right.isDefault) return Number(right.isDefault) - Number(left.isDefault);
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });

function toAddressPayload(form: AddressFormState, isDefault: boolean): UserShippingAddressInput {
  return {
    label: form.label.trim() || undefined,
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    addressLine1: form.addressLine1.trim(),
    city: form.city.trim(),
    region: form.region.trim() || undefined,
    postalCode: form.postalCode.trim() || undefined,
    country: "GE",
    isDefault,
  };
}

export default function AccountAddressesPage() {
  const t = useTranslations();
  const [addresses, setAddresses] = useState<UserShippingAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [defaultingId, setDefaultingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressFormState>(EMPTY_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadAddresses() {
      try {
        const next = await getMyShippingAddresses();
        setAddresses(sortAddresses(next));
      } catch (error) {
        const message = error instanceof Error ? error.message : t("accountAddresses.errors.load");
        setErrorMessage(message);
      } finally {
        setLoading(false);
      }
    }

    loadAddresses();
  }, [t]);

  const isFormReady = useMemo(() => {
    return Boolean(
      form.firstName.trim() && form.lastName.trim() && form.addressLine1.trim() && form.city.trim(),
    );
  }, [form]);

  const handleFieldChange = (field: keyof AddressFormState, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (errorMessage) setErrorMessage(null);
    if (successMessage) setSuccessMessage(null);
  };

  const handleCreateAddress = async () => {
    if (!isFormReady) {
      setErrorMessage(t("accountAddresses.errors.required"));
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const created = await createMyShippingAddress(toAddressPayload(form, addresses.length === 0));
      setAddresses((previous) => sortAddresses([...previous, created]));
      setForm(EMPTY_FORM);
      setSuccessMessage(t("accountAddresses.success.created"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("accountAddresses.errors.save");
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    setDefaultingId(addressId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updated = await setDefaultShippingAddress(addressId);
      setAddresses((previous) =>
        sortAddresses(
          previous.map((address) =>
            address.id === updated.id
              ? updated
              : {
                  ...address,
                  isDefault: false,
                },
          ),
        ),
      );
      setSuccessMessage(t("accountAddresses.success.defaultUpdated"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("accountAddresses.errors.updateDefault");
      setErrorMessage(message);
    } finally {
      setDefaultingId(null);
    }
  };

  const handleDelete = async (addressId: string) => {
    setDeletingId(addressId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await deleteMyShippingAddress(addressId);
      setAddresses((previous) => previous.filter((address) => address.id !== addressId));
      setSuccessMessage(t("accountAddresses.success.deleted"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("accountAddresses.errors.delete");
      setErrorMessage(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="container py-8 md:py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center text-sm text-slate-600 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("accountAddresses.back")}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <MapPin className="h-5 w-5 text-emerald-600" />
              {t("accountAddresses.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">{t("accountAddresses.loading")}</p>
            ) : addresses.length === 0 ? (
              <p className="text-sm text-slate-500">{t("accountAddresses.empty")}</p>
            ) : (
              <div className="space-y-3">
                {addresses.map((address) => {
                  const name = `${address.firstName} ${address.lastName}`.trim();
                  return (
                    <div
                      key={address.id}
                      className="rounded-lg border border-slate-200 p-4 transition-colors hover:border-emerald-200"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {address.label?.trim() || name}
                          </p>
                          {address.isDefault ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              {t("accountAddresses.defaultBadge")}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {!address.isDefault ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={defaultingId === address.id}
                              onClick={() => void handleSetDefault(address.id)}
                            >
                              <Star className="mr-1 h-3.5 w-3.5" />
                              {t("accountAddresses.actions.makeDefault")}
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={deletingId === address.id}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => void handleDelete(address.id)}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            {t("accountAddresses.actions.delete")}
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600">{name}</p>
                      <p className="text-sm text-slate-600">{address.addressLine1}</p>
                      <p className="text-sm text-slate-600">
                        {address.city}
                        {address.region ? `, ${address.region}` : ""}
                        {address.postalCode ? `, ${address.postalCode}` : ""}
                      </p>
                      {address.phone ? (
                        <p className="text-sm text-slate-500">{address.phone}</p>
                      ) : null}
                      {address.email ? (
                        <p className="text-sm text-slate-500">{address.email}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("accountAddresses.form.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address-label">{t("accountAddresses.form.label")}</Label>
              <Input
                id="address-label"
                placeholder={t("accountAddresses.form.labelPlaceholder")}
                value={form.label}
                onChange={(event) => handleFieldChange("label", event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="address-firstName">{t("checkout.shipping.firstName")}</Label>
                <Input
                  id="address-firstName"
                  value={form.firstName}
                  placeholder={t("checkout.shipping.firstNamePlaceholder")}
                  onChange={(event) => handleFieldChange("firstName", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address-lastName">{t("checkout.shipping.lastName")}</Label>
                <Input
                  id="address-lastName"
                  value={form.lastName}
                  placeholder={t("checkout.shipping.lastNamePlaceholder")}
                  onChange={(event) => handleFieldChange("lastName", event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-email">{t("checkout.shipping.email")}</Label>
              <Input
                id="address-email"
                type="email"
                placeholder="john@example.com"
                value={form.email}
                onChange={(event) => handleFieldChange("email", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-line1">{t("checkout.shipping.address")}</Label>
              <Input
                id="address-line1"
                placeholder={t("checkout.shipping.addressPlaceholder")}
                value={form.addressLine1}
                onChange={(event) => handleFieldChange("addressLine1", event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="address-city">{t("checkout.shipping.city")}</Label>
                <Input
                  id="address-city"
                  placeholder={t("checkout.shipping.cityPlaceholder")}
                  value={form.city}
                  onChange={(event) => handleFieldChange("city", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address-region">{t("checkout.shipping.state")}</Label>
                <Input
                  id="address-region"
                  placeholder={t("checkout.shipping.statePlaceholder")}
                  value={form.region}
                  onChange={(event) => handleFieldChange("region", event.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="address-zip">{t("checkout.shipping.zip")}</Label>
                <Input
                  id="address-zip"
                  placeholder={t("checkout.shipping.zipPlaceholder")}
                  value={form.postalCode}
                  onChange={(event) => handleFieldChange("postalCode", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address-phone">{t("checkout.shipping.phone")}</Label>
                <Input
                  id="address-phone"
                  placeholder={t("checkout.shipping.phonePlaceholder")}
                  value={form.phone}
                  onChange={(event) => handleFieldChange("phone", event.target.value)}
                />
              </div>
            </div>

            {errorMessage ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}
            {successMessage ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {successMessage}
              </p>
            ) : null}

            <Button
              type="button"
              className="w-full"
              disabled={saving}
              onClick={() => void handleCreateAddress()}
            >
              <Plus className="mr-2 h-4 w-4" />
              {saving ? t("accountAddresses.form.saving") : t("accountAddresses.form.save")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
