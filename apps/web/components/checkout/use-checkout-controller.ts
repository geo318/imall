"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { checkoutCart, getCart, startInstallmentCheckout } from "@/actions/carts";
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
  credoVariant?: "zero" | "standard";
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
  initialPaymentMethod = "card",
  initialInstallmentProvider = "keepz",
  credoVariant = "zero",
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
  const [installmentProvider, setInstallmentProvider] = useState<InstallmentProvider>(
    initialInstallmentProvider,
  );
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
    const credoCustomer = withCredoCustomerFallback(shippingForm);
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
      credoVariant,
      clientFullName: credoCustomer.clientFullName,
      mobile: credoCustomer.mobile,
      email: credoCustomer.email,
      factAddress: credoCustomer.factAddress,
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
  }, [cartKey, credoVariant, installmentProvider, keepzPersonalNumber, shippingForm]);

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
      typeof globalThis.window !== "undefined"
        ? localStorage.getItem(installmentProviderKey)
        : null;
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
        setErrorMessage(
          cartResult.reason instanceof Error ? cartResult.reason.message : "Failed to load cart",
        );
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

    const onFocus = () => hydratePendingInstallmentState();

    globalThis.window.addEventListener("focus", onFocus);
    return () => {
      globalThis.window.removeEventListener("focus", onFocus);
    };
  }, [hydratePendingInstallmentState]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.price) * item.qty, 0),
    [items],
  );
  const onlineInstallmentsAllowed = useMemo(
    () => loading || isOnlineInstallmentCartEligible(items),
    [items, loading],
  );
  const shipping = subtotal > 100 ? 0 : 9.99;
  const installmentCommission =
    paymentMethod === "installments" && credoVariant === "standard" ? subtotal * 0.12 : 0;
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

  const continueFromShipping = useCallback(async () => {
    if (items.length === 0) {
      setErrorMessage(t("checkout.errors.emptyCart"));
      return;
    }

    if (!hasRequiredCredoCustomerData(shippingForm)) {
      setErrorMessage(t("checkout.shipping.continueValidation"));
      return;
    }

    if (savedAddresses.length === 0 || existingAddressNeedsRefresh) {
      await persistCurrentAddress();
    }
    setStep("payment");
  }, [
    existingAddressNeedsRefresh,
    items.length,
    persistCurrentAddress,
    savedAddresses.length,
    shippingForm,
    t,
  ]);

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

          const normalizedPersonalNumber = normalizeKeepzPersonalNumber(keepzPersonalNumber);
          if (
            installmentProvider === "keepz" &&
            !isValidKeepzPersonalNumber(normalizedPersonalNumber)
          ) {
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

          const credoCustomer = withCredoCustomerFallback(shippingForm);
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
                  credoVariant,
                  clientFullName: credoCustomer.clientFullName,
                  mobile: credoCustomer.mobile,
                  email: credoCustomer.email,
                  factAddress: credoCustomer.factAddress,
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
            credoVariant: installmentProvider === "keepz" ? undefined : credoVariant,
            paymentType: "installments",
            installmentLength: 12,
            clientFullName: credoCustomer.clientFullName,
            mobile: credoCustomer.mobile,
            email: credoCustomer.email,
            factAddress: credoCustomer.factAddress,
            personalNumber:
              installmentProvider === "keepz" ? normalizedPersonalNumber || undefined : undefined,
            isForeign: installmentProvider === "keepz" ? false : undefined,
          });

          localStorage.setItem(installmentOrderCodeKey, session.orderCode);
          const resolvedProvider =
            session.provider || (installmentProvider === "keepz" ? "keepz" : "credo");
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
      credoVariant,
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
