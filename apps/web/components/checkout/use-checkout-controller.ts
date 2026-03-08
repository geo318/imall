"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  checkoutCart,
  getCart,
  startInstallmentCheckout,
  syncInstallmentCheckoutStatus,
} from "@/actions/carts";
import {
  createMyShippingAddress,
  getMyShippingAddresses,
  type UserShippingAddress,
} from "@/actions/user-addresses";
import { useTranslations } from "@/i18n/provider";
import type { CartItem } from "@/lib/api/cart";
import { toast } from "sonner";
import { printCrystalInstallmentInvoice } from "./crystal-installment-invoice";
import {
  type CheckoutPaymentMethod,
  type CheckoutStep,
  EMPTY_SHIPPING_FORM,
  type InstallmentProvider,
  mapAddressToShippingForm,
  mapShippingFormToAddressInput,
  type ShippingFormState,
} from "./types";

type UseCheckoutControllerOptions = {
  cartKey: string;
  initialPaymentMethod?: CheckoutPaymentMethod;
  initialInstallmentProvider?: InstallmentProvider;
};

type PersistAddressOptions = {
  manual?: boolean;
};

const normalizeAddressValue = (value?: string | null) => (value ?? "").trim().toLowerCase();

function findDuplicateAddress(
  addresses: UserShippingAddress[],
  shippingForm: ShippingFormState,
): UserShippingAddress | undefined {
  const payload = mapShippingFormToAddressInput(shippingForm);

  return addresses.find(
    (address) =>
      normalizeAddressValue(address.firstName) === normalizeAddressValue(payload.firstName) &&
      normalizeAddressValue(address.lastName) === normalizeAddressValue(payload.lastName) &&
      normalizeAddressValue(address.addressLine1) === normalizeAddressValue(payload.addressLine1) &&
      normalizeAddressValue(address.city) === normalizeAddressValue(payload.city) &&
      normalizeAddressValue(address.postalCode) === normalizeAddressValue(payload.postalCode),
  );
}

