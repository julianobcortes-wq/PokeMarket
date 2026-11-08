import { CardCondition, ObservationType, Prisma } from "@prisma/client";
import { estimateMarket, MarketObservation, periodVariation } from "@/domain/price-engine";
import { historyAccess, HistoryRange } from "@/domain/history-window";
import { accessFor } from "./access";
import { prisma } from "./db";

export class EntitlementDenied extends Error {
  entitlement = "price_history_full";
  constructor() {
    super("ENTITLEMENT_REQUIRED");
  }
}

function toObservation(row: {
  priceMinor: number;
  observedAt: Date;
  type: ObservationType;
  units: number;
  language: string;
  finish: string;
  condition: CardCondition | null;
  gradeKey: string;
  marketId: string;
  canceled: boolean;
  demo: boolean;
  buyerIsSeller: boolean;
  licenseAllowsDisplay: boolean;
  sourceId: string;
}): MarketObservation {
  return {
    priceMinor: row.priceMinor,
    observedAt: row.observedAt.toISOString(),
    type: row.type === "VERIFIED_SALE" ? "verified_sale" : row.type === "ASKING" ? "asking" : "licensed_indicator",
    units: row.units,
    language: row.language,
    finish: row.finish,
    condition: row.condition ?? "NEAR_MINT",
    gradeKey: row.gradeKey,
    marketId: row.marketId,
    canceled: row.canceled,
    demo: row.demo,
    buyerIsSeller: row.buyerIsSeller,
    licenseAllowsDisplay: row.licenseAllowsDisplay,
    sourceId: row.sourceId,
  };
}

export async function quotePrinting(input: {
  printingId: string;
  condition: CardCondition;
  gradeKey: string;
  marketId: string;
}) {
  const printing = await prisma.printing.findUnique({ where: { id: input.printingId } });
  if (!printing) return null;
  const observations = await prisma.priceObservation.findMany({
    where: {
      printingId: input.printingId,
      condition: input.condition,
      gradeKey: input.gradeKey,
      language: printing.language,
      finish: printing.finish,
      marketId: input.marketId,
      licenseAllowsDisplay: true,
    },
  });
  const result = estimateMarket(
    observations.map(toObservation),
    {
      language: printing.language,
      finish: printing.finish,
      condition: input.condition,
      gradeKey: input.gradeKey,
      marketId: input.marketId,
    },
    new Date(),
  );
  const liveAsks = await prisma.listing.findMany({
    where: {
      printingId: input.printingId,
      condition: input.condition,
      gradeKey: input.gradeKey,
      status: "ACTIVE",
      isDemo: false,
      seller: { status: "APPROVED" },
      quantity: { gt: 0 },
    },
    select: { priceMinor: true, currency: true },
  });
  const prices = liveAsks.map((ask) => ask.priceMinor).sort((a, b) => a - b);
  const medianAsk = prices.length
    ? prices.length % 2
      ? prices[(prices.length - 1) / 2]
      : Math.round((prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2)
    : null;
  return {
    estimate: result.estimate,
    external: result.external,
    liveLowestAskMinor: prices[0] ?? null,
    liveMedianAskMinor: medianAsk,
    liveAskCount: prices.length,
    currency: liveAsks[0]?.currency ?? observations[0]?.currency ?? "BRL",
  };
}

export async function loadPriceHistory(input: {
  userId: string | null;
  printingId: string;
  condition: CardCondition;
  gradeKey: string;
  marketId: string;
  range: HistoryRange;
}) {
  const access = await accessFor(input.userId);
  const decision = historyAccess(input.range, access.has("price_history_full"), new Date());
  if (!decision.allowed) throw new EntitlementDenied();
  const printing = await prisma.printing.findUnique({ where: { id: input.printingId } });
  if (!printing) return null;
  const where: Prisma.PriceObservationWhereInput = {
    printingId: input.printingId,
    condition: input.condition,
    gradeKey: input.gradeKey,
    language: printing.language,
    finish: printing.finish,
    marketId: input.marketId,
    licenseAllowsDisplay: true,
    demo: false,
    canceled: false,
    type: "VERIFIED_SALE",
    ...(decision.from ? { observedAt: { gte: decision.from, lte: decision.to } } : { observedAt: { lte: decision.to } }),
  };
  const rows = await prisma.priceObservation.findMany({
    where,
    orderBy: { observedAt: "asc" },
    select: { observedAt: true, priceMinor: true, currency: true, sourceId: true, type: true },
  });
  const byDay = new Map<string, number[]>();
  for (const row of rows) {
    const day = row.observedAt.toISOString().slice(0, 10);
    const bucket = byDay.get(day) ?? [];
    bucket.push(row.priceMinor);
    byDay.set(day, bucket);
  }
  const points = [...byDay.entries()].map(([day, values]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const priceMinor = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    return { at: day, priceMinor };
  });
  const variations = {
    d7: periodVariation(points.map((point) => ({ at: point.at, priceMinor: point.priceMinor })), 7, decision.to),
    d30: periodVariation(points.map((point) => ({ at: point.at, priceMinor: point.priceMinor })), 30, decision.to),
    d90: periodVariation(points.map((point) => ({ at: point.at, priceMinor: point.priceMinor })), 90, decision.to),
  };
  return {
    range: input.range,
    ceiling: access.has("price_history_full") ? "full" : "free",
    currency: rows[0]?.currency ?? null,
    points,
    variations,
    coverage: {
      requestedFrom: decision.from?.toISOString() ?? null,
      requestedTo: decision.to.toISOString(),
      availableFrom: points[0]?.at ?? null,
      availableTo: points[points.length - 1]?.at ?? null,
      pointCount: points.length,
    },
  };
}
