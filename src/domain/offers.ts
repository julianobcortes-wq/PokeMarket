export type OfferSortInput = {
  id: string;
  priceMinor: number;
  shippingMinor: number;
  handlingDays: number;
  completedOrders: number;
  isOperationStore: boolean;
};

/** Neutral ranking. The operation-store flag is accepted and ignored. */
export function sortOffers<T extends OfferSortInput>(offers: T[]): T[] {
  return [...offers].sort((a, b) => {
    const totalA = a.priceMinor + a.shippingMinor;
    const totalB = b.priceMinor + b.shippingMinor;
    if (totalA !== totalB) return totalA - totalB;
    if (a.handlingDays !== b.handlingDays) return a.handlingDays - b.handlingDays;
    if (a.completedOrders !== b.completedOrders) return b.completedOrders - a.completedOrders;
    return a.id.localeCompare(b.id);
  });
}
