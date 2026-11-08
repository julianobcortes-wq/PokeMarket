import { NextRequest, NextResponse } from "next/server";
import { searchCards, preferredTranslation, catalogLocale } from "@/server/catalog";
import { consumeRateLimit, withRateLimit } from "@/server/http-limit";

export async function GET(request: NextRequest) {
  const limit = consumeRateLimit(request, "products", 60);
  if (!limit.ok) return withRateLimit(NextResponse.json({ error: { code: "RATE_LIMIT" } }, { status: 429 }), limit.token);
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const locale = request.nextUrl.searchParams.get("locale") ?? "pt-BR";
  const cards = await searchCards(q, locale, 24);
  return withRateLimit(NextResponse.json({
    products: cards.map((card) => ({
      id: card.id,
      number: card.number,
      name: preferredTranslation(card.translations, locale)?.name ?? card.id,
      expansionId: card.expansionId,
      language: catalogLocale(locale),
    })),
  }), limit.token);
}
