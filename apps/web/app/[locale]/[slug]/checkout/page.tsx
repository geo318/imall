"use client";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { ArrowLeft, Check, CreditCard, Shield, Truck } from "lucide-react";
import { Link } from "@/i18n/navigation.client";
import { useEffect, useState } from "react";
import { checkoutCart, getCart } from "@/actions/carts";
import type { CartItem } from "@/lib/api/cart";

export default function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState<string>("");
  const [items, setItems] = useState<CartItem[]>([]);
  const [step, setStep] = useState<"shipping" | "payment" | "confirmation">("shipping");
  const [paymentMethod, setPaymentMethod] = useState("card");
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
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

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
        <p className="p-4">Loading…</p>
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
          <h1 className="text-3xl font-bold mb-2">Order Confirmed!</h1>
          <p className="text-slate-600 mb-2">Thank you for your purchase</p>
          <p className="text-sm text-slate-500 mb-8">
            Order #MKT-
            {Math.random().toString(36).substring(2, 8).toUpperCase()}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button>
              <Link href={`/${slug}`}>Continue Shopping</Link>
            </Button>
            <Button variant="outline">
              <Link href="/">Back to Home</Link>
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
          Back to Cart
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
                <span className="font-medium">Shipping</span>
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
                  Payment
                </span>
              </div>
            </div>

            {step === "shipping" && (
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Truck className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-lg font-semibold">Shipping Information</h2>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" placeholder="John" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" placeholder="Doe" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="john@example.com" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" placeholder="123 Main Street" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" placeholder="New York" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input id="state" placeholder="NY" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input id="zip" placeholder="10001" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" placeholder="(555) 123-4567" />
                  </div>
                </div>

                <Button onClick={handleContinue} className="w-full mt-6" size="lg">
                  Continue to Payment
                </Button>
              </div>
            )}

            {step === "payment" && (
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <CreditCard className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-lg font-semibold">Payment Method</h2>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center space-x-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:border-emerald-500/50 transition-colors">
                    <input
                      type="radio"
                      id="card"
                      name="payment"
                      value="card"
                      checked={paymentMethod === "card"}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="h-4 w-4 text-emerald-600"
                    />
                    <Label htmlFor="card" className="flex-1 cursor-pointer">
                      Credit / Debit Card
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:border-emerald-500/50 transition-colors">
                    <input
                      type="radio"
                      id="paypal"
                      name="payment"
                      value="paypal"
                      checked={paymentMethod === "paypal"}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="h-4 w-4 text-emerald-600"
                    />
                    <Label htmlFor="paypal" className="flex-1 cursor-pointer">
                      PayPal
                    </Label>
                  </div>
                </div>

                {paymentMethod === "card" && (
                  <div className="space-y-4 mb-6">
                    <div className="space-y-2">
                      <Label htmlFor="cardNumber">Card Number</Label>
                      <Input id="cardNumber" placeholder="1234 5678 9012 3456" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="expiry">Expiry Date</Label>
                        <Input id="expiry" placeholder="MM/YY" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cvc">CVC</Label>
                        <Input id="cvc" placeholder="123" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cardName">Name on Card</Label>
                      <Input id="cardName" placeholder="John Doe" />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-slate-600 mb-6">
                  <Shield className="h-4 w-4" />
                  <span>Your payment information is encrypted and secure</span>
                </div>

                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setStep("shipping")} className="flex-1">
                    Back
                  </Button>
                  <Button onClick={handleContinue} className="flex-1" size="lg">
                    Place Order
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-slate-200 rounded-xl p-6 sticky top-24">
              <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

              <div className="space-y-3 mb-4">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-slate-600">
                      {item.productTitle} × {item.qty}
                    </span>
                    <span>${(Number(item.price) * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Shipping</span>
                  <span>
                    {shipping === 0 ? (
                      <span className="text-emerald-600">Free</span>
                    ) : (
                      `$${shipping.toFixed(2)}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-200 pt-3 mt-3">
                  <div className="flex justify-between text-base font-semibold">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
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
