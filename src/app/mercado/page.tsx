import { cookies } from "next/headers";
import { isLocale, t } from "@/i18n";
import { prisma } from "@/server/db";

export default async function MarketPage() {
  const jar = await cookies();
  const locale = isLocale(jar.get("pp_locale")?.value) ? jar.get("pp_locale")!.value : "pt-BR";
  const [cards, sales, sources, markets] = await Promise.all([
    prisma.card.count(),
    prisma.priceObservation.count({ where: { type: "VERIFIED_SALE", licenseAllowsDisplay: true, demo: false } }),
    prisma.dataSource.findMany({ orderBy: { name: "asc" } }),
    prisma.market.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-stamp">Global Market</p>
      <h1 className="mt-2 font-serif text-4xl">{t(locale, "market.title")}</h1>
      <p className="mt-3 max-w-2xl text-muted">{t(locale, "market.lede")}</p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="border border-line p-4">
          <dt className="font-mono text-[11px] uppercase text-muted">Produtos monitorados</dt>
          <dd className="mt-1 font-serif text-3xl">{cards}</dd>
        </div>
        <div className="border border-line p-4">
          <dt className="font-mono text-[11px] uppercase text-muted">Vendas verificadas</dt>
          <dd className="mt-1 font-serif text-3xl">{sales}</dd>
        </div>
        <div className="border border-line p-4">
          <dt className="font-mono text-[11px] uppercase text-muted">Índice global</dt>
          <dd className="mt-1 text-lg">Não publicado</dd>
        </div>
      </dl>
      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="font-serif text-2xl">Maiores altas e quedas</h2>
          <p className="mt-2 text-muted">Sem pares de vendas verificadas, estas listas ficam vazias.</p>
        </div>
        <div>
          <h2 className="font-serif text-2xl">Mercados</h2>
          <ul className="mt-2 divide-y divide-line border border-line">
            {markets.map((market) => (
              <li key={market.id} className="flex justify-between px-3 py-2 text-sm">
                <span>{market.name}</span>
                <span className="font-mono text-xs text-muted">
                  {market.checkoutEnabled ? "checkout" : market.intelligenceEnabled ? "inteligência" : "planejado"} · {market.defaultCurrency}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="mt-8">
        <h2 className="font-serif text-2xl">Fontes</h2>
        <ul className="mt-2 divide-y divide-line border border-line">
          {sources.map((source) => (
            <li key={source.id} className="px-3 py-3 text-sm">
              <p className="font-medium">
                {source.name} · {source.enabled ? "ativa" : "desligada"} · preço {source.pricingAllowed ? "permitido" : "não importado"}
              </p>
              <p className="text-muted">{source.licenseNote}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
