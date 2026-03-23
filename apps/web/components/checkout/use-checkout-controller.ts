"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import {
  clearCartIdFromStorage,
  readCartIdFromStorage,
  writeCartIdToStorage,
} from "@/lib/cart-storage";
import {
  buildCredoLaunchUrl,
  type CredoLaunchMode,
  clearPersistedInstallmentCookies,
  normalizeCredoMobile,
  normalizeCredoRedirectUrl,
  readPersistedInstallmentState,
} from "./credo-launch";
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

type CredoLaunchFormConfig = {
  action: string;
  fields: Record<string, string>;
  ready: boolean;
};

const DEFAULT_CART_STORAGE_KEY = "cart";

const normalizeAddressValue = (value?: string | null) => (value ?? "").trim().toLowerCase();

type CrystalInvoicePayload = {
  buyer: ShippingFormState;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  installmentCommission: number;
  total: number;
};

type PrintCrystalInstallmentInvoice = (input: CrystalInvoicePayload) => Promise<void>;

let crystalInvoicePrinterPromise: Promise<PrintCrystalInstallmentInvoice> | null = null;

async function getCrystalInvoicePrinter(): Promise<PrintCrystalInstallmentInvoice> {
  if (!crystalInvoicePrinterPromise) {
    crystalInvoicePrinterPromise = import("./crystal-installment-invoice").then(
      (module) => module.printCrystalInstallmentInvoice,
    );
  }
  return crystalInvoicePrinterPromise;
}

function hasRequiredCredoCustomerData(shippingForm: ShippingFormState): boolean {
  const mobile = normalizeCredoMobile(shippingForm.phone);
  return Boolean(
    shippingForm.firstName.trim() &&
      shippingForm.lastName.trim() &&
      shippingForm.email.trim() &&
      mobile &&
      shippingForm.address.trim(),
  );
}

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

function resolveStoredCartId(cartKey: string): string | null {
  const directCartId = readCartIdFromStorage(cartKey);
  if (directCartId) {
    return directCartId;
  }

  if (cartKey === DEFAULT_CART_STORAGE_KEY) {
    return null;
  }

  const fallbackCartId = readCartIdFromStorage(DEFAULT_CART_STORAGE_KEY);
  if (fallbackCartId) {
    writeCartIdToStorage(fallbackCartId, cartKey);
  }
  return fallbackCartId;
}