export function useCheckoutController({
  cartKey,
  initialPaymentMethod = "card",
  initialInstallmentProvider = "credo",
}: UseCheckoutControllerOptions) {
  const t = useTranslations();
  const [items, setItems] = useState<CartItem[]>([]);
  const [step, setStep] = useState<CheckoutStep>("shipping");
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>(initialPaymentMethod);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingOrderCode, setPendingOrderCode] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [installmentProvider, setInstallmentProvider] =
    useState<InstallmentProvider>(initialInstallmentProvider);
  const [shippingForm, setShippingForm] = useState<ShippingFormState>(EMPTY_SHIPPING_FORM);
  const [savedAddresses, setSavedAddresses] = useState<UserShippingAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressActionPending, setAddressActionPending] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressMessage, setAddressMessage] = useState<string | null>(null);

  const installmentOrderCodeKey = `${cartKey}:installmentOrderCode`;
  const hasEnoughAddressFieldsToSave = useMemo(
    () =>
      Boolean(
        shippingForm.firstName.trim() &&
          shippingForm.lastName.trim() &&
          shippingForm.address.trim() &&
          shippingForm.city.trim(),
      ),
    [shippingForm],
  );
  const existingAddressMatch = useMemo(
    () => findDuplicateAddress(savedAddresses, shippingForm),
    [savedAddresses, shippingForm],
  );

  useEffect(() => {
    setPaymentMethod(initialPaymentMethod);
  }, [initialPaymentMethod]);
  useEffect(() => {
    setInstallmentProvider(initialInstallmentProvider);
  }, [initialInstallmentProvider]);

  useEffect(() => {
    let cancelled = false;

    async function loadCheckoutData() {
      const cartId = globalThis.window ? localStorage.getItem(cartKey) : null;
      const savedOrderCode = globalThis.window
        ? localStorage.getItem(installmentOrderCodeKey)
        : null;
      if (!cancelled) {
        setPendingOrderCode(savedOrderCode);
      }

      const [cartResult, addressesResult] = await Promise.allSettled([
        cartId ? getCart(cartId) : Promise.resolve({ items: [] }),
        getMyShippingAddresses(),
      ]);

      if (cancelled) return;

      if (cartResult.status === "fulfilled") {
        setItems(cartResult.value.items ?? []);
      } else {
        console.error("Failed to load cart:", cartResult.reason);
        setItems([]);
      }
      setLoading(false);

      if (addressesResult.status === "fulfilled") {
        const addresses = addressesResult.value;
        setSavedAddresses(addresses);
        const preferredAddress = addresses.find((address) => address.isDefault) ?? addresses[0];
        if (preferredAddress) {
          setShippingForm((previous) => {
            const hasAnyInput = Object.values(previous).some((value) => value.trim().length > 0);
            return hasAnyInput ? previous : mapAddressToShippingForm(preferredAddress);
          });
          setSelectedAddressId(preferredAddress.id);
        }
      } else {
        console.error("Failed to load saved addresses:", addressesResult.reason);
      }
      setAddressesLoading(false);
    }

    void loadCheckoutData();
    return () => {
      cancelled = true;
    };
  }, [cartKey, installmentOrderCodeKey]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.price) * item.qty, 0),
    [items],
  );
  const shipping = subtotal > 100 ? 0 : 9.99;
  const installmentCommission = paymentMethod === "installments" ? subtotal * 0.12 : 0;
  const total = subtotal + shipping + installmentCommission;

  const clearInstallmentState = useCallback(() => {
    setPendingOrderCode(null);
    setStatusMessage(null);
    if (globalThis.window) {
      localStorage.removeItem(installmentOrderCodeKey);
    }
  }, [installmentOrderCodeKey]);

  const applySavedAddress = useCallback((address: UserShippingAddress) => {
    setShippingForm(mapAddressToShippingForm(address));
    setSelectedAddressId(address.id);
    setAddressMessage(null);
  }, []);

  const handleShippingFieldChange = useCallback(
    (field: keyof ShippingFormState, value: string) => {
      setShippingForm((previous) => ({ ...previous, [field]: value }));
      if (selectedAddressId) {
        setSelectedAddressId(null);
      }
      if (addressMessage) {
        setAddressMessage(null);
      }
    },
    [addressMessage, selectedAddressId],
  );

  const persistCurrentAddress = useCallback(
    async ({ manual = false }: PersistAddressOptions = {}) => {
      if (!hasEnoughAddressFieldsToSave) {
        if (manual) {
          setErrorMessage(t("checkout.shipping.saveValidation"));
        }
        return null;
      }

      const payload = mapShippingFormToAddressInput(shippingForm, {
        isDefault: savedAddresses.length === 0,
      });

      const duplicate = findDuplicateAddress(savedAddresses, shippingForm);

      if (duplicate) {
        setSelectedAddressId(duplicate.id);
        if (manual) {
          setAddressMessage(t("checkout.shipping.alreadySaved"));
        }
        return duplicate;
      }

      try {
        setAddressActionPending(true);
        const created = await createMyShippingAddress(payload);
        setSavedAddresses((previous) => {
          const next = [...previous, created];
          return next.sort((left, right) => Number(right.isDefault) - Number(left.isDefault));
        });
        setSelectedAddressId(created.id);
        if (manual) {
          setAddressMessage(t("checkout.shipping.savedSuccess"));
        }
        return created;
      } catch (error) {
        if (manual) {
          const message =
            error instanceof Error ? error.message : t("checkout.shipping.saveFailedDefault");
          setErrorMessage(message);
        }
        return null;
      } finally {
        setAddressActionPending(false);
      }
    },
    [hasEnoughAddressFieldsToSave, savedAddresses, shippingForm, t],
  );

  const syncInstallmentStatus = useCallback(async () => {
    const cartId = globalThis.window ? localStorage.getItem(cartKey) : null;
    if (!cartId || !pendingOrderCode) return;

    setCheckingStatus(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const status = await syncInstallmentCheckoutStatus(cartId, pendingOrderCode);
      const statusLabel = status.statusName || `#${status.statusId ?? "unknown"}`;

      if (status.checkoutCompleted) {
        localStorage.removeItem(cartKey);
        clearInstallmentState();
        setStep("confirmation");
        return;
      }

      const normalizedStatus = statusLabel.toUpperCase();
      if (normalizedStatus === "NO_DATA") {
        setStatusMessage(t("checkout.installments.notFound"));
        return;
      }
      if (
        normalizedStatus === "INVALID_REQUEST" ||
        normalizedStatus === "BAD_REQUEST" ||
        normalizedStatus === "EMPTY_REQUEST"
      ) {
        setStatusMessage(t("checkout.installments.invalidRequest"));
        return;
      }

      setStatusMessage(t("checkout.installments.statusWithLabel", { status: statusLabel }));
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[checkout] syncInstallmentStatus failed", error);
      }
      setErrorMessage(t("checkout.installments.syncFailed"));
    } finally {
      setCheckingStatus(false);
    }
  }, [cartKey, clearInstallmentState, pendingOrderCode, t]);

  const continueFromShipping = useCallback(async () => {
    if (savedAddresses.length === 0) {
      await persistCurrentAddress();
    }
    setStep("payment");
  }, [persistCurrentAddress, savedAddresses.length]);

  const submitCheckout = useCallback(async () => {
    const cartId = globalThis.window ? localStorage.getItem(cartKey) : null;
    if (!cartId) return;

    setSubmitting(true);
    try {
      if (paymentMethod === "installments") {
        if (installmentProvider === "crystal") {
          await printCrystalInstallmentInvoice({
            buyer: shippingForm,
            items,
            subtotal,
            shipping,
            installmentCommission,
            total,
          });
          toast.success(t("checkout.installments.manual.invoiceGenerated"));
          return;
        }

        const fullName = `${shippingForm.firstName} ${shippingForm.lastName}`.trim();
        const session = await startInstallmentCheckout(cartId, {
          installmentLength: 12,
          clientFullName: fullName || undefined,
          mobile: shippingForm.phone.trim() || undefined,
          email: shippingForm.email.trim() || undefined,
          factAddress: shippingForm.address.trim() || undefined,
        });

        localStorage.setItem(installmentOrderCodeKey, session.orderCode);
        setPendingOrderCode(session.orderCode);
        globalThis.window.location.assign(session.redirectUrl);
        return;
      }

      await checkoutCart(cartId);
      localStorage.removeItem(cartKey);
      clearInstallmentState();
      setStep("confirmation");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("checkout.errors.default");
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  }, [
    cartKey,
    clearInstallmentState,
    installmentCommission,
    installmentOrderCodeKey,
    installmentProvider,
    items,
    paymentMethod,
    shipping,
    shippingForm,
    subtotal,
    t,
    total,
  ]);

  const handleContinue = useCallback(async () => {
    setErrorMessage(null);

    if (step === "shipping") {
      await continueFromShipping();
      return;
    }

    if (step === "payment") {
      await submitCheckout();
    }
  }, [continueFromShipping, step, submitCheckout]);

  return {
    items,
    step,
    setStep,
    paymentMethod,
    setPaymentMethod,
    loading,
    submitting,
    errorMessage,
    setErrorMessage,
    pendingOrderCode,
    statusMessage,
    checkingStatus,
    installmentProvider,
    setInstallmentProvider,
    syncInstallmentStatus,
    clearInstallmentState,
    shippingForm,
    handleShippingFieldChange,
    savedAddresses,
    addressesLoading,
    addressActionPending,
    selectedAddressId,
    addressMessage,
    saveAddressDisabled: Boolean(existingAddressMatch),
    applySavedAddress,
    persistCurrentAddress,
    handleContinue,
    subtotal,
    shipping,
    installmentCommission,
    total,
  };
}
