import { prisma } from "./db";

export function catalogLocale(locale: string): string {
  if (locale.startsWith("pt")) return "pt";
  if (locale.startsWith("en")) return "en";
  if (locale.startsWith("es")) return "es";
  if (locale.startsWith("ja")) return "ja";
  if (locale.startsWith("fr")) return "fr";
  if (locale.startsWith("de")) return "de";
  return "pt";
}

export function cardImage(base: string | null | undefined, size: "low" | "high" = "low"): string | null {
  if (!base) return null;
  if (/\.(webp|png|jpe?g)$/i.test(base)) return base;
  return `${base}/${size}.webp`;
}

export async function searchCards(query: string, locale: string, limit = 24) {
  const q = query.trim();
  const language = catalogLocale(locale);
  if (q.length < 1) {
    return prisma.card.findMany({
      take: limit,
      orderBy: { localId: "asc" },
      include: { translations: true, expansion: true, printings: true },
    });
  }
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT c.id
    FROM "Card" c
    JOIN "CardTranslation" t ON t."cardId" = c.id
    JOIN "Expansion" e ON e.id = c."expansionId"
    WHERE (
      t.name ILIKE ${like}
      OR c.number ILIKE ${like}
      OR c.id ILIKE ${like}
      OR e.name ILIKE ${like}
      OR (char_length(${q}) >= 3 AND t.name % ${q})
    )
    GROUP BY c.id, t.name
    ORDER BY MAX(similarity(t.name, ${q})) DESC, t.name ASC
    LIMIT ${limit}
  `;
  if (rows.length === 0) return [];
  const cards = await prisma.card.findMany({
    where: { id: { in: rows.map((row) => row.id) } },
    include: { translations: true, expansion: { include: { translations: true } }, printings: true },
  });
  const order = new Map(rows.map((row, index) => [row.id, index]));
  return cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export function preferredTranslation<T extends { locale: string; name: string }>(
  translations: T[],
  locale: string,
): T | undefined {
  const wanted = catalogLocale(locale);
  return (
    translations.find((row) => row.locale === wanted) ??
    translations.find((row) => row.locale === "pt") ??
    translations.find((row) => row.locale === "en") ??
    translations[0]
  );
}
