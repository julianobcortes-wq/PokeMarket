import { CardCondition, Finish, Prisma } from "@prisma/client";
import { settleOrder } from "@/domain/commission";
import { safeHttpsUrl } from "@/domain/urls";
import { preferredTranslation } from "./catalog";
import { prisma } from "./db";
import { sandboxCommerceEnabled } from "./sandbox";

export class CommerceError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

async function commissionRate(sellerId: string, countryCode: string) {
  const specific = await prisma.commissionRule.findFirst({ where: { active: true, sellerId } });
  if (specific) return specific;
  const country = await prisma.commissionRule.findFirst({
    where: { active: true, sellerId: null, countryCode },
  });
  if (country) return country;
  return prisma.commissionRule.findFirst({ where: { active: true, sellerId: null, countryCode: null } });
}

export async function reserveListing(listingId: string, quantity: number) {
  if (quantity < 1) throw new CommerceError("QUANTITY");
  const updated = await prisma.$executeRaw`
    UPDATE "Listing" AS l
    SET reserved = l.reserved + ${quantity}
    FROM "Seller" AS s
    WHERE l.id = ${listingId}
      AND l."sellerId" = s.id
      AND s.status = 'APPROVED'::"SellerStatus"
      AND l.status = 'ACTIVE'::"ListingStatus"
      AND l.quantity - l.reserved >= ${quantity}
  `;
  if (updated !== 1) throw new CommerceError("STOCK");
}

export async function releaseReservation(listingId: string, quantity: number) {
  await prisma.$executeRaw`
    UPDATE "Listing"
    SET reserved = reserved - ${quantity}
    WHERE id = ${listingId} AND reserved >= ${quantity}
  `;
}

export async function createListing(input: {
  sellerUserId: string;
  printingId?: string;
  sealedProductId?: string;
  condition?: CardCondition;
  gradeKey?: string;
  grader?: string;
  grade?: string;
  certNumber?: string;
  priceMinor: number;
  currency: string;
  quantity: number;
  photoUrl?: string;
}) {
  const seller = await prisma.seller.findUnique({ where: { userId: input.sellerUserId } });
  if (!seller || seller.status !== "APPROVED") throw new CommerceError("SELLER_NOT_APPROVED");
  if (input.priceMinor < 0 || input.quantity < 1) throw new CommerceError("INVALID");
  if (input.printingId && input.sealedProductId) throw new CommerceError("INVALID");
  if (!input.printingId && !input.sealedProductId) throw new CommerceError("INVALID");
  if (input.printingId && !input.condition) throw new CommerceError("CONDITION_REQUIRED");
  if (input.grader && input.grade) {
    input.gradeKey = `${input.grader}_${input.grade}`.replace(/\s+/g, "");
  }
  const photoUrl = input.photoUrl ? safeHttpsUrl(input.photoUrl) : null;
  if (input.photoUrl && !photoUrl) throw new CommerceError("PHOTO_URL");
  const listing = await prisma.listing.create({
    data: {
      sellerId: seller.id,
      printingId: input.printingId,
      sealedProductId: input.sealedProductId,
      condition: input.condition,
      gradeKey: input.gradeKey || "raw",
      grader: input.grader,
      grade: input.grade,
      certNumber: input.certNumber,
      priceMinor: input.priceMinor,
      currency: input.currency,
      quantity: input.quantity,
      photos: photoUrl ? { create: { url: photoUrl } } : undefined,
    },
  });
  return listing;
}

