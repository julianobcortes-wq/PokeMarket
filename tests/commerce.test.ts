import { CardCondition } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { applyBillingEvent, openSandboxSubscription } from "@/server/billing";
import { accessFor } from "@/server/access";
import {
  approveSandboxPayment,
  checkoutFromLines,
  CommerceError,
  completeOrder,
  createListing,
  readSellerOrder,
  reserveListing,
} from "@/server/commerce";
import { prisma } from "@/server/db";
import { EntitlementDenied, loadPriceHistory } from "@/server/pricing";
import { reviewApplication, submitSellerApplication } from "@/server/sellers";

async function reset() {
  await prisma.$executeRawUnsafe(`
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
}

async function fixture() {
  await prisma.currency.create({ data: { code: "BRL", minorDigits: 2, name: "Real" } });
  await prisma.market.create({
    data: {
      id: "BR",
      countryCode: "BR",
      name: "Brasil",
      regionCode: "LATAM",
      defaultCurrency: "BRL",
      locale: "pt-BR",
      intelligenceEnabled: true,
      offersVisible: true,
      sellersEnabled: true,
      checkoutEnabled: true,
    },
  });
  await prisma.entitlement.createMany({
    data: [
      { code: "price_history_90d", description: "90" },
      { code: "price_history_full", description: "full" },
      { code: "catalog_search", description: "search" },
    ],
  });
  await prisma.subscriptionPlan.create({
    data: {
      id: "collector_pro",
      name: "Collector Pro",
      audience: "collector",
      sort: 1,
      entitlements: { create: [{ code: "price_history_full" }] },
    },
  });
  await prisma.subscriptionPlan.create({
    data: { id: "free", name: "Free", audience: "collector", sort: 0 },
  });
  await prisma.commissionRule.create({ data: { name: "teste", rateBps: 1000, active: true } });
  await prisma.dataSource.create({
    data: {
      id: "pokeplace",
      name: "PokePlace",
      kind: "marketplace",
      enabled: true,
      pricingAllowed: true,
      licenseNote: "vendas próprias",
    },
  });
  await prisma.series.create({ data: { id: "sv", name: "SV" } });
  await prisma.expansion.create({ data: { id: "sv03.5", seriesId: "sv", name: "151", cardCount: 1 } });
  await prisma.card.create({
    data: { id: "sv03.5-001", expansionId: "sv03.5", localId: "001", number: "001" },
  });
  await prisma.printing.create({
    data: { id: "sv03.5-001:en:NORMAL:", cardId: "sv03.5-001", language: "en", finish: "NORMAL" },
  });
  await prisma.printing.create({
    data: { id: "sv03.5-001:ja:HOLO:", cardId: "sv03.5-001", language: "ja", finish: "HOLO" },
  });
  const admin = await prisma.user.create({
    data: { email: "admin@test.local", name: "Admin", passwordHash: "x", role: "ADMIN" },
  });
  const bella = await prisma.user.create({
    data: { email: "bella@test.local", name: "Bella", passwordHash: "x" },
  });
  const other = await prisma.user.create({
    data: { email: "loja@test.local", name: "Outra", passwordHash: "x" },
  });
  const buyer = await prisma.user.create({
    data: { email: "buyer@test.local", name: "Buyer", passwordHash: "x" },
  });
  const bellaSeller = await prisma.seller.create({
    data: {
      userId: bella.id,
      slug: "bella-figurinha",
      displayName: "Bella Figurinha",
      legalName: "Bella Figurinha",
      city: "São Paulo",
      state: "SP",
      countryCode: "BR",
      status: "APPROVED",
      isOperationStore: true,
      shippingFlatMinor: 1000,
    },
  });
  const otherSeller = await prisma.seller.create({
    data: {
      userId: other.id,
      slug: "outra-loja",
      displayName: "Outra Loja",
      legalName: "Outra Loja",
      city: "Curitiba",
      state: "PR",
      countryCode: "BR",
      status: "APPROVED",
      shippingFlatMinor: 500,
    },
  });
  return { admin, bella, other, buyer, bellaSeller, otherSeller };
}

describe("marketplace", () => {
  beforeEach(async () => {
    await reset();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("não vende a última unidade duas vezes", async () => {
    const { bella } = await fixture();
    const listing = await createListing({
      sellerUserId: bella.id,
      printingId: "sv03.5-001:en:NORMAL:",
      condition: CardCondition.NEAR_MINT,
      priceMinor: 1500,
      currency: "BRL",
      quantity: 1,
    });
    const results = await Promise.allSettled([reserveListing(listing.id, 1), reserveListing(listing.id, 1)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const stored = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(stored.reserved).toBe(1);
  });

  it("registra comissão separada do valor do vendedor e da compra", async () => {
    const { bella, buyer } = await fixture();
    const listing = await createListing({
      sellerUserId: bella.id,
      printingId: "sv03.5-001:en:NORMAL:",
      condition: CardCondition.NEAR_MINT,
      priceMinor: 10_000,
      currency: "BRL",
      quantity: 2,
    });
    const checkout = await checkoutFromLines({ buyerId: buyer.id, lines: [{ listingId: listing.id, quantity: 1 }] });
    await approveSandboxPayment(checkout.paymentId, buyer.id);
    await completeOrder(checkout.orderId, buyer.id);
    const entry = await prisma.commissionEntry.findFirstOrThrow();
    const order = await prisma.order.findUniqueOrThrow({ where: { id: checkout.orderId } });
    expect(order.status).toBe("COMPLETED");
    expect(entry.baseMinor).toBe(10_000);
    expect(entry.commissionMinor).toBe(1_000);
    expect(entry.sellerNetMinor).toBe(10_000);
    expect(order.itemsMinor).not.toBe(entry.commissionMinor);
    const observation = await prisma.priceObservation.findFirstOrThrow();
    expect(observation.type).toBe("VERIFIED_SALE");
    expect(observation.language).toBe("en");
    expect(observation.gradeKey).toBe("raw");
    expect(observation.demo).toBe(true);
  });

  it("impede vendedor suspenso de anunciar e esconde pedido alheio", async () => {
    const { admin, other, bella } = await fixture();
    const application = await prisma.sellerApplication.create({
      data: {
        userId: other.id,
        personType: "INDIVIDUAL",
        legalName: "Outra Loja",
        taxIdLast4: "4725",
        taxIdCipher: "x",
        email: "loja@test.local",
        phone: "11999999999",
        city: "Curitiba",
        state: "PR",
        operationType: "Pessoa física",
        categories: "Cartas",
        termsVersion: "2026-11-07",
        termsAcceptedAt: new Date(),
        status: "APPROVED",
      },
    });
    await prisma.seller.update({ where: { userId: other.id }, data: { applicationId: application.id } });
    await reviewApplication({
      actorId: admin.id,
      applicationId: application.id,
      to: "SUSPENDED",
      reason: "Reincidência de atraso.",
    });
    await expect(
      createListing({
        sellerUserId: other.id,
        printingId: "sv03.5-001:en:NORMAL:",
        condition: "NEAR_MINT",
        priceMinor: 100,
        currency: "BRL",
        quantity: 1,
      }),
    ).rejects.toMatchObject({ code: "SELLER_NOT_APPROVED" });
    const listing = await createListing({
      sellerUserId: bella.id,
      printingId: "sv03.5-001:en:NORMAL:",
      condition: "NEAR_MINT",
      priceMinor: 100,
      currency: "BRL",
      quantity: 1,
    });
    const buyer = await prisma.user.findUniqueOrThrow({ where: { email: "buyer@test.local" } });
    const checkout = await checkoutFromLines({ buyerId: buyer.id, lines: [{ listingId: listing.id, quantity: 1 }] });
    const sellerOrder = await prisma.sellerOrder.findFirstOrThrow({ where: { orderId: checkout.orderId } });
    await expect(readSellerOrder(other.id, sellerOrder.id)).rejects.toBeInstanceOf(CommerceError);
  });

  it("aceita inscrição nacional e grava a decisão", async () => {
    const { admin } = await fixture();
    const user = await prisma.user.create({
      data: { email: "novo@test.local", name: "Novo", passwordHash: "x" },
    });
    const submitted = await submitSellerApplication({
      userId: user.id,
      personType: "INDIVIDUAL",
      legalName: "Ana Souza",
      taxId: "529.982.247-25",
      email: "ana@test.local",
      phone: "11988887777",
      city: "Recife",
      state: "PE",
      operationType: "Pessoa física",
      categories: "Cartas avulsas",
      acceptTerms: true,
    });
    expect(submitted.application?.status).toBe("SUBMITTED");
    const reviewed = await reviewApplication({
      actorId: admin.id,
      applicationId: submitted.application!.id,
      to: "APPROVED",
      reason: "Documentos conferidos.",
    });
    expect(reviewed.seller?.status).toBe("APPROVED");
    const events = await prisma.sellerReviewEvent.findMany({ where: { applicationId: submitted.application!.id } });
    expect(events.map((event) => event.toStatus)).toEqual(["SUBMITTED", "APPROVED"]);
    const audit = await prisma.auditLog.findFirst({ where: { entityId: submitted.application!.id, action: "seller_application.approved" } });
    expect(audit?.reason).toBe("Documentos conferidos.");
  });
});

describe("histórico protegido e assinatura", () => {
  beforeEach(async () => {
    await reset();
  });

  it("não devolve observação antiga para quem está no plano gratuito", async () => {
    await fixture();
    const old = new Date("2024-01-01T00:00:00.000Z");
    const recent = new Date("2026-11-01T00:00:00.000Z");
    await prisma.priceObservation.createMany({
      data: [
        {
          printingId: "sv03.5-001:en:NORMAL:",
          marketId: "BR",
          currency: "BRL",
          priceMinor: 99999,
          type: "VERIFIED_SALE",
          condition: "NEAR_MINT",
          gradeKey: "raw",
          language: "en",
          finish: "NORMAL",
          observedAt: old,
          sourceId: "pokeplace",
          connectorVersion: "test",
          licenseAllowsDisplay: true,
        },
        {
          printingId: "sv03.5-001:en:NORMAL:",
          marketId: "BR",
          currency: "BRL",
          priceMinor: 1500,
          type: "VERIFIED_SALE",
          condition: "NEAR_MINT",
          gradeKey: "raw",
          language: "en",
          finish: "NORMAL",
          observedAt: recent,
          sourceId: "pokeplace",
          connectorVersion: "test",
          licenseAllowsDisplay: true,
        },
      ],
    });
    const free = await loadPriceHistory({
      userId: null,
      printingId: "sv03.5-001:en:NORMAL:",
      condition: "NEAR_MINT",
      gradeKey: "raw",
      marketId: "BR",
      range: "3m",
    });
    expect(free?.points.map((point) => point.priceMinor)).toEqual([1500]);
    await expect(
      loadPriceHistory({
        userId: null,
        printingId: "sv03.5-001:en:NORMAL:",
        condition: "NEAR_MINT",
        gradeKey: "raw",
        marketId: "BR",
        range: "max",
      }),
    ).rejects.toBeInstanceOf(EntitlementDenied);
    const buyer = await prisma.user.findUniqueOrThrow({ where: { email: "buyer@test.local" } });
    const price = await prisma.planPrice.create({
      data: { planId: "collector_pro", marketId: "BR", currency: "BRL", interval: "month", amountMinor: 100, active: true },
    });
    const opened = await openSandboxSubscription({ userId: buyer.id, planId: "collector_pro", priceId: price.id });
    if (!("subscription" in opened) || !opened.subscription) throw new Error("assinatura");
    await applyBillingEvent({
      provider: "sandbox",
      externalId: "evt_1",
      type: "payment_approved",
      subscriptionId: opened.subscription.id,
    });
    await applyBillingEvent({
      provider: "sandbox",
      externalId: "evt_1",
      type: "payment_approved",
      subscriptionId: opened.subscription.id,
    });
    const invoices = await prisma.billingInvoice.count();
    expect(invoices).toBe(1);
    const full = await loadPriceHistory({
      userId: buyer.id,
      printingId: "sv03.5-001:en:NORMAL:",
      condition: "NEAR_MINT",
      gradeKey: "raw",
      marketId: "BR",
      range: "max",
    });
    expect(full?.points.map((point) => point.priceMinor).sort()).toEqual([1500, 99999]);
    await applyBillingEvent({
      provider: "sandbox",
      externalId: "evt_refund",
      type: "refunded",
      subscriptionId: opened.subscription.id,
    });
    const access = await accessFor(buyer.id);
    expect(access.has("price_history_full")).toBe(false);
  });
});
