import type { UserShippingAddress, UserShippingAddressInput } from "@/actions/user-addresses";

export type CheckoutStep = "shipping" | "payment" | "confirmation";
export type CheckoutPaymentMethod = "card" | "installments";
export type InstallmentProvider = "credo" | "keepz" | "crystal";

export type ShippingFormState = {
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
};

export const EMPTY_SHIPPING_FORM: ShippingFormState = {
  firstName: "",
  lastName: "",
  email: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
};

export function parseCheckoutShippingDraft(raw: string | null): ShippingFormState | null {
  try {
    const draft = JSON.parse(raw ?? "null");
    if (!draft || Array.isArray(draft)) return null;
    for (const field of Object.keys(EMPTY_SHIPPING_FORM)) {
      if (typeof draft[field] !== "string" || draft[field].length > 256) return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export const getAddressDisplayLabel = (address: UserShippingAddress) =>
  address.label?.trim() || `${address.firstName} ${address.lastName}`.trim();

export const mapAddressToShippingForm = (address: UserShippingAddress): ShippingFormState => ({
  firstName: address.firstName,
  lastName: address.lastName,
  email: address.email ?? "",
  address: address.addressLine1,
  city: address.city,
  state: address.region ?? "",
  zip: address.postalCode ?? "",
  phone: address.phone ?? "",
});

export function mapShippingFormToAddressInput(
  shippingForm: ShippingFormState,
  options: { isDefault?: boolean } = {},
): UserShippingAddressInput {
  return {
    firstName: shippingForm.firstName.trim(),
    lastName: shippingForm.lastName.trim(),
    email: shippingForm.email.trim() || null,
    phone: shippingForm.phone.trim() || null,
    addressLine1: shippingForm.address.trim(),
    city: shippingForm.city.trim(),
    region: shippingForm.state.trim() || null,
    postalCode: shippingForm.zip.trim() || null,
    country: "GE",
    isDefault: options.isDefault,
  };
}