export async function checkoutFromLines(input: {
  buyerId: string;
  lines: { listingId: string; quantity: number }[];
}) {
  if (!sandboxCommerceEnabled()) throw new CommerceError("SANDBOX_DISABLED");
  if (input.lines.length === 0) throw new CommerceError("EMPTY");
  const listings = await prisma.listing.findMany({
    where: { id: { in: input.lines.map((line) => line.listingId) } },
    include: { seller: true, printing: { include: { card: { include: { translations: true } } } }, sealed: true },
  });
  if (listings.length !== input.lines.length) throw new CommerceError("LISTING");
  const reserved: { listingId: string; quantity: number }[] = [];
  try {
    for (const line of input.lines) {
      await reserveListing(line.listingId, line.quantity);
      reserved.push(line);
    }
    const groups = new Map<string, typeof listings>();
    for (const listing of listings) {
      const bucket = groups.get(listing.sellerId) ?? [];
      bucket.push(listing);
      groups.set(listing.sellerId, bucket);
    }
    let itemsMinor = 0;
    let shippingMinor = 0;
    const currency = listings[0].currency;
    if (listings.some((listing) => listing.currency !== currency)) throw new CommerceError("CURRENCY");
    for (const group of groups.values()) {
      shippingMinor += group[0].seller.shippingFlatMinor;
      for (const listing of group) {
        const quantity = input.lines.find((line) => line.listingId === listing.id)?.quantity ?? 0;
        itemsMinor += listing.priceMinor * quantity;
      }
    }
    const order = await prisma.order.create({
      data: {
        buyerId: input.buyerId,
        status: "PENDING_PAYMENT",
        currency,
        itemsMinor,
        shippingMinor,
        totalMinor: itemsMinor + shippingMinor,
        sandbox: true,
        sellerOrders: {
          create: [...groups.entries()].map(([sellerId, group]) => {
            const groupItems = group.reduce((sum, listing) => {
              const quantity = input.lines.find((line) => line.listingId === listing.id)?.quantity ?? 0;
              return sum + listing.priceMinor * quantity;
            }, 0);
            return {
              sellerId,
              status: "PENDING_PAYMENT" as const,
              itemsMinor: groupItems,
              shippingMinor: group[0].seller.shippingFlatMinor,
              currency,
            };
          }),
        },
      },
      include: { sellerOrders: true },
    });
    for (const listing of listings) {
      const quantity = input.lines.find((line) => line.listingId === listing.id)?.quantity ?? 0;
      const sellerOrder = order.sellerOrders.find((row) => row.sellerId === listing.sellerId);
      if (!sellerOrder) throw new CommerceError("ORDER");
      const name =
        preferredTranslation(listing.printing?.card.translations ?? [], "pt-BR")?.name ??
        listing.sealed?.name ??
        listing.printing?.cardId ??
        "Item";
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          sellerOrderId: sellerOrder.id,
          listingId: listing.id,
          quantity,
          unitPriceMinor: listing.priceMinor,
          currency,
          titleSnapshot: name,
        },
      });
    }
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: "sandbox",
        providerRef: `sandbox_${order.id}`,
        status: "PENDING",
        amountMinor: order.totalMinor,
        currency,
        sandbox: true,
      },
    });
    await prisma.cartItem.deleteMany({ where: { cart: { userId: input.buyerId }, listingId: { in: input.lines.map((line) => line.listingId) } } });
    return { orderId: order.id, paymentId: payment.id };
  } catch (error) {
    for (const line of reserved) await releaseReservation(line.listingId, line.quantity);
    throw error;
  }
}

export async function approveSandboxPayment(paymentId: string, actorId: string) {
  if (!sandboxCommerceEnabled()) throw new CommerceError("SANDBOX_DISABLED");
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        include: {
          items: { include: { listing: { include: { seller: true, printing: true } } } },
        },
      },
    },
  });
  if (!payment || payment.order.buyerId !== actorId) throw new CommerceError("FORBIDDEN");
  if (payment.status === "APPROVED") return { duplicate: true as const };
  if (!payment.sandbox || payment.provider !== "sandbox") throw new CommerceError("NOT_SANDBOX");
  await prisma.$transaction(async (tx) => {
    for (const item of payment.order.items) {
      const updated = await tx.$executeRaw`
        UPDATE "Listing"
        SET quantity = quantity - ${item.quantity},
            reserved = reserved - ${item.quantity}
        WHERE id = ${item.listingId}
          AND reserved >= ${item.quantity}
          AND quantity >= ${item.quantity}
      `;
      if (updated !== 1) throw new CommerceError("STOCK");
      const listing = item.listing;
      if (!listing.isDemo && listing.seller.userId !== actorId && listing.printing) {
        await tx.priceObservation.create({
          data: {
            printingId: listing.printingId,
            marketId: "BR",
            currency: item.currency,
            priceMinor: item.unitPriceMinor,
            type: "VERIFIED_SALE",
            condition: listing.condition,
            gradeKey: listing.gradeKey,
            language: listing.printing.language,
            finish: listing.printing.finish,
            observedAt: new Date(),
            sourceId: "pokeplace",
            sourceRef: payment.orderId,
            validation: "accepted",
            connectorVersion: "marketplace-1",
            units: item.quantity,
            licenseAllowsDisplay: true,
            buyerIsSeller: false,
            demo: true,
          },
        });
      }
    }
    await tx.payment.update({ where: { id: payment.id }, data: { status: "APPROVED" } });
    await tx.order.update({ where: { id: payment.orderId }, data: { status: "PAID" } });
    await tx.sellerOrder.updateMany({ where: { orderId: payment.orderId }, data: { status: "PAID" } });
    const sellerOrders = await tx.sellerOrder.findMany({ where: { orderId: payment.orderId }, include: { seller: true } });
    for (const sellerOrder of sellerOrders) {
      await tx.shipment.create({
        data: {
          sellerOrderId: sellerOrder.id,
          carrier: "nao_integrado",
          service: "frete_informado_pelo_vendedor",
          priceMinor: sellerOrder.shippingMinor,
          currency: sellerOrder.currency,
          etaDays: sellerOrder.seller.handlingDays + 5,
          status: "PENDING",
          integrated: false,
        },
      });
    }
  });
  return { duplicate: false as const };
}

