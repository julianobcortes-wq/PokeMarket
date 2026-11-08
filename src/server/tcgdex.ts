import { Finish } from "@prisma/client";
import { prisma } from "./db";

const BASE = "https://api.tcgdex.net/v2";
const VERSION = "tcgdex-catalog-1";

type SetCard = { id: string; localId: string; name: string; image?: string };
type SetPayload = {
  id: string;
  name: string;
  cardCount?: { total?: number; official?: number };
  logo?: string;
  symbol?: string;
  cards?: SetCard[];
};
type Variant = {
  type?: string;
  stamp?: string | string[];
  thirdParty?: Record<string, unknown>;
};
type CardPayload = {
  id: string;
  name?: string;
  image?: string;
  rarity?: string;
  illustrator?: string;
  category?: string;
  hp?: number;
  stage?: string;
  localId?: string;
  variants_detailed?: Variant[];
};

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "PokePlaceCatalog/0.1" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json() as Promise<T>;
}

function seriesId(setId: string): string {
  const match = setId.match(/^[a-z]+/i);
  return (match?.[0] ?? "other").toLowerCase();
}

function mapFinish(type: string | undefined): Finish {
  const value = (type ?? "").toLowerCase();
  if (value.includes("reverse")) return "REVERSE";
  if (value.includes("holo")) return "HOLO";
  if (value.includes("first")) return "FIRST_EDITION";
  if (value && value !== "normal" && value !== "padrão" && value !== "padrao") return "OTHER";
  return "NORMAL";
}

export async function importCatalog(setIds: string[]) {
  const job = await prisma.ingestionJob.create({
    data: { sourceId: "tcgdex", status: "running", connectorVersion: VERSION },
  });
  let cards = 0;
  try {
    for (const setId of setIds) {
      for (const locale of ["pt", "en"] as const) {
        const set = await fetchJson<SetPayload>(`${BASE}/${locale}/sets/${setId}`);
        if (!set?.cards) continue;
        const series = seriesId(setId);
        await prisma.series.upsert({
          where: { id: series },
          update: {},
          create: { id: series, name: series.toUpperCase() },
        });
        await prisma.expansion.upsert({
          where: { id: setId },
          update: {
            name: locale === "pt" ? set.name : undefined,
            cardCount: set.cardCount?.official ?? set.cardCount?.total ?? set.cards.length,
            logoUrl: set.logo,
            symbolUrl: set.symbol,
          },
          create: {
            id: setId,
            seriesId: series,
            name: set.name,
            cardCount: set.cardCount?.official ?? set.cardCount?.total ?? set.cards.length,
            logoUrl: set.logo,
            symbolUrl: set.symbol,
          },
        });
        await prisma.expansionTranslation.upsert({
          where: { expansionId_locale: { expansionId: setId, locale } },
          update: { name: set.name },
          create: { expansionId: setId, locale, name: set.name },
        });
        for (const card of set.cards) {
          await prisma.card.upsert({
            where: { id: card.id },
            update: {},
            create: {
              id: card.id,
              expansionId: setId,
              localId: card.localId,
              number: card.localId,
            },
          });
          await prisma.cardTranslation.upsert({
            where: { cardId_locale: { cardId: card.id, locale } },
            update: { name: card.name, imageUrl: card.image },
            create: { cardId: card.id, locale, name: card.name, imageUrl: card.image },
          });
          const printingId = `${card.id}:${locale}:NORMAL:`;
          await prisma.printing.upsert({
            where: { id: printingId },
            update: {},
            create: { id: printingId, cardId: card.id, language: locale, finish: "NORMAL", stamp: "" },
          });
          cards += 1;
        }
      }
    }
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { status: "succeeded", finishedAt: new Date(), stats: { cards, sets: setIds.length, pricingImported: 0 } },
    });
  } catch (error) {
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { status: "failed", finishedAt: new Date(), error: error instanceof Error ? error.message : "erro" },
    });
    throw error;
  }
  return { cards };
}

/** Catalog details only. Third-party price fields on the payload are ignored. */
export async function syncCardDetails(cardId: string) {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) return;
  if (card.detailSyncedAt && Date.now() - card.detailSyncedAt.getTime() < 6 * 60 * 60 * 1000) return;
  for (const locale of ["pt", "en"] as const) {
    const payload = await fetchJson<CardPayload>(`${BASE}/${locale}/cards/${cardId}`);
    if (!payload) continue;
    await prisma.card.update({
      where: { id: cardId },
      data: {
        rarity: payload.rarity ?? card.rarity,
        illustrator: payload.illustrator ?? card.illustrator,
        category: payload.category ?? card.category,
        hp: payload.hp ?? card.hp,
        stage: payload.stage ?? card.stage,
      },
    });
    if (payload.name) {
      await prisma.cardTranslation.upsert({
        where: { cardId_locale: { cardId, locale } },
        update: { name: payload.name, imageUrl: payload.image },
        create: { cardId, locale, name: payload.name, imageUrl: payload.image },
      });
    }
    for (const variant of payload.variants_detailed ?? []) {
      const finish = mapFinish(variant.type);
      const stamp = Array.isArray(variant.stamp) ? variant.stamp.join(", ") : variant.stamp ?? "";
      const id = `${cardId}:${locale}:${finish}:${stamp}`;
      const externalIds = variant.thirdParty ? (variant.thirdParty as object) : undefined;
      await prisma.printing.upsert({
        where: { id },
        update: { externalIds },
        create: { id, cardId, language: locale, finish, stamp, externalIds },
      });
    }
  }
  await prisma.card.update({ where: { id: cardId }, data: { detailSyncedAt: new Date() } });
}

export function identifyCard(): { status: "provider_not_configured" } {
  return { status: "provider_not_configured" };
}
