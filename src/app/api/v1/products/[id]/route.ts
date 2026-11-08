import { NextRequest, NextResponse } from "next/server";
import { preferredTranslation } from "@/server/catalog";
import { prisma } from "@/server/db";
import { consumeRateLimit, withRateLimit } from "@/server/http-limit";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limit = consumeRateLimit(request, "product", 60);
  if (!limit.ok) return withRateLimit(NextResponse.json({ error: { code: "RATE_LIMIT" } }, { status: 429 }), limit.token);
  const { id } = await context.params;
  const card = await prisma.card.findUnique({
    where: { id },
    include: { translations: true, expansion: true, printings: true },
  });
  if (!card) return withRateLimit(NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 }), limit.token);
  return withRateLimit(NextResponse.json({
    id: card.id,
    number: card.number,
    rarity: card.rarity,
    expansion: { id: card.expansion.id, name: card.expansion.name },
    names: card.translations.map((row) => ({ locale: row.locale, name: row.name })),
    name: preferredTranslation(card.translations, "pt-BR")?.name,
    printings: card.printings.map((printing) => ({
      id: printing.id,
      language: printing.language,
      finish: printing.finish,
      stamp: printing.stamp,
    })),
  }), limit.token);
}
