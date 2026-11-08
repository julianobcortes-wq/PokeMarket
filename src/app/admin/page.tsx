import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMoney } from "@/domain/money";
import { ActionForm } from "@/components/action-form";
import { commissionAction } from "@/server/actions";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") redirect("/");
  const [gmv, commission, orders, pendingSellers, activeSellers, subs, rule, audits] = await Promise.all([
    prisma.order.aggregate({ where: { status: "COMPLETED" }, _sum: { itemsMinor: true }, _count: true }),
    prisma.commissionEntry.aggregate({ where: { status: "RECOGNIZED" }, _sum: { commissionMinor: true } }),
    prisma.order.count(),
    prisma.sellerApplication.count({ where: { status: { in: ["SUBMITTED", "IN_REVIEW", "DOCS_REQUESTED"] } } }),
    prisma.seller.count({ where: { status: "APPROVED" } }),
    prisma.subscription.findMany({ where: { status: "ACTIVE" } }),
    prisma.commissionRule.findFirst({ where: { active: true, sellerId: null, countryCode: null } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const prices = await prisma.planPrice.findMany({ where: { id: { in: subs.map((sub) => sub.priceId).filter((id): id is string => Boolean(id)) } } });
  const priceById = new Map(prices.map((price) => [price.id, price]));
  const mrrByCurrency = new Map<string, number>();
  for (const sub of subs) {
    const price = sub.priceId ? priceById.get(sub.priceId) : undefined;
    if (!price) continue;
    const monthly = price.interval === "year" ? Math.round(price.amountMinor / 12) : price.amountMinor;
    mrrByCurrency.set(price.currency, (mrrByCurrency.get(price.currency) ?? 0) + monthly);
  }
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-4xl">Administração</h1>
      <div className="flex gap-4 text-sm">
        <Link href="/admin/inscricoes">Inscrições ({pendingSellers})</Link>
        <Link href="/admin/planos">Preços dos planos</Link>
        <Link href="/admin/fontes">Fontes</Link>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <Stat label="GMV concluído" value={formatMoney(gmv._sum.itemsMinor ?? 0, "BRL")} hint={`${gmv._count} pedidos`} />
        <Stat label="Comissão reconhecida" value={formatMoney(commission._sum.commissionMinor ?? 0, "BRL")} hint="Não inclui GMV nem repasse" />
        <Stat label="Pedidos" value={String(orders)} hint={`${activeSellers} lojas ativas`} />
      </dl>
      <section>
        <h2 className="font-serif text-2xl">Assinaturas</h2>
        <p className="mt-2 text-sm text-muted">{subs.length} ativas. MRR por moeda, sem somar moedas diferentes.</p>
        <ul className="mt-2 text-sm">
          {[...mrrByCurrency.entries()].map(([currency, amount]) => (
            <li key={currency}>MRR {formatMoney(amount, currency)} · ARR {formatMoney(amount * 12, currency)}</li>
          ))}
          {mrrByCurrency.size === 0 ? <li>Nenhuma assinatura paga ativa.</li> : null}
        </ul>
      </section>
      <section className="max-w-md">
        <h2 className="font-serif text-2xl">Comissão geral</h2>
        <p className="mt-2 text-sm text-muted">Atual: {rule ? `${(rule.rateBps / 100).toFixed(2)}%` : "não definida"}. O valor mora no banco, não no código.</p>
        <ActionForm action={commissionAction} className="mt-3 space-y-2">
          <input name="rateBps" placeholder="Pontos-base (1000 = 10%)" className="w-full border border-line px-2 py-2" />
          <input name="reason" placeholder="Motivo da mudança" required className="w-full border border-line px-2 py-2" />
          <button className="border border-ink px-3 py-2 text-sm">Atualizar</button>
        </ActionForm>
      </section>
      <section>
        <h2 className="font-serif text-2xl">Auditoria recente</h2>
        <ul className="mt-2 divide-y divide-line border border-line text-sm">
          {audits.map((log) => (
            <li key={log.id} className="px-3 py-2">{log.action} · {log.entity} · {log.reason ?? ""}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="border border-line p-3"><dt className="font-mono text-[11px] uppercase text-muted">{label}</dt><dd className="mt-1 text-lg">{value}</dd>{hint ? <p className="text-xs text-muted">{hint}</p> : null}</div>;
}
