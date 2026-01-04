"use client";

/**
 * Checkout page placeholder. Here you would collect billing/shipping
 * information, select a payment method and confirm the order. For now
 * this page simply informs the user that checkout is not implemented.
 */
export default function CheckoutPage({ params }: { params: { shopSlug: string } }) {
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Checkout</h1>
      <p>Checkout functionality is not implemented yet.</p>
    </div>
  );
}