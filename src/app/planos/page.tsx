import { cookies } from "next/headers";
import { formatMoney } from "@/domain/money";
import { isLocale, t } from "@/i18n";
import { ActionForm } from "@/components/action-form";
import { subscribeAction } from "@/server/actions";
import { prisma } from "@/server/db";

const FEATURES: Record<string, string[]> = {
  free: [
    "Pesquisa e preços atuais",
    "Gráfico de 7 dias, 30 dias e 3 meses",
    "Compra e comparação de anúncios",
    "Coleção, watchlist e alertas com limite",
  ],
  collector_pro: [
    "Todo o histórico que realmente existe",
    "Comparação histórica, regional e com índices",
    "Liquidez, volatilidade e relatórios",
    "Coleção e alertas avançados",
  ],
  seller_pro: [
    "Histórico completo e inteligência de preço",
    "Concorrentes, giro, margem e demanda",
    "Sugestão apenas com dado suficiente",
    "Não substitui a aprovação para vender",
  ],
};

export default async function PlansPage() {
  const jar = await cookies();
  const locale = isLocale(jar.get("pp_locale")?.value) ? jar.get("pp_locale")!.value : "pt-BR";
  const plans = await prisma.subscriptionPlan.findMany({
    where: { public: true },
    orderBy: { sort: "asc" },
    include: { prices: { where: { active: true } } },
  });
  return (
    <div>
      <h1 className="font-serif text-4xl">{t(locale, "plans.title")}</h1>
      <p className="mt-3 max-w-2xl text-muted">{t(locale, "plans.freeNote")} Nenhum plano pago vem pré-selecionado. O cancelamento fica na conta, para o fim do ciclo já pago.</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.id} className="flex flex-col border border-line p-5">
            <h2 className="font-serif text-3xl">{plan.name}</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {(FEATURES[plan.id] ?? []).map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <div className="mt-auto pt-6">
              {plan.id === "free" ? (
                <p className="text-sm text-muted">Sem cobrança.</p>
              ) : plan.prices.length === 0 ? (
                <p className="text-sm">{t(locale, "plans.unset")}</p>
              ) : (
                plan.prices.map((price) => (
                  <ActionForm key={price.id} action={subscribeAction} className="mt-3">
                    <input type="hidden" name="planId" value={plan.id} />
                    <input type="hidden" name="priceId" value={price.id} />
                    <button className="w-full border border-ink px-3 py-2 text-left text-sm">
                      {t(locale, "plans.subscribe")} · {formatMoney(price.amountMinor, price.currency, locale)} / {price.interval === "year" ? "ano" : "mês"} · {price.marketId}
                    </button>
                  </ActionForm>
                ))
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
