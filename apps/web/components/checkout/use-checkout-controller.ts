"use client";

import { useQuery } from "@tanstack/react-query";
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
  updateMyShippingAddress,
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
  buildKeepzLaunchUrl,
  type CredoLaunchMode,
  clearPersistedInstallmentCookies,
  normalizeCredoMobile,
  normalizeCredoRedirectUrl,
  normalizeKeepzPersonalNumber,
  normalizeKeepzRedirectUrl,
  type OnlineCheckoutPaymentType,
  type OnlineCheckoutProvider,
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

type OnlineLaunchFormConfig = {
  action: string;
  fields: Record<string, string>;
  provider: OnlineCheckoutProvider;
  ready: boolean;
  reason: "missingCart" | "missingCustomerData" | "missingKeepzPersonalNumber" | null;
};

const DEFAULT_CART_STORAGE_KEY = "cart";
const INSTALLMENT_STATUS_PING_INTERVAL_MS = 12_000;
const INSTALLMENT_STATUS_PING_INTERVAL_SLOW_MS = 30_000;
const INSTALLMENT_STATUS_PING_SLOW_AFTER_MS = 3 * 60_000;
const INSTALLMENT_STATUS_PING_MAX_WINDOW_MS = 20 * 60_000;
const INSTALLMENT_STATUS_MAX_ERROR_STREAK = 5;

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

export function hasRequiredCredoCustomerData(shippingForm: ShippingFormState): boolean {
  const mobile = normalizeCredoMobile(shippingForm.phone);
  return Boolean(
    shippingForm.firstName.trim() &&
      shippingForm.lastName.trim() &&
      shippingForm.email.trim() &&
      mobile &&
      shippingForm.address.trim(),
  );
}

