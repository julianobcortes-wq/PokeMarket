import { materializeEntitlements } from "./access";
import { prisma } from "./db";

function addInterval(from: Date, interval: string) {
  const next = new Date(from);
  next.setUTCMonth(next.getUTCMonth() + (interval === "year" ? 12 : 1));
  return next;
}

export async function openSandboxSubscription(input: { userId: string; planId: string; priceId: string }) {
  if (input.planId === "free") return { error: "O plano Free não gera cobrança." };
  const price = await prisma.planPrice.findFirst({
    where: { id: input.priceId, planId: input.planId, active: true },
  });
  if (!price) return { error: "A administração ainda não publicou o preço deste plano." };
  const current = await prisma.subscription.findFirst({
    where: { userId: input.userId, planId: input.planId, status: { in: ["ACTIVE", "PAST_DUE", "INCOMPLETE"] } },
  });
  if (current?.status === "ACTIVE") return { error: "Este plano já está ativo." };
  const subscription = await prisma.subscription.create({
    data: {
      userId: input.userId,
      planId: input.planId,
      priceId: price.id,
      status: "INCOMPLETE",
      marketId: price.marketId,
      currency: price.currency,
      provider: "sandbox",
      providerRef: `sandbox_sub_${crypto.randomUUID()}`,
    },
  });
  return { subscription, price };
}

export async function applyBillingEvent(input: {
  provider: string;
  externalId: string;
  type: "payment_approved" | "payment_declined" | "renewed" | "canceled" | "expired" | "refunded";
  subscriptionId: string;
}) {
  const existing = await prisma.billingEvent.findUnique({
    where: { provider_externalId: { provider: input.provider, externalId: input.externalId } },
  });
  if (existing) return { duplicate: true as const };
  const subscription = await prisma.subscription.findUnique({
    where: { id: input.subscriptionId },
    include: { plan: true },
  });
  if (!subscription) return { error: "Assinatura não encontrada." };
  const price = subscription.priceId
    ? await prisma.planPrice.findUnique({ where: { id: subscription.priceId } })
    : null;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.billingEvent.create({
      data: {
        provider: input.provider,
        externalId: input.externalId,
        type: input.type,
        subscriptionId: subscription.id,
        payload: { type: input.type },
      },
    });
    if (input.type === "payment_approved" || input.type === "renewed") {
      const periodEnd = addInterval(now, price?.interval ?? "month");
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      });
      await tx.billingInvoice.create({
        data: {
          subscriptionId: subscription.id,
          status: "PAID",
          currency: subscription.currency,
          subtotalMinor: price?.amountMinor ?? 0,
          totalMinor: price?.amountMinor ?? 0,
          providerRef: input.externalId,
        },
      });
    }
    if (input.type === "payment_declined") {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: subscription.status === "ACTIVE" ? "PAST_DUE" : "INCOMPLETE" },
      });
    }
    if (input.type === "canceled") {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { cancelAtPeriodEnd: true },
      });
    }
    if (input.type === "expired" || input.type === "refunded") {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: "EXPIRED", cancelAtPeriodEnd: false, currentPeriodEnd: now },
      });
      if (input.type === "refunded") {
        await tx.billingInvoice.updateMany({
          where: { subscriptionId: subscription.id, status: "PAID" },
          data: { status: "REFUNDED" },
        });
      }
    }
  });
  await materializeEntitlements(subscription.userId);
  return { duplicate: false as const };
}

export async function expireDueSubscriptions(now = new Date()) {
  const due = await prisma.subscription.findMany({
    where: {
      status: { in: ["ACTIVE", "PAST_DUE", "CANCELED"] },
      cancelAtPeriodEnd: true,
      currentPeriodEnd: { lt: now },
    },
  });
  for (const subscription of due) {
    await applyBillingEvent({
      provider: subscription.provider,
      externalId: `expire_${subscription.id}_${subscription.currentPeriodEnd?.toISOString()}`,
      type: "expired",
      subscriptionId: subscription.id,
    });
  }
  return due.length;
}
