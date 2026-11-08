import Link from "next/link";
import { cookies } from "next/headers";
import { t, isLocale } from "@/i18n";
import { cardImage, preferredTranslation } from "@/server/catalog";
import { prisma } from "@/server/db";
import { SearchBox } from "@/components/search-box";

export default async function HomePage() {
  const jar = await cookies();
  const locale = isLocale(jar.get("pp_locale")?.value) ? jar.get("pp_locale")!.value : "pt-BR";
  const [indices, cards, observations, sellers] = await Promise.all([
    prisma.marketIndex.findMany({ include: { methodologies: { where: { active: true }, take: 1 } }, orderBy: { name: "asc" } }),
    prisma.card.findMany({
      take: 8,
      orderBy: { id: "asc" },
      include: { translations: true, expansion: true },
    }),
    prisma.priceObservation.count({ where: { type: "VERIFIED_SALE", demo: false, licenseAllowsDisplay: true } }),
    prisma.seller.count({ where: { status: "APPROVED" } }),
  ]);
  return (
    <div className="space-y-12">
      <section className="grid items-start gap-10 lg:grid-cols-[1.35fr_0.75fr]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-stamp">{t(locale, "home.kicker")}</p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-[1.05] md:text-6xl">{t(locale, "home.title")}</h1>
          <p className="mt-4 max-w-xl text-lg text-muted">{t(locale, "home.lede")}</p>
          <div className="mt-6 max-w-xl">
            <SearchBox placeholder={t(locale, "home.search")} label={t(locale, "nav.search")} />
          </div>
        </div>
        <aside className="border border-line bg-panel">
          <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
            <h2 className="font-serif text-2xl">{t(locale, "home.market")}</h2>
            <span className="font-mono text-[11px] text-muted">{observations} vendas</span>
          </div>
          <ul>
            {indices.slice(0, 6).map((index) => (
              <li key={index.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
                <span>{index.name}</span>
                <span className="font-mono text-xs text-muted">{index.published ? "publicado" : t(locale, "home.unpublished")}</span>
              </li>
            ))}
          </ul>
          <p className="px-4 py-3 text-sm text-muted">{t(locale, "home.coverage")}</p>
        </aside>
      </section>
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-serif text-3xl">Catálogo</h2>
          <Link href="/cartas" className="text-sm text-muted">
            Ver cartas
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {cards.map((card) => {
            const translation = preferredTranslation(card.translations, locale);
            const image = cardImage(translation?.imageUrl, "low");
            return (
              <Link key={card.id} href={`/cartas/${card.id}`} className="border border-line bg-panel p-3">
                {image ? <img src={image} alt={translation?.name ?? card.id} className="mx-auto h-44 object-contain" /> : null}
                <p className="mt-3 font-medium">{translation?.name ?? card.id}</p>
                <p className="font-mono text-xs text-muted">
                  {card.expansion.name} · {card.number}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <article className="border border-line p-6">
          <h2 className="font-serif text-3xl">{t(locale, "home.sellTitle")}</h2>
          <p className="mt-3 text-muted">{t(locale, "home.sellBody")}</p>
          <p className="mt-4 font-mono text-xs text-muted">{sellers} lojas aprovadas</p>
          <Link href="/vender" className="mt-5 inline-flex bg-ink px-3 py-2 text-sm text-paper">
            {t(locale, "nav.sell")}
          </Link>
        </article>
        <article className="border border-line p-6">
          <h2 className="font-serif text-3xl">{t(locale, "home.premiumTitle")}</h2>
          <p className="mt-3 text-muted">{t(locale, "home.premiumBody")}</p>
          <Link href="/planos" className="mt-5 inline-flex border border-ink px-3 py-2 text-sm">
            {t(locale, "nav.plans")}
          </Link>
        </article>
      </section>
    </div>
  );
}