function clearCheckoutCartKeys(cartKey: string) {
  clearCartIdFromStorage(cartKey);
  if (cartKey !== DEFAULT_CART_STORAGE_KEY) {
    clearCartIdFromStorage(DEFAULT_CART_STORAGE_KEY);
  }
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
  const [pendingRedirectUrl, setPendingRedirectUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [installmentProvider, setInstallmentProvider] = useState<InstallmentProvider>(
    initialInstallmentProvider,
  );
  const [shippingForm, setShippingForm] = useState<ShippingFormState>(EMPTY_SHIPPING_FORM);
  const [savedAddresses, setSavedAddresses] = useState<UserShippingAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressActionPending, setAddressActionPending] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressMessage, setAddressMessage] = useState<string | null>(null);

  const installmentOrderCodeKey = `${cartKey}:installmentOrderCode`;
  const installmentRedirectUrlKey = `${cartKey}:installmentRedirectUrl`;
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
  const credoLaunchForm = useMemo<CredoLaunchFormConfig>(() => {
    const cartId = typeof globalThis.window !== "undefined" ? resolveStoredCartId(cartKey) : null;
    const fullName = `${shippingForm.firstName} ${shippingForm.lastName}`.trim();
    const normalizedMobile = normalizeCredoMobile(shippingForm.phone);

    return {
      action: "/api/checkout/installments/credo/launch",
      ready: Boolean(cartId) && hasRequiredCredoCustomerData(shippingForm),
      fields: {
        cartId: cartId ?? "",
        cartKey,
        installmentLength: "12",
        clientFullName: fullName,
        mobile: normalizedMobile,
        email: shippingForm.email.trim(),
        factAddress: shippingForm.address.trim(),
        returnTo:
          typeof globalThis.window !== "undefined"
            ? `${globalThis.window.location.pathname}${globalThis.window.location.search}`
            : "",
      },
    };
  }, [cartKey, shippingForm]);

  const hydratePendingInstallmentState = useCallback(() => {
    const localOrderCode =
      typeof globalThis.window !== "undefined"
        ? localStorage.getItem(installmentOrderCodeKey)
        : null;
    const localRedirectUrl =
      typeof globalThis.window !== "undefined"
        ? localStorage.getItem(installmentRedirectUrlKey)
        : null;
    const persistedCookieState =
      typeof document !== "undefined"
        ? readPersistedInstallmentState(cartKey, document.cookie)
        : null;

    const nextOrderCode = localOrderCode || persistedCookieState?.orderCode || null;
    const nextRedirectUrl = localRedirectUrl || persistedCookieState?.redirectUrl || null;

    setPendingOrderCode(nextOrderCode);
    setPendingRedirectUrl(nextRedirectUrl);

    if (
      typeof globalThis.window !== "undefined" &&
      persistedCookieState?.orderCode &&
      !localOrderCode
    ) {
      localStorage.setItem(installmentOrderCodeKey, persistedCookieState.orderCode);
    }
    if (
      typeof globalThis.window !== "undefined" &&
      persistedCookieState?.redirectUrl &&
      !localRedirectUrl
    ) {
      localStorage.setItem(installmentRedirectUrlKey, persistedCookieState.redirectUrl);
    }
  }, [cartKey, installmentOrderCodeKey, installmentRedirectUrlKey]);

  useEffect(() => {
    setPaymentMethod(initialPaymentMethod);
  }, [initialPaymentMethod]);
  useEffect(() => {
    setInstallmentProvider(initialInstallmentProvider);
  }, [initialInstallmentProvider]);

  useEffect(() => {
    let cancelled = false;

    async function loadCheckoutData() {
      const cartId = resolveStoredCartId(cartKey);
      if (!cancelled) hydratePendingInstallmentState();

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
  }, [cartKey, hydratePendingInstallmentState]);

  useEffect(() => {
    if (typeof globalThis.window === "undefined") {
      return;
    }

    const handleFocus = () => {
      hydratePendingInstallmentState();
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        hydratePendingInstallmentState();
      }
    };

    globalThis.window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      globalThis.window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hydratePendingInstallmentState]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.price) * item.qty, 0),
    [items],
  );
  const uniqueVendorCount = useMemo(
    () => new Set(items.map((item) => item.tenantId).filter(Boolean)).size,
    [items],
  );
  const onlineInstallmentsAllowed = uniqueVendorCount <= 1;
  const shipping = subtotal > 100 ? 0 : 9.99;
  const installmentCommission = paymentMethod === "installments" ? subtotal * 0.12 : 0;
  const total = subtotal + shipping + installmentCommission;

  useEffect(() => {
    if (!onlineInstallmentsAllowed && installmentProvider === "credo") {
      setInstallmentProvider("crystal");
    }
  }, [installmentProvider, onlineInstallmentsAllowed]);

  const clearInstallmentState = useCallback(() => {
    setPendingOrderCode(null);
    setPendingRedirectUrl(null);
    setStatusMessage(null);
    if (globalThis.window) {
      localStorage.removeItem(installmentOrderCodeKey);
      localStorage.removeItem(installmentRedirectUrlKey);
    }
    clearPersistedInstallmentCookies();
  }, [installmentOrderCodeKey, installmentRedirectUrlKey]);

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
    const cartId = resolveStoredCartId(cartKey);
    if (!cartId || !pendingOrderCode) return;

    setCheckingStatus(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const status = await syncInstallmentCheckoutStatus(cartId, pendingOrderCode);
      const statusLabel = status.statusName || `#${status.statusId ?? "unknown"}`;

      if (status.checkoutCompleted) {
        clearCheckoutCartKeys(cartKey);
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

  const submitCheckout = useCallback(
    async (launchMode: CredoLaunchMode = "server-assign") => {
      const cartId = resolveStoredCartId(cartKey);
      if (!cartId) return;
      setSubmitting(true);
      try {
        if (paymentMethod === "installments") {
          if (!onlineInstallmentsAllowed && installmentProvider === "credo") {
            setErrorMessage(t("checkout.payment.onlineInstallmentsMultiVendorError"));
            return;
          }

          if (installmentProvider === "credo" && !hasRequiredCredoCustomerData(shippingForm)) {
            setErrorMessage(t("checkout.installments.missingCredoData"));
            return;
          }

          if (installmentProvider === "crystal") {
            const printCrystalInstallmentInvoice = await getCrystalInvoicePrinter();
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
          const normalizedMobile = normalizeCredoMobile(shippingForm.phone);
          const launchUrl = buildCredoLaunchUrl({
            cartId,
            cartKey,
            installmentLength: 12,
            clientFullName: fullName || undefined,
            mobile: normalizedMobile || undefined,
            email: shippingForm.email.trim() || undefined,
            factAddress: shippingForm.address.trim() || undefined,
            returnTo:
              typeof globalThis.window !== "undefined"
                ? `${globalThis.window.location.pathname}${globalThis.window.location.search}`
                : undefined,
          });

          if (launchMode !== "direct-replace") {
            if (launchMode === "server-new-tab") {
              const newTab = globalThis.window.open(launchUrl, "_blank");
              if (!newTab) {
                throw new Error(t("checkout.installments.popupBlocked"));
              }
              hydratePendingInstallmentState();
              return;
            }

            if (launchMode === "server-popup") {
              const popup = globalThis.window.open(
                launchUrl,
                "credo_installments",
                "popup=yes,width=520,height=820",
              );
              if (!popup) {
                throw new Error(t("checkout.installments.popupBlocked"));
              }
              hydratePendingInstallmentState();
              return;
            }

            if (launchMode === "server-replace") {
              globalThis.window.location.replace(launchUrl);
              return;
            }

            globalThis.window.location.assign(launchUrl);
            return;
          }

          const session = await startInstallmentCheckout(cartId, {
            installmentLength: 12,
            clientFullName: fullName || undefined,
            mobile: normalizedMobile || undefined,
            email: shippingForm.email.trim() || undefined,
            factAddress: shippingForm.address.trim() || undefined,
          });

          localStorage.setItem(installmentOrderCodeKey, session.orderCode);
          const normalizedRedirectUrl = normalizeCredoRedirectUrl(session.redirectUrl);
          const redirectHost = (() => {
            try {
              return new URL(normalizedRedirectUrl).hostname.toLowerCase();
            } catch {
              return "";
            }
          })();
          if (!redirectHost.endsWith("credo.ge")) {
            throw new Error(`Unexpected installment redirect host: ${redirectHost || "unknown"}`);
          }

          localStorage.setItem(installmentRedirectUrlKey, normalizedRedirectUrl);
          writeCartIdToStorage(cartId, cartKey);
          setPendingOrderCode(session.orderCode);
          setPendingRedirectUrl(normalizedRedirectUrl);
          globalThis.window.location.replace(normalizedRedirectUrl);
          return;
        }

        await checkoutCart(cartId);
        clearCheckoutCartKeys(cartKey);
        clearInstallmentState();
        setStep("confirmation");
      } catch (error) {
        const message = error instanceof Error ? error.message : t("checkout.errors.default");
        setErrorMessage(message);
      } finally {
        setSubmitting(false);
      }
    },
    [
      cartKey,
      clearInstallmentState,
      hydratePendingInstallmentState,
      installmentCommission,
      installmentOrderCodeKey,
      installmentRedirectUrlKey,
      installmentProvider,
      items,
      onlineInstallmentsAllowed,
      paymentMethod,
      shipping,
      shippingForm,
      subtotal,
      t,
      total,
    ],
  );

  const handleContinue = useCallback(
    async (launchMode?: CredoLaunchMode) => {
      setErrorMessage(null);

      if (step === "shipping") {
        await continueFromShipping();
        return;
      }

      if (step === "payment") {
        await submitCheckout(launchMode);
      }
    },
    [continueFromShipping, step, submitCheckout],
  );

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
    pendingRedirectUrl,
    statusMessage,
    checkingStatus,
    installmentProvider,
    setInstallmentProvider,
    onlineInstallmentsAllowed,
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
    credoLaunchForm,
    subtotal,
    shipping,
    installmentCommission,
    total,
  };
}
