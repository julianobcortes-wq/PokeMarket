import { Grant, resolveEntitlements, subscriptionGrantsAccess } from "@/domain/entitlements";
import { prisma } from "./db";

const buckets = new Map<string, { count: number; start: number }>();

export function rateLimit(key: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now - current.start > windowMs) {
    buckets.set(key, { count: 1, start: now });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

async function graceMs() {
  const setting = await prisma.platformSetting.findUnique({ where: { key: "past_due_grace_hours" } });
  const hours = typeof setting?.value === "number" ? setting.value : 0;
  return hours * 60 * 60 * 1000;
}

export async function accessFor(userId: string | null) {
  const plans = await prisma.subscriptionPlan.findMany({ include: { entitlements: true } });
  const grantsByPlan: Record<string, Grant[]> = {};
  for (const plan of plans) {
    grantsByPlan[plan.id] = plan.entitlements.map((row) => ({
      code: row.code,
      config: (row.config as Record<string, number> | null) ?? null,
    }));
  }
  if (!userId) {
    return resolveEntitlements({
      now: new Date(),
      graceMs: 0,
      subscriptions: [],
      grantsByPlan,
      sellerApproved: false,
    });
  }
  const [subscriptions, seller, grace] = await Promise.all([
    prisma.subscription.findMany({ where: { userId } }),
    prisma.seller.findUnique({ where: { userId } }),
    graceMs(),
  ]);
  return resolveEntitlements({
    now: new Date(),
    graceMs: grace,
    subscriptions: subscriptions.map((subscription) => ({
      id: subscription.id,
      planId: subscription.planId,
      status: subscription.status,
      periodEnd: subscription.currentPeriodEnd,
    })),
    grantsByPlan,
    sellerApproved: seller?.status === "APPROVED",
  });
}

export async function materializeEntitlements(userId: string) {
  const resolved = await accessFor(userId);
  const now = new Date();
  await prisma.$transaction([
    prisma.userEntitlement.deleteMany({ where: { userId, sourceType: "subscription" } }),
    prisma.userEntitlement.createMany({
      data: [...resolved.entries()].map(([code, config]) => ({
        userId,
        code,
        sourceType: "subscription",
        config: config ?? undefined,
        validFrom: now,
      })),
    }),
  ]);
  return resolved;
}

export { subscriptionGrantsAccess };