function isValidKeepzPersonalNumber(rawValue: string): boolean {
  const normalized = normalizeKeepzPersonalNumber(rawValue);
  return normalized.length === 9 || normalized.length === 11;
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

export function matchingAddressNeedsRefresh(
  address: UserShippingAddress,
  shippingForm: ShippingFormState,
): boolean {
  const payload = mapShippingFormToAddressInput(shippingForm);

  return (
    normalizeAddressValue(address.email) !== normalizeAddressValue(payload.email) ||
    normalizeAddressValue(address.phone) !== normalizeAddressValue(payload.phone) ||
    normalizeAddressValue(address.region) !== normalizeAddressValue(payload.region)
  );
}

export function listStoredCartEntries(): Array<{ key: string; cartId: string }> {
  if (typeof globalThis.window === "undefined") {
    return [];
  }

  const entries: Array<{ key: string; cartId: string }> = [];
  for (let index = 0; index < globalThis.window.localStorage.length; index += 1) {
    const key = globalThis.window.localStorage.key(index);
    if (
      !key ||
      (key !== DEFAULT_CART_STORAGE_KEY && !key.startsWith(`${DEFAULT_CART_STORAGE_KEY}:`))
    ) {
      continue;
    }

    const cartId = globalThis.window.localStorage.getItem(key);
    if (!cartId) {
      continue;
    }

    entries.push({ key, cartId });
  }

  return entries;
}

export function resolveStoredCartId(cartKey: string): string | null {
  const directCartId = readCartIdFromStorage(cartKey);
  if (directCartId) {
    return directCartId;
  }

  const fallbackCartId = readCartIdFromStorage(DEFAULT_CART_STORAGE_KEY);
  if (fallbackCartId && cartKey !== DEFAULT_CART_STORAGE_KEY) {
    writeCartIdToStorage(fallbackCartId, cartKey);
    return fallbackCartId;
  }

  const cartEntries = listStoredCartEntries();
  const uniqueCartIds = [...new Set(cartEntries.map((entry) => entry.cartId))];
  if (uniqueCartIds.length !== 1) {
    return null;
  }

  const [resolvedCartId] = uniqueCartIds;
  if (!resolvedCartId) {
    return null;
  }

  writeCartIdToStorage(resolvedCartId, cartKey);
  if (cartKey !== DEFAULT_CART_STORAGE_KEY) {
    writeCartIdToStorage(resolvedCartId, DEFAULT_CART_STORAGE_KEY);
  }

  return resolvedCartId;
}

export function clearCheckoutCartKeys(cartKey: string, cartId?: string | null) {
  clearCartIdFromStorage(cartKey);
  const defaultCartId = readCartIdFromStorage(DEFAULT_CART_STORAGE_KEY);
  if (cartKey === DEFAULT_CART_STORAGE_KEY || (cartId && defaultCartId === cartId)) {
    clearCartIdFromStorage(DEFAULT_CART_STORAGE_KEY);
  }

  if (typeof globalThis.window === "undefined" || !cartId) {
    return;
  }

  for (const entry of listStoredCartEntries()) {
    if (entry.cartId === cartId) {
      clearCartIdFromStorage(entry.key);
    }
  }
}

export function isCredoLaunchReady(cartKey: string, shippingForm: ShippingFormState): boolean {
  return Boolean(resolveStoredCartId(cartKey)) && hasRequiredCredoCustomerData(shippingForm);
}

export function getCredoLaunchBlockReason(
  cartKey: string,
  shippingForm: ShippingFormState,
): "missingCart" | "missingCustomerData" | null {
  if (!resolveStoredCartId(cartKey)) {
    return "missingCart";
  }

  if (!hasRequiredCredoCustomerData(shippingForm)) {
    return "missingCustomerData";
  }

  return null;
}

export function useCheckoutController({
  cartKey,
  initialPaymentMethod = "card",
  initialInstallmentProvider = "keepz",
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
  const [installmentProvider, setInstallmentProvider] = useState<InstallmentProvider>(
    initialInstallmentProvider,
  );
  const [keepzPersonalNumber, setKeepzPersonalNumber] = useState("");
  const [pendingProvider, setPendingProvider] = useState<OnlineCheckoutProvider | null>(null);
  const [pendingPaymentType, setPendingPaymentType] = useState<OnlineCheckoutPaymentType | null>(
    null,
  );
  const [pendingInstallmentStartedAtMs, setPendingInstallmentStartedAtMs] = useState<number | null>(
    null,
  );
  const [installmentStatusErrorStreak, setInstallmentStatusErrorStreak] = useState(0);
  const [isPageActive, setIsPageActive] = useState(() => {
    if (typeof document === "undefined") {
      return true;
    }
    return !document.hidden && document.visibilityState === "visible" && document.hasFocus();
  });
  const [shippingForm, setShippingForm] = useState<ShippingFormState>(EMPTY_SHIPPING_FORM);
  const [savedAddresses, setSavedAddresses] = useState<UserShippingAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressActionPending, setAddressActionPending] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressMessage, setAddressMessage] = useState<string | null>(null);

  const installmentOrderCodeKey = `${cartKey}:installmentOrderCode`;
  const installmentRedirectUrlKey = `${cartKey}:installmentRedirectUrl`;
  const installmentProviderKey = `${cartKey}:installmentProvider`;
  const installmentPaymentTypeKey = `${cartKey}:installmentPaymentType`;
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
  const existingAddressNeedsRefresh = useMemo(
    () =>
      existingAddressMatch
        ? matchingAddressNeedsRefresh(existingAddressMatch, shippingForm)
        : false,
    [existingAddressMatch, shippingForm],
  );
  const onlineLaunchForm = useMemo<OnlineLaunchFormConfig>(() => {
    const cartId = typeof globalThis.window !== "undefined" ? resolveStoredCartId(cartKey) : null;
    const fullName = `${shippingForm.firstName} ${shippingForm.lastName}`.trim();
    const normalizedMobile = normalizeCredoMobile(shippingForm.phone);
    const normalizedPersonalNumber = normalizeKeepzPersonalNumber(keepzPersonalNumber);
    const returnTo =
      typeof globalThis.window !== "undefined"
        ? `${globalThis.window.location.pathname}${globalThis.window.location.search}`
        : "";

    if (installmentProvider === "keepz") {
      const fields: Record<string, string> = {
        cartId: cartId ?? "",
        cartKey,
        paymentType: "installments",
        personalNumber: normalizedPersonalNumber,
        isForeign: "false",
        returnTo,
      };
      const reason =
        typeof globalThis.window !== "undefined"
          ? !resolveStoredCartId(cartKey)
            ? "missingCart"
            : !isValidKeepzPersonalNumber(normalizedPersonalNumber)
              ? "missingKeepzPersonalNumber"
              : null
          : null;

      return {
        provider: "keepz",
        action: "/api/checkout/installments/keepz/launch",
        ready: reason === null,
        reason,
        fields,
      };
    }

    const fields: Record<string, string> = {
      cartId: cartId ?? "",
      cartKey,
      paymentType: "installments",
      installmentLength: "12",
      clientFullName: fullName,
      mobile: normalizedMobile,
      email: shippingForm.email.trim(),
      factAddress: shippingForm.address.trim(),
      returnTo,
    };
    const reason =
      typeof globalThis.window !== "undefined"
        ? getCredoLaunchBlockReason(cartKey, shippingForm)
        : null;

    return {
      provider: "credo",
      action: "/api/checkout/installments/credo/launch",
      ready: reason === null,
      reason,
      fields,
    };
  }, [cartKey, installmentProvider, keepzPersonalNumber, shippingForm]);

  const hydratePendingInstallmentState = useCallback(() => {
    const localOrderCode =
      typeof globalThis.window !== "undefined"
        ? localStorage.getItem(installmentOrderCodeKey)
        : null;
    const localRedirectUrl =
      typeof globalThis.window !== "undefined"
        ? localStorage.getItem(installmentRedirectUrlKey)
        : null;
    const localProvider =
      typeof globalThis.window !== "undefined" ? localStorage.getItem(installmentProviderKey) : null;
    const localPaymentType =
      typeof globalThis.window !== "undefined"
        ? localStorage.getItem(installmentPaymentTypeKey)
        : null;
    const persistedCookieState =
      typeof document !== "undefined"
        ? readPersistedInstallmentState(cartKey, document.cookie)
        : null;

    const nextOrderCode = localOrderCode || persistedCookieState?.orderCode || null;
    const nextRedirectUrl = localRedirectUrl || persistedCookieState?.redirectUrl || null;
    const nextProvider =
      localProvider === "credo" || localProvider === "keepz"
        ? localProvider
        : persistedCookieState?.provider || null;
    const nextPaymentType =
      localPaymentType === "card" || localPaymentType === "installments"
        ? localPaymentType
        : persistedCookieState?.paymentType || null;

    setPendingOrderCode(nextOrderCode);
    setPendingRedirectUrl(nextRedirectUrl);
    setPendingProvider(nextProvider);
    setPendingPaymentType(nextPaymentType);

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
    if (
      typeof globalThis.window !== "undefined" &&
      persistedCookieState?.provider &&
      !localProvider
    ) {
      localStorage.setItem(installmentProviderKey, persistedCookieState.provider);
    }
    if (
      typeof globalThis.window !== "undefined" &&
      persistedCookieState?.paymentType &&
      !localPaymentType
    ) {
      localStorage.setItem(installmentPaymentTypeKey, persistedCookieState.paymentType);
    }
  }, [
    cartKey,
    installmentOrderCodeKey,
    installmentPaymentTypeKey,
    installmentProviderKey,
    installmentRedirectUrlKey,
  ]);

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

    const updatePageActivity = () => {
      const active = !document.hidden && document.visibilityState === "visible" && document.hasFocus();
      setIsPageActive(active);
      if (active) {
        hydratePendingInstallmentState();
      }
    };

    updatePageActivity();
    globalThis.window.addEventListener("focus", updatePageActivity);
    globalThis.window.addEventListener("blur", updatePageActivity);
    document.addEventListener("visibilitychange", updatePageActivity);

    return () => {
      globalThis.window.removeEventListener("focus", updatePageActivity);
      globalThis.window.removeEventListener("blur", updatePageActivity);
      document.removeEventListener("visibilitychange", updatePageActivity);
    };
  }, [hydratePendingInstallmentState]);

  useEffect(() => {
    if (!pendingOrderCode) {
      setPendingInstallmentStartedAtMs(null);
      setInstallmentStatusErrorStreak(0);
      return;
    }

    setPendingInstallmentStartedAtMs(Date.now());
    setInstallmentStatusErrorStreak(0);
  }, [pendingOrderCode]);

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
    if (
      !onlineInstallmentsAllowed &&
      (installmentProvider === "credo" || installmentProvider === "keepz")
    ) {
      setInstallmentProvider("crystal");
    }
  }, [installmentProvider, onlineInstallmentsAllowed]);

  const clearInstallmentState = useCallback(() => {
    setPendingOrderCode(null);
    setPendingRedirectUrl(null);
    setPendingProvider(null);
    setPendingPaymentType(null);
    setPendingInstallmentStartedAtMs(null);
    setInstallmentStatusErrorStreak(0);
    setStatusMessage(null);
    if (globalThis.window) {
      localStorage.removeItem(installmentOrderCodeKey);
      localStorage.removeItem(installmentRedirectUrlKey);
      localStorage.removeItem(installmentProviderKey);
      localStorage.removeItem(installmentPaymentTypeKey);
    }
    clearPersistedInstallmentCookies();
  }, [
    installmentOrderCodeKey,
    installmentPaymentTypeKey,
    installmentProviderKey,
    installmentRedirectUrlKey,
  ]);

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
      const duplicateNeedsRefresh = duplicate
        ? matchingAddressNeedsRefresh(duplicate, shippingForm)
        : false;

      if (duplicate) {
        if (duplicateNeedsRefresh) {
          try {
            const updated = await updateMyShippingAddress(duplicate.id, payload);
            setSavedAddresses((previous) => {
              const next = previous.map((address) =>
                address.id === updated.id ? updated : address,
              );
              return next.sort((left, right) => Number(right.isDefault) - Number(left.isDefault));
            });
            setSelectedAddressId(updated.id);
            if (manual) {
              setAddressMessage(t("checkout.shipping.savedSuccess"));
            }
            return updated;
          } catch (error) {
            if (manual) {
              const message =
                error instanceof Error ? error.message : t("checkout.shipping.saveFailedDefault");
              setErrorMessage(message);
            }
            return null;
          }
        }

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

  const installmentStatusQuery = useQuery({
    queryKey: [
      "checkout",
      "installment-status",
      cartKey,
      pendingOrderCode,
      pendingProvider,
      pendingPaymentType,
    ],
    enabled:
      typeof globalThis.window !== "undefined" &&
      Boolean(pendingOrderCode) &&
      step !== "confirmation" &&
      Boolean(resolveStoredCartId(cartKey)) &&
      isPageActive &&
      installmentStatusErrorStreak < INSTALLMENT_STATUS_MAX_ERROR_STREAK &&
      pendingInstallmentStartedAtMs !== null &&
      Date.now() - pendingInstallmentStartedAtMs < INSTALLMENT_STATUS_PING_MAX_WINDOW_MS,
    queryFn: async () => {
      const cartId = resolveStoredCartId(cartKey);
      if (!cartId || !pendingOrderCode) {
        throw new Error("MISSING_PENDING_INSTALLMENT_CONTEXT");
      }
      return syncInstallmentCheckoutStatus(cartId, pendingOrderCode, {
        provider: pendingProvider ?? undefined,
        paymentType: pendingPaymentType ?? "installments",
      });
    },
    refetchInterval: () => {
      if (
        !pendingInstallmentStartedAtMs ||
        !isPageActive ||
        installmentStatusErrorStreak >= INSTALLMENT_STATUS_MAX_ERROR_STREAK
      ) {
        return false;
      }

      const elapsedMs = Date.now() - pendingInstallmentStartedAtMs;
      if (elapsedMs >= INSTALLMENT_STATUS_PING_MAX_WINDOW_MS) {
        return false;
      }
      if (elapsedMs >= INSTALLMENT_STATUS_PING_SLOW_AFTER_MS) {
        return INSTALLMENT_STATUS_PING_INTERVAL_SLOW_MS;
      }
      return INSTALLMENT_STATUS_PING_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const checkingStatus = installmentStatusQuery.isFetching;

  useEffect(() => {
    const status = installmentStatusQuery.data;
    if (!status) return;

    setErrorMessage(null);
    setInstallmentStatusErrorStreak(0);
    const cartId = resolveStoredCartId(cartKey);
    const statusLabel = status.statusName || `#${status.statusId ?? "unknown"}`;

    if (status.checkoutCompleted) {
      if (cartId) {
        clearCheckoutCartKeys(cartKey, cartId);
      }
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
  }, [cartKey, clearInstallmentState, installmentStatusQuery.data, t]);

  useEffect(() => {
    const error = installmentStatusQuery.error;
    if (!error) return;

    if (error instanceof Error && error.message === "MISSING_PENDING_INSTALLMENT_CONTEXT") {
      return;
    }
    if (process.env.NODE_ENV === "development") {
      console.error("[checkout] installment status ping failed", error);
    }
    setInstallmentStatusErrorStreak((previous) => {
      const next = previous + 1;
      if (next >= INSTALLMENT_STATUS_MAX_ERROR_STREAK) {
        setStatusMessage(t("checkout.installments.pollingStopped"));
        setErrorMessage(t("checkout.installments.syncFailed"));
      }
      return next;
    });
  }, [installmentStatusQuery.error, t]);

  useEffect(() => {
    if (!isPageActive || !pendingOrderCode || step === "confirmation") {
      return;
    }
    if (
      pendingInstallmentStartedAtMs &&
      Date.now() - pendingInstallmentStartedAtMs >= INSTALLMENT_STATUS_PING_MAX_WINDOW_MS
    ) {
      setStatusMessage(t("checkout.installments.pollingStopped"));
      return;
    }
    if (installmentStatusErrorStreak >= INSTALLMENT_STATUS_MAX_ERROR_STREAK) {
      return;
    }
    if (!installmentStatusQuery.isFetching) {
      void installmentStatusQuery.refetch();
    }
  }, [
    installmentStatusErrorStreak,
    installmentStatusQuery.isFetching,
    installmentStatusQuery.refetch,
    isPageActive,
    pendingInstallmentStartedAtMs,
    pendingOrderCode,
    step,
    t,
  ]);

  const continueFromShipping = useCallback(async () => {
    if (!hasRequiredCredoCustomerData(shippingForm)) {
      setErrorMessage(t("checkout.shipping.continueValidation"));
      return;
    }

    if (savedAddresses.length === 0 || existingAddressNeedsRefresh) {
      await persistCurrentAddress();
    }
    setStep("payment");
  }, [existingAddressNeedsRefresh, persistCurrentAddress, savedAddresses.length, shippingForm, t]);

  const submitCheckout = useCallback(
    async (launchMode: CredoLaunchMode = "server-assign") => {
      const cartId = resolveStoredCartId(cartKey);
      if (!cartId) {
        setErrorMessage(t("checkout.installments.missingCart"));
        return;
      }
      setSubmitting(true);
      try {
        if (paymentMethod === "card" && onlineInstallmentsAllowed) {
          const launchUrl = buildKeepzLaunchUrl({
            cartId,
            cartKey,
            paymentType: "card",
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
                "keepz_card_checkout",
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
            provider: "keepz",
            paymentType: "card",
          });

          const normalizedRedirectUrl = normalizeKeepzRedirectUrl(session.redirectUrl);
          localStorage.setItem(installmentOrderCodeKey, session.orderCode);
          localStorage.setItem(installmentRedirectUrlKey, normalizedRedirectUrl);
          localStorage.setItem(installmentProviderKey, "keepz");
          localStorage.setItem(installmentPaymentTypeKey, "card");
          writeCartIdToStorage(cartId, cartKey);
          setPendingOrderCode(session.orderCode);
          setPendingRedirectUrl(normalizedRedirectUrl);
          setPendingProvider("keepz");
          setPendingPaymentType("card");
          globalThis.window.location.replace(normalizedRedirectUrl);
          return;
        }

        if (paymentMethod === "installments") {
          if (
            !onlineInstallmentsAllowed &&
            (installmentProvider === "credo" || installmentProvider === "keepz")
          ) {
            setErrorMessage(t("checkout.payment.onlineInstallmentsMultiVendorError"));
            return;
          }

          if (installmentProvider === "credo" && !hasRequiredCredoCustomerData(shippingForm)) {
            setErrorMessage(t("checkout.installments.missingCredoData"));
            return;
          }

          const normalizedPersonalNumber = normalizeKeepzPersonalNumber(keepzPersonalNumber);
          if (installmentProvider === "keepz" && !isValidKeepzPersonalNumber(normalizedPersonalNumber)) {
            setErrorMessage(t("checkout.installments.missingKeepzPersonalNumber"));
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
          const launchUrl =
            installmentProvider === "keepz"
              ? buildKeepzLaunchUrl({
                  cartId,
                  cartKey,
                  paymentType: "installments",
                  personalNumber: normalizedPersonalNumber,
                  isForeign: false,
                  returnTo:
                    typeof globalThis.window !== "undefined"
                      ? `${globalThis.window.location.pathname}${globalThis.window.location.search}`
                      : undefined,
                })
              : buildCredoLaunchUrl({
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
                "installment_checkout",
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
            provider: installmentProvider === "keepz" ? "keepz" : "credo",
            paymentType: "installments",
            installmentLength: 12,
            clientFullName: fullName || undefined,
            mobile: normalizedMobile || undefined,
            email: shippingForm.email.trim() || undefined,
            factAddress: shippingForm.address.trim() || undefined,
            personalNumber:
              installmentProvider === "keepz" ? normalizedPersonalNumber || undefined : undefined,
            isForeign: installmentProvider === "keepz" ? false : undefined,
          });

          localStorage.setItem(installmentOrderCodeKey, session.orderCode);
          const resolvedProvider = session.provider || (installmentProvider === "keepz" ? "keepz" : "credo");
          const resolvedPaymentType = session.paymentType || "installments";
          const normalizedRedirectUrl =
            resolvedProvider === "keepz"
              ? normalizeKeepzRedirectUrl(session.redirectUrl)
              : normalizeCredoRedirectUrl(session.redirectUrl);

          if (resolvedProvider === "credo") {
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
          }

          localStorage.setItem(installmentRedirectUrlKey, normalizedRedirectUrl);
          localStorage.setItem(installmentProviderKey, resolvedProvider);
          localStorage.setItem(installmentPaymentTypeKey, resolvedPaymentType);
          writeCartIdToStorage(cartId, cartKey);
          setPendingOrderCode(session.orderCode);
          setPendingRedirectUrl(normalizedRedirectUrl);
          setPendingProvider(resolvedProvider);
          setPendingPaymentType(resolvedPaymentType);
          globalThis.window.location.replace(normalizedRedirectUrl);
          return;
        }

        await checkoutCart(cartId);
        clearCheckoutCartKeys(cartKey, cartId);
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
      installmentPaymentTypeKey,
      installmentProviderKey,
      installmentRedirectUrlKey,
      installmentProvider,
      keepzPersonalNumber,
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
    keepzPersonalNumber,
    setKeepzPersonalNumber,
    onlineInstallmentsAllowed,
    clearInstallmentState,
    shippingForm,
    handleShippingFieldChange,
    savedAddresses,
    addressesLoading,
    addressActionPending,
    selectedAddressId,
    addressMessage,
    saveAddressDisabled: Boolean(existingAddressMatch && !existingAddressNeedsRefresh),
    applySavedAddress,
    persistCurrentAddress,
    handleContinue,
    onlineLaunchForm,
    subtotal,
    shipping,
    installmentCommission,
    total,
  };
}
