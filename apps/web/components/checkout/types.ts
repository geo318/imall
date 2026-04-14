import type { UserShippingAddress, UserShippingAddressInput } from "@/actions/user-addresses";

export type CheckoutStep = "shipping" | "payment" | "confirmation";
export type CheckoutPaymentMethod = "card" | "paypal" | "installments";
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
    email: shippingForm.email.trim() || undefined,
    phone: shippingForm.phone.trim() || undefined,
    addressLine1: shippingForm.address.trim(),
    city: shippingForm.city.trim(),
    region: shippingForm.state.trim() || undefined,
    postalCode: shippingForm.zip.trim() || undefined,
    country: "GE",
    isDefault: options.isDefault,
  };
}
