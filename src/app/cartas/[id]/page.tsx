import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { CardCondition } from "@prisma/client";
import { formatMoney } from "@/domain/money";
import { sortOffers } from "@/domain/offers";
import { brand } from "@/domain/brand";
import { isLocale, t } from "@/i18n";
import { ActionForm } from "@/components/action-form";
import { PricePanel } from "@/components/price-panel";
import { addToCartAction, alertAction, saveCollectionAction, watchAction } from "@/server/actions";
import { currentUser } from "@/server/auth";
import { cardImage, preferredTranslation } from "@/server/catalog";
import { prisma } from "@/server/db";
import { EntitlementDenied, loadPriceHistory, quotePrinting } from "@/server/pricing";
import { syncCardDetails } from "@/server/tcgdex";

const CONDITIONS: CardCondition[] = [
  "NEAR_MINT",
  "LIGHTLY_PLAYED",
  "MODERATELY_PLAYED",
  "HEAVILY_PLAYED",
  "DAMAGED",
];

const CONDITION_COPY: Record<CardCondition, string> = {
  NEAR_MINT: "Near Mint — sem desgaste visível relevante.",
  LIGHTLY_PLAYED: "Lightly Played — marcas leves de uso.",
  MODERATELY_PLAYED: "Moderately Played — desgaste claro, ainda jogável.",
  HEAVILY_PLAYED: "Heavily Played — desgaste forte.",
  DAMAGED: "Damaged — dano evidente, vinco, rasgo ou água.",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const card = await prisma.card.findUnique({ where: { id }, include: { translations: true, expansion: true } });
  if (!card) return {};
  const name = preferredTranslation(card.translations, "pt-BR")?.name ?? card.id;
  return {
    title: `${name} ${card.number}`,
    description: `${name}, ${card.expansion.name}. Ficha, ofertas e histórico no ${brand.name}.`,
    alternates: { canonical: `/cartas/${card.id}` },
  };
}

