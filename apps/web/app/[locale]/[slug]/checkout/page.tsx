"use client";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { ArrowLeft, Check, CreditCard, Shield, Truck } from "lucide-react";
import { Link } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";
import { useEffect, useState } from "react";
import { checkoutCart, getCart } from "@/actions/carts";
import type { CartItem } from "@/lib/api/cart";
import { DEFAULT_CURRENCY_CODE, formatCurrencyAmount } from "@/lib/utils/currency";

export default function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = useTranslations();
  const [slug, setSlug] = useState<string>("");
  const [items, setItems] = useState<CartItem[]>([]);
  const [step, setStep] = useState<"shipping" | "payment" | "confirmation">("shipping");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "paypal" | "installments">("card");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  const cartKey = `cart:${slug}`;

  useEffect(() => {
    if (!slug) return;
    async function loadCart() {
      const cartId = globalThis.window ? localStorage.getItem(cartKey) : null;
      if (!cartId) {
        setItems([]);
        setLoading(false);
        return;
      }
      try {
        const cart = await getCart(cartId);
        setItems(cart.items ?? []);
      } catch (err) {
        console.error("Failed to load cart:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCart();
  }, [slug, cartKey]);

  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
  const shipping = subtotal > 100 ? 0 : 9.99;
  const installmentCommission = paymentMethod === "installments" ? subtotal * 0.12 : 0;
  const total = subtotal + shipping + installmentCommission;

  const handleContinue = async () => {
    if (step === "shipping") {
      setStep("payment");
    } else if (step === "payment") {
      // Place order
      const cartId = globalThis.window ? localStorage.getItem(cartKey) : null;
      if (cartId) {
        try {
          await checkoutCart(cartId);
          localStorage.removeItem(cartKey);
          setStep("confirmation");
        } catch (err) {
          console.error("Checkout failed:", err);
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="container py-8">
        <p className="p-4">{t("checkout.loading")}</p>
      </div>
    );
  }

  if (step === "confirmation") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center py-16 px-4">
          <div className="w-20 h-20 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">{t("checkout.confirmed.title")}</h1>
          <p className="text-slate-600 mb-2">{t("checkout.confirmed.subtitle")}</p>
          <p className="text-sm text-slate-500 mb-8">
            {t("checkout.confirmed.orderPrefix")}
            {Math.random().toString(36).substring(2, 8).toUpperCase()}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button>
              <Link href={`/${slug}`}>{t("checkout.confirmed.continueShopping")}</Link>
            </Button>
            <Button variant="outline">
              <Link href="/">{t("checkout.confirmed.backHome")}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50">
      <div className="container py-8 md:py-12">
        {/* Back Link */}
        <Link
          href="/cart"
          className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("checkout.backToCart")}
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2 space-y-8">
            {/* Progress Steps */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === "shipping" ? "bg-emerald-600 text-white" : "bg-emerald-600 text-white"
                  }`}
                >
                  {step === "shipping" ? "1" : <Check className="h-4 w-4" />}
                </div>
                <span className="font-medium">{t("checkout.steps.shipping")}</span>
              </div>
              <div className="flex-1 h-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === "payment" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  2
                </div>
                <span className={step === "payment" ? "font-medium" : "text-slate-600"}>
                  {t("checkout.steps.payment")}
                </span>
              </div>
            </div>

            {step === "shipping" && (
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Truck className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-lg font-semibold">{t("checkout.shipping.title")}</h2>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{t("checkout.shipping.firstName")}</Label>
                    <Input id="firstName" placeholder={t("checkout.shipping.firstNamePlaceholder")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{t("checkout.shipping.lastName")}</Label>
                    <Input id="lastName" placeholder={t("checkout.shipping.lastNamePlaceholder")} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="email">{t("checkout.shipping.email")}</Label>
                    <Input id="email" type="email" placeholder="john@example.com" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="address">{t("checkout.shipping.address")}</Label>
                    <Input id="address" placeholder={t("checkout.shipping.addressPlaceholder")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">{t("checkout.shipping.city")}</Label>
                    <Input id="city" placeholder={t("checkout.shipping.cityPlaceholder")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">{t("checkout.shipping.state")}</Label>
                    <Input id="state" placeholder={t("checkout.shipping.statePlaceholder")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip">{t("checkout.shipping.zip")}</Label>
                    <Input id="zip" placeholder={t("checkout.shipping.zipPlaceholder")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t("checkout.shipping.phone")}</Label>
                    <Input id="phone" placeholder={t("checkout.shipping.phonePlaceholder")} />
                  </div>
                </div>

                <Button onClick={handleContinue} className="w-full mt-6" size="lg">
                  {t("checkout.actions.continueToPayment")}
                </Button>
              </div>
            )}

            {step === "payment" && (
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <CreditCard className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-lg font-semibold">{t("checkout.payment.title")}</h2>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center space-x-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:border-emerald-500/50 transition-colors">
                    <input
                      type="radio"
                      id="card"
                      name="payment"
                      value="card"
                      checked={paymentMethod === "card"}
                      onChange={(e) => setPaymentMethod(e.target.value as "card")}
                    className="h-4 w-4 text-emerald-600"
                  />
                  <Label htmlFor="card" className="flex-1 cursor-pointer">
                    {t("checkout.payment.card")}
                  </Label>
                </div>
                  <div className="flex items-center space-x-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:border-emerald-500/50 transition-colors">
                    <input
                      type="radio"
                      id="paypal"
                      name="payment"
                      value="paypal"
                      checked={paymentMethod === "paypal"}
                      onChange={(e) => setPaymentMethod(e.target.value as "paypal")}
                    className="h-4 w-4 text-emerald-600"
                  />
                  <Label htmlFor="paypal" className="flex-1 cursor-pointer">
                    {t("checkout.payment.paypal")}
                  </Label>
                </div>
                  <div className="flex items-center space-x-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:border-emerald-500/50 transition-colors">
                    <input
                      type="radio"
                      id="installments"
                      name="payment"
                      value="installments"
                      checked={paymentMethod === "installments"}
                      onChange={(e) => setPaymentMethod(e.target.value as "installments")}
                    className="h-4 w-4 text-emerald-600"
                  />
                  <Label htmlFor="installments" className="flex-1 cursor-pointer">
                    {t("checkout.payment.installments")}
                  </Label>
                </div>
              </div>

                {paymentMethod === "card" && (
                  <div className="space-y-4 mb-6">
                    <div className="space-y-2">
                      <Label htmlFor="cardNumber">{t("checkout.payment.cardNumber")}</Label>
                      <Input id="cardNumber" placeholder={t("checkout.payment.cardNumberPlaceholder")} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="expiry">{t("checkout.payment.expiry")}</Label>
                        <Input id="expiry" placeholder={t("checkout.payment.expiryPlaceholder")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cvc">CVC</Label>
                        <Input id="cvc" placeholder="123" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cardName">{t("checkout.payment.cardName")}</Label>
                      <Input id="cardName" placeholder={t("checkout.payment.cardNamePlaceholder")} />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-slate-600 mb-6">
                  <Shield className="h-4 w-4" />
                  <span>{t("checkout.payment.secureNote")}</span>
                </div>

                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setStep("shipping")} className="flex-1">
                    {t("checkout.actions.back")}
                  </Button>
                  <Button onClick={handleContinue} className="flex-1" size="lg">
                    {t("checkout.actions.placeOrder")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-slate-200 rounded-xl p-6 sticky top-24">
              <h2 className="text-lg font-semibold mb-4">{t("checkout.summary.title")}</h2>

              <div className="space-y-3 mb-4">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-slate-600">
                      {item.productTitle} × {item.qty}
                    </span>
                    <span>
                      {formatCurrencyAmount(Number(item.price) * item.qty, DEFAULT_CURRENCY_CODE)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">{t("checkout.summary.subtotal")}</span>
                  <span>{formatCurrencyAmount(subtotal, DEFAULT_CURRENCY_CODE)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">{t("checkout.summary.shipping")}</span>
                  <span>
                    {shipping === 0 ? (
                      <span className="text-emerald-600">{t("checkout.summary.free")}</span>
                    ) : (
                      formatCurrencyAmount(shipping, DEFAULT_CURRENCY_CODE)
                    )}
                  </span>
                </div>
                {paymentMethod === "installments" && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">{t("checkout.summary.installmentFee")}</span>
                    <span>{formatCurrencyAmount(installmentCommission, DEFAULT_CURRENCY_CODE)}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-3 mt-3">
                  <div className="flex justify-between text-base font-semibold">
                    <span>{t("checkout.summary.total")}</span>
                    <span>{formatCurrencyAmount(total, DEFAULT_CURRENCY_CODE)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
