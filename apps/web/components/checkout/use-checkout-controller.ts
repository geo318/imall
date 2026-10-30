"use client";

import { calculateCheckoutTotals } from "@repo/shared/checkout";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getCart, syncInstallmentCheckoutStatus } from "@/actions/carts";
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
  parseCheckoutShippingDraft,
  type ShippingFormState,
} from "./types";

type UseCheckoutControllerOptions = {
  cartKey: string;
  credoVariant?: "zero" | "standard";
  initialError?: string | null;
};

type PersistAddressOptions = {
  manual?: boolean;
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
    crystalInvoicePrinterPromise = import("./crystal-installment-invoice")
      .then((module) => module.printCrystalInstallmentInvoice)
      .catch((error) => {
        crystalInvoicePrinterPromise = null;
        throw error;
      });
  }
  return crystalInvoicePrinterPromise;
}

export function hasRequiredCredoCustomerData(shippingForm: ShippingFormState): boolean {
  const mobile = normalizeCredoMobile(shippingForm.phone);
  return Boolean(
    shippingForm.firstName.trim() &&
      shippingForm.lastName.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingForm.email.trim()) &&
      /^5\d{8}$/.test(mobile) &&
      shippingForm.address.trim() &&
      shippingForm.city.trim(),
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
      (key !== DEFAULT_CART_STORAGE_KEY && !/^cart:[^:]+$/.test(key)) ||
      /^cart:installment/.test(key)
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

  if (cartKey === "cart:buy-now") return null;

  const fallbackCartId = readCartIdFromStorage(DEFAULT_CART_STORAGE_KEY);
  if (fallbackCartId && cartKey !== DEFAULT_CART_STORAGE_KEY) {
    writeCartIdToStorage(fallbackCartId, cartKey);
    return fallbackCartId;
  }

  const cartEntries = listStoredCartEntries().filter((entry) => entry.key !== "cart:buy-now");
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
  const keys = new Set([cartKey]);
  for (const entry of listStoredCartEntries()) {
    if (cartId && entry.cartId === cartId) keys.add(entry.key);
  }
  for (const key of keys) {
    clearCartIdFromStorage(key);
    try {
      globalThis.window.sessionStorage.removeItem(`${key}:shipping:${cartId}`);
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }
}

export function persistCheckoutShippingDraft(cartKey: string, shippingForm: ShippingFormState) {
  const cartId = readCartIdFromStorage(cartKey);
  if (!cartId) return;
  try {
    globalThis.window.sessionStorage.setItem(
      `${cartKey}:shipping:${cartId}`,
      JSON.stringify(shippingForm),
    );
  } catch {
    // A disabled draft store must not prevent checkout.
  }
}

export function isCredoLaunchReady(cartKey: string, _shippingForm: ShippingFormState): boolean {
  return Boolean(resolveStoredCartId(cartKey));
}

export function getCredoLaunchBlockReason(
  cartKey: string,
  _shippingForm: ShippingFormState,
): "missingCart" | "missingCustomerData" | null {
  if (!resolveStoredCartId(cartKey)) {
    return "missingCart";
  }

  // Missing customer fields fall back to iMall contact info instead of blocking launch.
  return null;
}

export function isOnlineInstallmentCartEligible(items: Array<Pick<CartItem, "tenantId">>): boolean {
  return items.length > 0 && items.every((item) => Boolean(item.tenantId));
}

const IMALL_FALLBACK_CLIENT_NAME = "iMall Support";
const IMALL_FALLBACK_EMAIL = "contact@imall.ge";
const IMALL_FALLBACK_ADDRESS = "Kostava Ave. 4, Tbilisi, Georgia 0105";
// TODO: replace with the real iMall support line before launch.
const IMALL_FALLBACK_MOBILE = "595000000";

export function withCredoCustomerFallback(shippingForm: ShippingFormState) {
  const fullName = `${shippingForm.firstName} ${shippingForm.lastName}`.trim();
  const mobile = normalizeCredoMobile(shippingForm.phone);
  return {
    clientFullName: fullName || IMALL_FALLBACK_CLIENT_NAME,
    mobile: mobile || IMALL_FALLBACK_MOBILE,
    email: shippingForm.email.trim() || IMALL_FALLBACK_EMAIL,
    factAddress: shippingForm.address.trim() || IMALL_FALLBACK_ADDRESS,
  };
}

export function useCheckoutController({
  cartKey,
  credoVariant: initialCredoVariant = "zero",
  initialError = null,
}: UseCheckoutControllerOptions) {
  const [credoVariant, setCredoVariant] = useState(initialCredoVariant);
  const t = useTranslations();
  const [items, setItems] = useState<CartItem[]>([]);
  const [step, setStep] = useState<CheckoutStep>(initialError ? "payment" : "shipping");
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [pendingOrderCode, setPendingOrderCode] = useState<string | null>(null);
  const [pendingRedirectUrl, setPendingRedirectUrl] = useState<string | null>(null);
  const [installmentProvider, setInstallmentProvider] = useState<InstallmentProvider | null>(null);
  const [keepzPersonalNumber, setKeepzPersonalNumber] = useState("");
  const [pendingProvider, setPendingProvider] = useState<OnlineCheckoutProvider | null>(null);
  const [pendingPaymentType, setPendingPaymentType] = useState<OnlineCheckoutPaymentType | null>(
    null,
  );
  const [shippingForm, setShippingForm] = useState<ShippingFormState>(EMPTY_SHIPPING_FORM);
  const [savedAddresses, setSavedAddresses] = useState<UserShippingAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressActionPending, setAddressActionPending] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressMessage, setAddressMessage] = useState<string | null>(null);

  const installmentOrderCodeKey = `${cartKey}:installmentOrderCode`;
  const installmentCartIdKey = `${cartKey}:installmentCartId`;
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
  const hydratePendingInstallmentState = useCallback(() => {
    const cartId = readCartIdFromStorage(cartKey);
    const localCartId = localStorage.getItem(installmentCartIdKey);
    if (!cartId || (localCartId && localCartId !== cartId)) {
      for (const key of [
        installmentCartIdKey,
        installmentOrderCodeKey,
        installmentRedirectUrlKey,
        installmentProviderKey,
        installmentPaymentTypeKey,
      ]) {
        localStorage.removeItem(key);
      }
    }
    const localOrderCode =
      typeof globalThis.window !== "undefined"
        ? localStorage.getItem(installmentOrderCodeKey)
        : null;
    const localRedirectUrl =
      typeof globalThis.window !== "undefined"
        ? localStorage.getItem(installmentRedirectUrlKey)
        : null;
    const localProvider =
      typeof globalThis.window !== "undefined"
        ? localStorage.getItem(installmentProviderKey)
        : null;
    const localPaymentType =
      typeof globalThis.window !== "undefined"
        ? localStorage.getItem(installmentPaymentTypeKey)
        : null;
    const persistedCookieState =
      typeof document !== "undefined"
        ? cartId
          ? readPersistedInstallmentState(cartKey, document.cookie, cartId)
          : null
        : null;

    const nextOrderCode = localOrderCode || persistedCookieState?.orderCode || null;
    const rawRedirectUrl = localRedirectUrl || persistedCookieState?.redirectUrl || "";
    const nextProvider =
      localProvider === "credo" || localProvider === "keepz"
        ? localProvider
        : persistedCookieState?.provider || (nextOrderCode?.startsWith("IML-") ? "credo" : null);
    const nextPaymentType =
      localPaymentType === "card" || localPaymentType === "installments"
        ? localPaymentType
        : persistedCookieState?.paymentType || null;

    const nextRedirectUrl =
      nextProvider === "keepz"
        ? normalizeKeepzRedirectUrl(rawRedirectUrl)
        : normalizeCredoRedirectUrl(rawRedirectUrl);

    setPendingOrderCode(nextOrderCode);
    setPendingRedirectUrl(nextRedirectUrl);
    setPendingProvider(nextProvider);
    setPendingPaymentType(nextPaymentType);
    if (persistedCookieState?.cartId)
      localStorage.setItem(installmentCartIdKey, persistedCookieState.cartId);

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
    installmentCartIdKey,
    installmentOrderCodeKey,
    installmentPaymentTypeKey,
    installmentProviderKey,
    installmentRedirectUrlKey,
  ]);

  const clearInstallmentState = useCallback(() => {
    setPendingOrderCode(null);
    setPendingRedirectUrl(null);
    setPendingProvider(null);
    setPendingPaymentType(null);
    if (globalThis.window) {
      localStorage.removeItem(installmentOrderCodeKey);
      localStorage.removeItem(installmentCartIdKey);
      localStorage.removeItem(installmentRedirectUrlKey);
      localStorage.removeItem(installmentProviderKey);
      localStorage.removeItem(installmentPaymentTypeKey);
    }
    clearPersistedInstallmentCookies();
  }, [
    installmentCartIdKey,
    installmentOrderCodeKey,
    installmentPaymentTypeKey,
    installmentProviderKey,
    installmentRedirectUrlKey,
  ]);

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
        if (cartResult.value.status === "completed") {
          clearCheckoutCartKeys(cartKey, cartId);
          clearInstallmentState();
          setStep("confirmation");
        }
      } else {
        console.error("Failed to load cart:", cartResult.reason);
        setItems([]);
        if (cartResult.reason instanceof Error && cartResult.reason.message === "Cart not found") {
          clearCheckoutCartKeys(cartKey, cartId);
          clearInstallmentState();
        }
        setErrorMessage(
          cartResult.reason instanceof Error ? cartResult.reason.message : "Failed to load cart",
        );
      }
      setLoading(false);

      let shippingDraft: ShippingFormState | null = null;
      try {
        shippingDraft = parseCheckoutShippingDraft(
          globalThis.window.sessionStorage.getItem(`${cartKey}:shipping:${cartId}`),
        );
      } catch {
        // Storage may be unavailable in private browsing.
      }
      if (shippingDraft) setShippingForm(shippingDraft);

      if (addressesResult.status === "fulfilled") {
        const addresses = addressesResult.value;
        setSavedAddresses(addresses);
        const preferredAddress = addresses.find((address) => address.isDefault) ?? addresses[0];
        if (preferredAddress && !shippingDraft) {
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
  }, [cartKey, hydratePendingInstallmentState, clearInstallmentState]);

  useEffect(() => {
    if (typeof globalThis.window === "undefined") {
      return;
    }

    const onFocus = () => hydratePendingInstallmentState();

    globalThis.window.addEventListener("focus", onFocus);
    return () => {
      globalThis.window.removeEventListener("focus", onFocus);
    };
  }, [hydratePendingInstallmentState]);

  const onlineInstallmentsAllowed = !loading && isOnlineInstallmentCartEligible(items);
  const { subtotal, shipping, installmentCommission, total } = calculateCheckoutTotals(
    items,
    paymentMethod ?? "card",
  );

  const checkPendingPayment = useCallback(async () => {
    const cartId = readCartIdFromStorage(cartKey);
    if (!pendingOrderCode || checkingStatus) return;
    if (!cartId) {
      setErrorMessage(t("checkout.installments.missingCart"));
      return;
    }
    setCheckingStatus(true);
    setErrorMessage(null);
    try {
      // Keepz finalizes through its verified callback; only Credo needs an explicit sync.
      const completed =
        pendingProvider === "credo"
          ? (
              await syncInstallmentCheckoutStatus(cartId, pendingOrderCode, {
                provider: "credo",
                paymentType: pendingPaymentType ?? "installments",
              })
            ).checkoutCompleted
          : (await getCart(cartId)).status === "completed";
      if (completed) {
        clearCheckoutCartKeys(cartKey, cartId);
        clearInstallmentState();
        setStep("confirmation");
      } else {
        toast.info(t("checkout.installments.paymentPending"));
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("checkout.installments.syncFailed"),
      );
    } finally {
      setCheckingStatus(false);
    }
  }, [
    cartKey,
    pendingOrderCode,
    pendingProvider,
    pendingPaymentType,
    checkingStatus,
    clearInstallmentState,
    t,
  ]);

  const applySavedAddress = useCallback(
    (address: UserShippingAddress) => {
      const nextForm = mapAddressToShippingForm(address);
      setShippingForm(nextForm);
      persistCheckoutShippingDraft(cartKey, nextForm);
      setSelectedAddressId(address.id);
      setAddressMessage(null);
      setErrorMessage(null);
    },
    [cartKey],
  );

  const handleShippingFieldChange = useCallback(
    (field: keyof ShippingFormState, value: string) => {
      setErrorMessage(null);
      const nextForm = { ...shippingForm, [field]: value };
      setShippingForm(nextForm);
      persistCheckoutShippingDraft(cartKey, nextForm);
      if (selectedAddressId) {
        setSelectedAddressId(null);
      }
      if (addressMessage) {
        setAddressMessage(null);
      }
    },
    [addressMessage, selectedAddressId, shippingForm, cartKey],
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
          setAddressActionPending(true);
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
          } finally {
            setAddressActionPending(false);
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

  const continueFromShipping = useCallback(async () => {
    if (items.length === 0) {
      setErrorMessage(t("checkout.errors.emptyCart"));
      return;
    }

    if (!hasRequiredCredoCustomerData(shippingForm)) {
      setErrorMessage(t("checkout.shipping.continueValidation"));
      return;
    }

    setSubmitting(true);
    try {
      if (savedAddresses.length === 0 || existingAddressNeedsRefresh) {
        await persistCurrentAddress();
      }
      setStep("payment");
    } finally {
      setSubmitting(false);
    }
  }, [
    existingAddressNeedsRefresh,
    items.length,
    persistCurrentAddress,
    savedAddresses.length,
    shippingForm,
    t,
  ]);

  const submitCheckout = useCallback(async () => {
    if (!paymentMethod) {
      setErrorMessage(t("checkout.payment.chooseMethod"));
      return;
    }
    if (paymentMethod === "installments" && !installmentProvider) {
      setErrorMessage(t("checkout.payment.chooseInstallmentProvider"));
      return;
    }
    const cartId = resolveStoredCartId(cartKey);
    if (!cartId) {
      setErrorMessage(t("checkout.installments.missingCart"));
      return;
    }
    if (pendingOrderCode) {
      setErrorMessage(t("checkout.installments.paymentPending"));
      return;
    }
    if (!items.length || !hasRequiredCredoCustomerData(shippingForm)) {
      setStep("shipping");
      setErrorMessage(t("checkout.shipping.continueValidation"));
      return;
    }
    const manualInvoice = paymentMethod === "installments" && installmentProvider === "crystal";
    if (!onlineInstallmentsAllowed && !manualInvoice) {
      setErrorMessage(t("checkout.payment.onlineUnavailable"));
      return;
    }
    const normalizedPersonalNumber = normalizeKeepzPersonalNumber(keepzPersonalNumber);
    if (
      paymentMethod === "installments" &&
      installmentProvider === "keepz" &&
      !isValidKeepzPersonalNumber(normalizedPersonalNumber)
    ) {
      setErrorMessage(t("checkout.installments.missingKeepzPersonalNumber"));
      return;
    }
    setSubmitting(true);
    let redirecting = false;
    try {
      if (manualInvoice) {
        const printInvoice = await getCrystalInvoicePrinter();
        await printInvoice({
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
      const returnParams = new URLSearchParams(globalThis.window.location.search);
      returnParams.delete("installment_error");
      returnParams.delete("id");
      returnParams.set("payment", paymentMethod);
      if (installmentProvider) returnParams.set("provider", installmentProvider);
      else returnParams.delete("provider");
      returnParams.set("credoVariant", credoVariant);
      const returnTo = `${globalThis.window.location.pathname}?${returnParams}`;
      const customer = withCredoCustomerFallback(shippingForm);
      persistCheckoutShippingDraft(cartKey, shippingForm);
      const launchUrl =
        paymentMethod === "card" || installmentProvider === "keepz"
          ? buildKeepzLaunchUrl({
              cartId,
              cartKey,
              paymentType: paymentMethod,
              personalNumber:
                paymentMethod === "installments" ? normalizedPersonalNumber : undefined,
              isForeign: false,
              returnTo,
            })
          : buildCredoLaunchUrl({
              cartId,
              cartKey,
              installmentLength: 12,
              credoVariant,
              ...customer,
              returnTo,
            });
      globalThis.window.location.assign(launchUrl);
      redirecting = true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("checkout.errors.default"));
    } finally {
      if (!redirecting) setSubmitting(false);
    }
  }, [
    cartKey,
    pendingOrderCode,
    items,
    shippingForm,
    onlineInstallmentsAllowed,
    paymentMethod,
    installmentProvider,
    keepzPersonalNumber,
    credoVariant,
    subtotal,
    shipping,
    installmentCommission,
    total,
    t,
  ]);

  const handleContinue = useCallback(async () => {
    if (submitting || addressActionPending) return;
    setErrorMessage(null);

    if (step === "shipping") {
      await continueFromShipping();
      return;
    }

    if (step === "payment") {
      await submitCheckout();
    }
  }, [continueFromShipping, step, submitCheckout, submitting, addressActionPending]);

  return {
    items,
    step,
    setStep,
    paymentMethod,
    setPaymentMethod: (method: CheckoutPaymentMethod) => {
      setErrorMessage(null);
      setPaymentMethod(method);
    },
    loading,
    submitting,
    checkingStatus,
    checkPendingPayment,
    errorMessage,
    setErrorMessage,
    pendingOrderCode,
    pendingRedirectUrl,
    installmentProvider,
    setInstallmentProvider: (provider: InstallmentProvider) => {
      setErrorMessage(null);
      setInstallmentProvider(provider);
    },
    credoVariant,
    setCredoVariant: (variant: "zero" | "standard") => {
      setErrorMessage(null);
      setCredoVariant(variant);
    },
    keepzPersonalNumber,
    setKeepzPersonalNumber: (value: string) => {
      setErrorMessage(null);
      setKeepzPersonalNumber(value);
    },
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
    subtotal,
    shipping,
    installmentCommission,
    total,
  };
}
