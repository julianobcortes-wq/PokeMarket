export const FREE_ENTITLEMENTS = [
  "catalog_search",
  "current_prices",
  "price_history_90d",
  "listing_comparison",
  "purchase",
  "collection_basic",
  "watchlist_limited",
  "rankings_basic",
  "alerts_limited",
  "indices_public",
] as const;

export type SubscriptionSnapshot = {
  id: string;
  planId: string;
  status: "INCOMPLETE" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED";
  periodEnd: Date | null;
};

export type Grant = { code: string; config: Record<string, number> | null };

export function subscriptionGrantsAccess(subscription: SubscriptionSnapshot, now: Date, graceMs: number): boolean {
  if (subscription.status === "ACTIVE") return true;
  if (subscription.status === "PAST_DUE" && subscription.periodEnd) {
    return now.getTime() <= subscription.periodEnd.getTime() + graceMs;
  }
  return false;
}

export function resolveEntitlements(input: {
  now: Date;
  graceMs: number;
  subscriptions: SubscriptionSnapshot[];
  grantsByPlan: Record<string, Grant[]>;
  sellerApproved: boolean;
}): Map<string, Record<string, number> | null> {
  const resolved = new Map<string, Record<string, number> | null>();
  for (const code of FREE_ENTITLEMENTS) resolved.set(code, null);
  const freeGrants = input.grantsByPlan.free ?? [];
  for (const grant of freeGrants) resolved.set(grant.code, grant.config);

  for (const subscription of input.subscriptions) {
    if (!subscriptionGrantsAccess(subscription, input.now, input.graceMs)) continue;
    for (const grant of input.grantsByPlan[subscription.planId] ?? []) {
      const sellerScoped = grant.code.startsWith("seller_");
      if (sellerScoped && !input.sellerApproved) continue;
      const current = resolved.get(grant.code);
      if (current?.max != null && grant.config?.max != null) {
        resolved.set(grant.code, { ...grant.config, max: Math.max(current.max, grant.config.max) });
      } else {
        resolved.set(grant.code, grant.config ?? current ?? null);
      }
    }
  }
  return resolved;
}

export function hasEntitlement(resolved: Map<string, unknown>, code: string): boolean {
  return resolved.has(code);
}
