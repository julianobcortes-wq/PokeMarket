import type { MetadataRoute } from "next";
import { brand } from "@/domain/brand";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = `https://${brand.domain}`;
  const [cards, expansions] = await Promise.all([
    prisma.card.findMany({ select: { id: true } }),
    prisma.expansion.findMany({ select: { id: true } }),
  ]);
  return [
    { url: base },
    { url: `${base}/mercado` },
    { url: `${base}/cartas` },
    { url: `${base}/planos` },
    ...expansions.map((expansion) => ({ url: `${base}/expansoes/${expansion.id}` })),
    ...cards.map((card) => ({ url: `${base}/cartas/${card.id}` })),
  ];
}
