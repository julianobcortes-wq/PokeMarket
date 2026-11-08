import Link from "next/link";
import { cookies } from "next/headers";
import { isLocale } from "@/i18n";
import { cardImage, preferredTranslation, searchCards } from "@/server/catalog";

export default async function CardsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const jar = await cookies();
  const locale = isLocale(jar.get("pp_locale")?.value) ? jar.get("pp_locale")!.value : "pt-BR";
  const cards = await searchCards(q, locale, 36);
  return (
    <div>
      <h1 className="font-serif text-4xl">Cartas</h1>
      <p className="mt-2 text-muted">{q ? `Resultados para “${q}”.` : "Comece pelo nome, número ou expansão."}</p>
      {cards.length === 0 ? <p className="mt-8 text-muted">Nenhuma carta encontrada.</p> : null}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((card) => {
          const translation = preferredTranslation(card.translations, locale);
          const image = cardImage(translation?.imageUrl, "low");
          return (
            <Link key={card.id} href={`/cartas/${card.id}`} className="border border-line bg-panel p-3">
              {image ? <img src={image} alt="" className="mx-auto h-40 object-contain" /> : null}
              <p className="mt-2 font-medium">{translation?.name ?? card.id}</p>
              <p className="font-mono text-xs text-muted">
                {card.expansion.name} · {card.number}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