export async function declineSandboxPayment(paymentId: string, actorId: string) {
  if (!sandboxCommerceEnabled()) throw new CommerceError("SANDBOX_DISABLED");
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: { include: { items: true } } },
  });
  if (!payment || payment.order.buyerId !== actorId) throw new CommerceError("FORBIDDEN");
  if (payment.status !== "PENDING") return;
  await prisma.$transaction(async (tx) => {
    for (const item of payment.order.items) await releaseReservation(item.listingId, item.quantity);
    await tx.payment.update({ where: { id: payment.id }, data: { status: "DECLINED" } });
    await tx.order.update({ where: { id: payment.orderId }, data: { status: "CANCELED" } });
    await tx.sellerOrder.updateMany({ where: { orderId: payment.orderId }, data: { status: "CANCELED" } });
  });
}

export async function completeOrder(orderId: string, actorId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { sellerOrders: { include: { seller: true } } },
  });
  if (!order || !sandboxCommerceEnabled() || !order.sandbox) throw new CommerceError("SANDBOX_DISABLED");
  if (order.buyerId !== actorId) throw new CommerceError("FORBIDDEN");
  if (order.status !== "PAID") throw new CommerceError("STATE");
  await prisma.$transaction(async (tx) => {
    for (const sellerOrder of order.sellerOrders) {
      const rule = await commissionRate(sellerOrder.sellerId, sellerOrder.seller.countryCode);
      const settlement = settleOrder({
        itemsMinor: sellerOrder.itemsMinor,
        shippingMinor: sellerOrder.shippingMinor,
        rateBps: rule?.rateBps ?? 0,
        paymentFeeMinor: 0,
      });
      await tx.commissionEntry.create({
        data: {
          sellerOrderId: sellerOrder.id,
          ruleId: rule?.id,
          rateBps: settlement.rateBps,
          baseMinor: settlement.gmvMinor,
          commissionMinor: settlement.commissionMinor,
          sellerNetMinor: settlement.sellerNetMinor,
          currency: sellerOrder.currency,
          status: "RECOGNIZED",
        },
      });
      await tx.sellerOrder.update({
        where: { id: sellerOrder.id },
        data: {
          status: "COMPLETED",
          commissionMinor: settlement.commissionMinor,
          sellerNetMinor: settlement.sellerNetMinor,
        },
      });
    }
    await tx.order.update({ where: { id: order.id }, data: { status: "COMPLETED" } });
  });
}

export async function sellerOrdersFor(userId: string) {
  const seller = await prisma.seller.findUnique({ where: { userId } });
  if (!seller) return [];
  return prisma.sellerOrder.findMany({
    where: { sellerId: seller.id },
    include: { items: true, order: { select: { id: true, status: true, createdAt: true } } },
    orderBy: { order: { createdAt: "desc" } },
  });
}

export async function readSellerOrder(userId: string, sellerOrderId: string) {
  const seller = await prisma.seller.findUnique({ where: { userId } });
  if (!seller) throw new CommerceError("FORBIDDEN");
  const row = await prisma.sellerOrder.findFirst({
    where: { id: sellerOrderId, sellerId: seller.id },
    include: { items: true, shipment: true, commission: true },
  });
  if (!row) throw new CommerceError("FORBIDDEN");
  return row;
}

export function listingFinish(value: string): Finish {
  if (value === "REVERSE" || value === "HOLO" || value === "FIRST_EDITION" || value === "OTHER") return value;
  return "NORMAL";
}

export const listingSelect = {
  id: true,
  priceMinor: true,
  currency: true,
  quantity: true,
  reserved: true,
  condition: true,
  gradeKey: true,
  grader: true,
  grade: true,
  isDemo: true,
  seller: {
    select: {
      slug: true,
      displayName: true,
      city: true,
      state: true,
      isOperationStore: true,
      handlingDays: true,
      shippingFlatMinor: true,
      status: true,
    },
  },
} satisfies Prisma.ListingSelect;
