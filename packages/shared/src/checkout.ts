// Calculate in tetri so the checkout and bank payload charge the same amount.
export function calculateCheckoutTotals(
  items: ReadonlyArray<{ price: string | number; qty: number }>,
  paymentMethod: "card" | "installments",
) {
  const subtotalTetri = items.reduce(
    (sum, item) => sum + Math.round(Number(item.price) * 100) * item.qty,
    0,
  );
  const shippingTetri = items.length > 0 && subtotalTetri <= 10000 ? 999 : 0;
  const commissionTetri = paymentMethod === "installments" ? Math.round(subtotalTetri * 0.12) : 0;
  return {
    subtotal: subtotalTetri / 100,
    shipping: shippingTetri / 100,
    installmentCommission: commissionTetri / 100,
    total: (subtotalTetri + shippingTetri + commissionTetri) / 100,
  };
}
