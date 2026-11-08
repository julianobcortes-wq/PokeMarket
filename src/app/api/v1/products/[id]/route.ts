import { NextResponse } from "next/server";
import { preferredTranslation } from "@/server/catalog";
import { prisma } from "@/server/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const card = await prisma.card.findUnique({
    where: { id },
    include: { translations: true, expansion: true, printings: true },
  });
  if (!card) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  return NextResponse.json({
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
  });
}