export default async function CardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ printing?: string; condition?: string; grade?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const jar = await cookies();
  const locale = isLocale(jar.get("pp_locale")?.value) ? jar.get("pp_locale")!.value : "pt-BR";
  const existing = await prisma.card.findUnique({ where: { id } });
  if (!existing) notFound();
  try {
    await syncCardDetails(existing.id);
  } catch {
    // The stub catalog remains usable when TCGdex is unavailable.
  }
  const card = await prisma.card.findUnique({
    where: { id },
    include: { translations: true, expansion: { include: { translations: true } }, printings: { orderBy: { id: "asc" } } },
  });
  if (!card) notFound();
  const translation = preferredTranslation(card.translations, locale);
  const printing =
    card.printings.find((item) => item.id === query.printing) ??
    card.printings.find((item) => item.language === (locale.startsWith("en") ? "en" : "pt") && item.finish === "NORMAL") ??
    card.printings[0];
  if (!printing) notFound();
  const condition = CONDITIONS.includes(query.condition as CardCondition) ? (query.condition as CardCondition) : "NEAR_MINT";
  const gradeKey = query.grade || "raw";
  const user = await currentUser();
  const quote = await quotePrinting({ printingId: printing.id, condition, gradeKey, marketId: "BR" });
  let history: Awaited<ReturnType<typeof loadPriceHistory>> = null;
  try {
    history = await loadPriceHistory({
      userId: user?.id ?? null,
      printingId: printing.id,
      condition,
      gradeKey,
      marketId: "BR",
      range: "3m",
    });
  } catch (error) {
    if (!(error instanceof EntitlementDenied)) throw error;
  }
  const listings = await prisma.listing.findMany({
    where: { printingId: printing.id, condition, gradeKey, status: "ACTIVE", seller: { status: "APPROVED" } },
    include: { seller: true, photos: true },
  });
  const available = listings.filter((listing) => listing.quantity - listing.reserved > 0);
  const sellerIds = available.map((listing) => listing.sellerId);
  const completed = sellerIds.length
    ? await prisma.sellerOrder.groupBy({
        by: ["sellerId"],
        where: { status: "COMPLETED", sellerId: { in: sellerIds } },
        _count: { _all: true },
      })
    : [];
  const completedBySeller = new Map(completed.map((row) => [row.sellerId, row._count._all]));
  const offers = sortOffers(
    available.map((listing) => ({
      listing,
      id: listing.id,
      priceMinor: listing.priceMinor,
      shippingMinor: listing.seller.shippingFlatMinor,
      handlingDays: listing.seller.handlingDays,
      completedOrders: completedBySeller.get(listing.sellerId) ?? 0,
      isOperationStore: listing.seller.isOperationStore,
    })),
  );
  const image = cardImage(translation?.imageUrl, "high");
  const currency = quote?.currency ?? "BRL";
  return (
    <article className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <div className="border border-line bg-panel p-4">
        {image ? <img src={image} alt={translation?.name ?? card.id} className="mx-auto w-full max-w-[240px]" /> : null}
        <p className="mt-3 text-center font-mono text-[11px] text-muted">Imagem via TCGdex, para identificação.</p>
      </div>
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-muted">
          <Link href={`/expansoes/${card.expansionId}`}>{preferredTranslation(card.expansion.translations, locale)?.name ?? card.expansion.name}</Link>
          {" · "}
          {card.number}
          {card.rarity ? ` · ${card.rarity}` : ""}
        </p>
        <h1 className="mt-1 font-serif text-4xl">{translation?.name ?? card.id}</h1>
        <p className="mt-2 text-sm text-muted">
          {printing.language.toUpperCase()} · {printing.finish}
          {printing.stamp ? ` · ${printing.stamp}` : ""} · {CONDITION_COPY[condition]}
          {gradeKey !== "raw" ? ` · graduação ${gradeKey}` : " · sem graduação"}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Quote
            label={t(locale, "product.market")}
            value={
              quote?.estimate.status === "estimated"
                ? formatMoney(quote.estimate.priceMinor, currency, locale)
                : t(locale, "product.insufficient")
            }
            hint={quote?.estimate.status === "estimated" ? quote.estimate.method : undefined}
          />
          <Quote
            label={t(locale, "product.lowest")}
            value={quote?.liveLowestAskMinor != null ? formatMoney(quote.liveLowestAskMinor, currency, locale) : "—"}
            hint={t(locale, "product.asks")}
          />
          <Quote
            label={t(locale, "product.median")}
            value={quote?.liveMedianAskMinor != null ? formatMoney(quote.liveMedianAskMinor, currency, locale) : "—"}
          />
          <Quote
            label={t(locale, "product.last")}
            value={
              quote?.estimate.status === "estimated" && quote.estimate.lastSaleMinor != null
                ? formatMoney(quote.estimate.lastSaleMinor, currency, locale)
                : "—"
            }
          />
        </div>
        {quote?.external ? (
          <p className="mt-3 text-sm text-muted">
            {t(locale, "product.external")}: {quote.external.sourceId} · {formatMoney(quote.external.priceMinor, currency, locale)}. Não é a estimativa do {brand.name}.
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          {card.printings.map((item) => (
            <Link
              key={item.id}
              href={`/cartas/${card.id}?printing=${encodeURIComponent(item.id)}&condition=${condition}&grade=${gradeKey}`}
              className={`border px-2 py-1 ${item.id === printing.id ? "border-ink" : "border-line text-muted"}`}
            >
              {item.language}/{item.finish}
              {item.stamp ? `/${item.stamp}` : ""}
            </Link>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {CONDITIONS.map((item) => (
            <Link
              key={item}
              href={`/cartas/${card.id}?printing=${encodeURIComponent(printing.id)}&condition=${item}&grade=${gradeKey}`}
              className={`border px-2 py-1 ${item === condition ? "border-ink" : "border-line text-muted"}`}
            >
              {item.replaceAll("_", " ")}
            </Link>
          ))}
        </div>
        <section className="mt-8 border border-line p-4">
          <h2 className="font-serif text-2xl">{t(locale, "product.history")}</h2>
          <div className="mt-4">
            <PricePanel
              printingId={printing.id}
              condition={condition}
              gradeKey={gradeKey}
              currency={history?.currency ?? currency}
              initialPoints={history?.points ?? []}
              paywall={t(locale, "product.paywall")}
              paywallCta={t(locale, "product.paywallCta")}
              empty={t(locale, "product.historyEmpty")}
              note={t(locale, "product.historyNote")}
            />
          </div>
          {history?.coverage ? (
            <p className="mt-2 font-mono text-[11px] text-muted">
              {history.coverage.pointCount} pontos
              {history.coverage.availableFrom ? ` · ${history.coverage.availableFrom} — ${history.coverage.availableTo}` : ""}
            </p>
          ) : null}
        </section>
        <section className="mt-8">
          <h2 className="font-serif text-2xl">{t(locale, "product.offers")}</h2>
          {offers.length === 0 ? <p className="mt-3 text-muted">{t(locale, "product.noOffers")}</p> : null}
          <ul className="mt-3 divide-y divide-line border border-line">
            {offers.map((offer) => {
              const total = offer.priceMinor + offer.shippingMinor;
              return (
                <li key={offer.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <p className="font-medium">
                      <Link href={`/loja/${offer.listing.seller.slug}`}>{offer.listing.seller.displayName}</Link>
                      {offer.listing.seller.isOperationStore ? <span className="ml-2 border border-line px-1 font-mono text-[11px]">Loja da operação</span> : null}
                      {offer.listing.isDemo ? <span className="ml-2 border border-stamp px-1 font-mono text-[11px] text-stamp">Demonstração</span> : null}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {offer.listing.seller.city}/{offer.listing.seller.state} · {offer.completedOrders} pedidos concluídos · envio em {offer.listing.seller.handlingDays} dias · frete {formatMoney(offer.shippingMinor, offer.listing.currency, locale)}
                    </p>
                    <p className="mt-1 font-mono text-sm">
                      {formatMoney(offer.priceMinor, offer.listing.currency, locale)} + frete = {formatMoney(total, offer.listing.currency, locale)} · {offer.listing.quantity - offer.listing.reserved} un.
                    </p>
                  </div>
                  <ActionForm action={addToCartAction}>
                    <input type="hidden" name="listingId" value={offer.id} />
                    <input type="hidden" name="quantity" value="1" />
                    <button className="bg-ink px-3 py-2 text-sm text-paper">{t(locale, "product.add")}</button>
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        </section>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <ActionForm action={saveCollectionAction} className="border border-line p-4">
            <input type="hidden" name="printingId" value={printing.id} />
            <input type="hidden" name="condition" value={condition} />
            <input type="hidden" name="gradeKey" value={gradeKey} />
            <h3 className="font-medium">{t(locale, "product.collection")}</h3>
            <label className="mt-3 block text-sm">
              Quantidade
              <input name="quantity" defaultValue="1" className="mt-1 w-full border border-line px-2 py-2" />
            </label>
            <label className="mt-3 block text-sm">
              Preço pago
              <input name="paid" placeholder="0,00" className="mt-1 w-full border border-line px-2 py-2" />
            </label>
            <label className="mt-3 block text-sm">
              Data
              <input name="acquiredAt" type="date" className="mt-1 w-full border border-line px-2 py-2" />
            </label>
            <button className="mt-3 border border-ink px-3 py-2 text-sm">Salvar</button>
          </ActionForm>
          <div className="border border-line p-4">
            <ActionForm action={watchAction}>
              <input type="hidden" name="printingId" value={printing.id} />
              <button className="border border-ink px-3 py-2 text-sm">{t(locale, "product.watch")}</button>
            </ActionForm>
            <ActionForm action={alertAction} className="mt-4">
              <input type="hidden" name="printingId" value={printing.id} />
              <label className="block text-sm">
                Alerta
                <select name="kind" className="mt-1 w-full border border-line px-2 py-2">
                  <option value="below_price">Abaixo de um preço</option>
                  <option value="availability">Quando houver anúncio</option>
                  <option value="change_pct">Variação percentual (Pro)</option>
                </select>
              </label>
              <input name="threshold" placeholder="Preço, se aplicável" className="mt-2 w-full border border-line px-2 py-2" />
              <button className="mt-3 border border-ink px-3 py-2 text-sm">Criar alerta</button>
            </ActionForm>
          </div>
        </div>
      </div>
    </article>
  );
}

function Quote({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-line p-3">
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
