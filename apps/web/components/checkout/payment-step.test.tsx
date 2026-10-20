import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../../i18n/provider";
import messages from "../../messages/ka.json";
import { buildCredoLaunchUrl } from "./credo-launch";
import { PaymentStep } from "./payment-step";

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
          onlineLaunchForm={{
            action: "/launch",
            fields: {},
            ready: true,
            provider: "credo",
            reason: null,
          }}
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
