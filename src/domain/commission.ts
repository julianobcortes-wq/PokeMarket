export type Settlement = {
  itemsMinor: number;
  shippingMinor: number;
  rateBps: number;
  paymentFeeMinor: number;
  commissionMinor: number;
  sellerNetMinor: number;
  platformCommissionMinor: number;
  gmvMinor: number;
};

/** Commission applies to merchandise only. Shipping and payment fees stay on their own lines. */
export function settleOrder(input: {
  itemsMinor: number;
  shippingMinor: number;
  rateBps: number;
  paymentFeeMinor?: number;
}): Settlement {
  if (input.itemsMinor < 0 || input.shippingMinor < 0 || input.rateBps < 0) {
    throw new Error("Valores negativos não entram na liquidação.");
  }
  const paymentFeeMinor = input.paymentFeeMinor ?? 0;
  const commissionMinor = Math.round((input.itemsMinor * input.rateBps) / 10_000);
  const sellerNetMinor = input.itemsMinor + input.shippingMinor - commissionMinor;
  return {
    itemsMinor: input.itemsMinor,
    shippingMinor: input.shippingMinor,
    rateBps: input.rateBps,
    paymentFeeMinor,
    commissionMinor,
    sellerNetMinor,
    platformCommissionMinor: commissionMinor,
    gmvMinor: input.itemsMinor,
  };
}
