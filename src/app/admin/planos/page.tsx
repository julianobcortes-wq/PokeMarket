import { redirect } from "next/navigation";
import { formatMoney } from "@/domain/money";
import { ActionForm } from "@/components/action-form";
import { publishPriceAction } from "@/server/actions";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function PlanAdminPage() {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") redirect("/");
  const plans = await prisma.subscriptionPlan.findMany({ where: { id: { not: "free" } }, include: { prices: { orderBy: { activeFrom: "desc" }, take: 4 } } });
  const markets = await prisma.market.findMany();
  return (
    <div>
      <h1 className="font-serif text-4xl">Preços</h1>
      <p className="mt-2 max-w-2xl text-muted">Nada aqui está fixado no código. Publique o valor por mercado, moeda e ciclo. O anterior deixa de valer sem reescrever o período já contratado.</p>
      {plans.map((plan) => (
        <section key={plan.id} className="mt-6 border border-line p-4">
          <h2 className="font-serif text-2xl">{plan.name}</h2>
          <ul className="mt-2 text-sm">
            {plan.prices.map((price) => (
              <li key={price.id}>{price.active ? "ativo" : "encerrado"} · {formatMoney(price.amountMinor, price.currency)} / {price.interval} · {price.marketId}</li>
            ))}
          </ul>
          <ActionForm action={publishPriceAction} className="mt-3 grid gap-2 md:grid-cols-4">
            <input type="hidden" name="planId" value={plan.id} />
            <select name="marketId" className="border border-line px-2 py-2">{markets.map((market) => <option key={market.id}>{market.id}</option>)}</select>
            <select name="currency" className="border border-line px-2 py-2"><option>BRL</option><option>USD</option><option>EUR</option></select>
            <select name="interval" className="border border-line px-2 py-2"><option value="month">mensal</option><option value="year">anual</option></select>
            <input name="amount" placeholder="Valor" className="border border-line px-2 py-2" />
            <button className="border border-ink px-3 py-2 text-sm md:col-span-4">Publicar preço</button>
          </ActionForm>
        </section>
      ))}
    </div>
  );
}
