import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { isLocale } from "@/i18n";
import { cardImage, preferredTranslation } from "@/server/catalog";
import { prisma } from "@/server/db";

export default async function ExpansionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const expansion = await prisma.expansion.findUnique({
    where: { id },
    include: { cards: { include: { translations: true }, orderBy: { number: "asc" } }, translations: true },
  });
  if (!expansion) notFound();
  const jar = await cookies();
  const locale = isLocale(jar.get("pp_locale")?.value) ? jar.get("pp_locale")!.value : "pt-BR";
  const name = preferredTranslation(expansion.translations, locale)?.name ?? expansion.name;
  return (
    <div>
      <h1 className="font-serif text-4xl">{name}</h1>
      <p className="mt-2 font-mono text-xs text-muted">{expansion.cardCount} cartas oficiais na fonte</p>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {expansion.cards.map((card) => {
          const translation = preferredTranslation(card.translations, locale);
          const image = cardImage(translation?.imageUrl, "low");
          return (
            <Link key={card.id} href={`/cartas/${card.id}`} className="border border-line bg-panel p-2">
              {image ? <img src={image} alt="" className="mx-auto h-28 object-contain" /> : null}
              <p className="mt-2 text-sm">{translation?.name ?? card.number}</p>
              <p className="font-mono text-[11px] text-muted">{card.number}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
