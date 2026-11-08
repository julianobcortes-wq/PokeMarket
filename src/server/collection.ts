import { CardCondition } from "@prisma/client";
import { portfolioBridge } from "@/domain/portfolio";
import { accessFor } from "./access";
import { quotePrinting } from "./pricing";
import { prisma } from "./db";

export async function addToCollection(input: {
  userId: string;
  printingId: string;
  condition: CardCondition;
  gradeKey?: string;
  quantity: number;
  paidMinor: number;
  currency: string;
  acquiredAt: Date;
}) {
  let collection = await prisma.collection.findFirst({ where: { userId: input.userId } });
  if (!collection) {
    collection = await prisma.collection.create({ data: { userId: input.userId, name: "Minha coleção" } });
  }
  const gradeKey = input.gradeKey || "raw";
  const existing = await prisma.collectionItem.findFirst({
    where: { collectionId: collection.id, printingId: input.printingId, condition: input.condition, gradeKey },
  });
  const item = existing
    ? await prisma.collectionItem.update({
        where: { id: existing.id },
        data: { quantity: { increment: input.quantity } },
      })
    : await prisma.collectionItem.create({
        data: {
          collectionId: collection.id,
          printingId: input.printingId,
          condition: input.condition,
          gradeKey,
          quantity: input.quantity,
        },
      });
  await prisma.acquisition.create({
    data: {
      itemId: item.id,
      quantity: input.quantity,
      paidMinor: input.paidMinor,
      currency: input.currency,
      acquiredAt: input.acquiredAt,
    },
  });
  return item;
}

export async function collectionView(userId: string) {
  const access = await accessFor(userId);
  const collection = await prisma.collection.findFirst({
    where: { userId },
    include: { items: { include: { acquisitions: true } } },
  });
  if (!collection) {
    return { items: [], bridge: portfolioBridge([], [], []), fullHistory: access.has("collection_price_history") };
  }
  const items = [];
  for (const item of collection.items) {
    const quote = item.printingId
      ? await quotePrinting({
          printingId: item.printingId,
          condition: item.condition ?? "NEAR_MINT",
          gradeKey: item.gradeKey,
          marketId: "BR",
        })
      : null;
    const value =
      quote?.estimate.status === "estimated" ? quote.estimate.priceMinor : null;
    const cost = item.acquisitions.reduce((sum, row) => sum + row.paidMinor, 0);
    const quantity = item.acquisitions.reduce((sum, row) => sum + row.quantity, 0);
    items.push({ item, quote, value, cost, quantity });
  }
  const end = items.map((row) => ({
    id: row.item.id,
    quantity: row.quantity,
    unitCostMinor: row.quantity ? Math.round(row.cost / row.quantity) : 0,
    unitValueMinor: row.value,
  }));
  const flows = items.flatMap((row) =>
    row.item.acquisitions.map((acquisition) => ({
      kind: "buy" as const,
      costMinor: acquisition.paidMinor,
      proceedsMinor: 0,
    })),
  );
  const bridge = portfolioBridge([], end, flows);
  return { items, bridge, fullHistory: access.has("collection_price_history") || access.has("portfolio_analytics") };
}
