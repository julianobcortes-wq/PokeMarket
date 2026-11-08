import { NextRequest, NextResponse } from "next/server";
import { searchCards, preferredTranslation, catalogLocale } from "@/server/catalog";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const locale = request.nextUrl.searchParams.get("locale") ?? "pt-BR";
  const cards = await searchCards(q, locale, 24);
  return NextResponse.json({
    products: cards.map((card) => ({
      id: card.id,
      number: card.number,
      name: preferredTranslation(card.translations, locale)?.name ?? card.id,
      expansionId: card.expansionId,
      language: catalogLocale(locale),
    })),
  });
}
