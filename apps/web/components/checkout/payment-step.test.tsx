import { expect, test } from "bun:test";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../../i18n/provider";
import messages from "../../messages/ka.json";
import { buildCredoLaunchUrl } from "./credo-launch";
import { PaymentStep } from "./payment-step";
import { useCheckoutController } from "./use-checkout-controller";

function renderPayment(props: Partial<ComponentProps<typeof PaymentStep>> = {}) {
  return renderToStaticMarkup(
    <I18nProvider locale="ka" messages={messages}>
      <PaymentStep
        paymentMethod={null}
        onPaymentMethodChange={() => {}}
        installmentProvider={null}
        onInstallmentProviderChange={() => {}}
        credoVariant="zero"
        onCredoVariantChange={() => {}}
        keepzPersonalNumber=""
        onKeepzPersonalNumberChange={() => {}}
        onlineInstallmentsAllowed
        onBack={() => {}}
        onSubmit={() => {}}
        submitting={false}
        {...props}
      />
    </I18nProvider>,
  );
}

test("unsupported PayPal and pretend card entry never appear", () => {
  for (const onlineInstallmentsAllowed of [true, false]) {
    const html = renderPayment({ paymentMethod: "card", onlineInstallmentsAllowed });
    expect(html).not.toContain("PayPal");
    expect(html).not.toContain('id="cardNumber"');
    expect(html).not.toContain('id="cvc"');
    expect(html).toContain("<form");
    if (!onlineInstallmentsAllowed) expect(html).toMatch(/type="submit"[^>]*disabled=""/);
  }
});

test("payment controls lock during launch and personal numbers use a bounded numeric input", () => {
  const html = renderPayment({
    paymentMethod: "installments",
    installmentProvider: "keepz",
    submitting: true,
  });
  expect(html).toContain('<fieldset disabled=""');
  expect(html).toContain('inputMode="numeric"');
  expect(html).toContain('maxLength="11"');
});

function CheckoutSelectionProbe() {
  const checkout = useCheckoutController({ cartKey: "cart" });
  return (
    <output
      data-payment={checkout.paymentMethod ?? "none"}
      data-provider={checkout.installmentProvider ?? "none"}
    />
  );
}

test("checkout starts without a payment choice and requires an installment provider", () => {
  const state = renderToStaticMarkup(
    <I18nProvider locale="ka" messages={messages}>
      <CheckoutSelectionProbe />
    </I18nProvider>,
  );
  expect(state).toContain('data-payment="none"');
  expect(state).toContain('data-provider="none"');
  for (const paymentMethod of [null, "installments"] as const) {
    const html = renderPayment({ paymentMethod });
    if (paymentMethod === null) expect(html).not.toContain('checked=""');
    else {
      for (const provider of ["keepz", "dayavi", "credo"]) {
        expect(html).not.toMatch(
          new RegExp(`id="installment-provider-${provider}"[^>]*checked=""`),
        );
      }
    }
    expect(html).toMatch(/type="submit"[^>]*disabled=""/);
    expect(html).not.toContain('id="keepz-personal-number"');
    expect(html).not.toContain("12%");
  }
});

test("Dayavi and Credo installments have distinct choices, logos and launch variants", () => {
  for (const credoVariant of ["zero", "standard"] as const) {
    const html = renderToStaticMarkup(
      <I18nProvider locale="ka" messages={messages}>
        <PaymentStep
          paymentMethod="installments"
          onPaymentMethodChange={() => {}}
          installmentProvider="credo"
          onInstallmentProviderChange={() => {}}
          credoVariant={credoVariant}
          onCredoVariantChange={() => {}}
          keepzPersonalNumber=""
          onKeepzPersonalNumberChange={() => {}}
          onlineInstallmentsAllowed
          onBack={() => {}}
          onSubmit={() => {}}
          submitting={false}
        />
      </I18nProvider>,
    );
    expect(html).toContain("და-ყა-ვი");
    expect(html).toContain("კრედოს განვადება");
    expect(html).toContain("dayavi-logo.png");
    expect(html).toContain("credo-bank-logo.png");
    const selected = credoVariant === "zero" ? "dayavi" : "credo";
    expect(html).toMatch(new RegExp(`id="installment-provider-${selected}"[^>]*checked=""`));
    const launch = new URL(
      buildCredoLaunchUrl({ cartId: "cart", cartKey: "cart", credoVariant }),
      "https://imall.ge",
    );
    expect(launch.searchParams.get("credoVariant") ?? "zero").toBe(credoVariant);
  }
});
