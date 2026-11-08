import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMoney } from "@/domain/money";
import { ActionForm } from "@/components/action-form";
import { cancelSubscriptionAction, logoutAction } from "@/server/actions";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const [orders, subscriptions, watches, alerts, notifications] = await Promise.all([
    prisma.order.findMany({ where: { buyerId: user.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.subscription.findMany({ where: { userId: user.id }, include: { plan: true }, orderBy: { createdAt: "desc" } }),
    prisma.watchItem.count({ where: { userId: user.id } }),
    prisma.priceAlert.findMany({ where: { userId: user.id, active: true } }),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-4xl">{user.name}</h1>
          <p className="text-muted">{user.email}</p>
        </div>
        <form action={logoutAction}><button className="text-sm text-muted">Sair</button></form>
      </div>
      <section>
        <h2 className="font-serif text-2xl">Pedidos</h2>
        {orders.length === 0 ? <p className="mt-2 text-muted">Nenhuma compra.</p> : null}
        <ul className="mt-2 divide-y divide-line border border-line">
          {orders.map((order) => (
            <li key={order.id}>
              <Link href={`/pedidos/${order.id}`} className="flex justify-between px-3 py-2 text-sm">
                <span>{order.status}{order.sandbox ? " · teste" : ""}</span>
                <span className="font-mono">{formatMoney(order.totalMinor, order.currency)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-serif text-2xl">Assinatura</h2>
        {subscriptions.length === 0 ? <p className="mt-2 text-muted">Plano Free. <Link href="/planos">Ver planos</Link></p> : null}
        {subscriptions.map((subscription) => (
          <div key={subscription.id} className="mt-2 border border-line p-3 text-sm">
            <p>{subscription.plan.name} · {subscription.status}{subscription.cancelAtPeriodEnd ? " · cancela no fim do ciclo" : ""}</p>
            {subscription.status === "ACTIVE" && !subscription.cancelAtPeriodEnd ? (
              <ActionForm action={cancelSubscriptionAction} className="mt-2">
                <input type="hidden" name="subscriptionId" value={subscription.id} />
                <button className="text-sm underline">Cancelar no fim do ciclo</button>
              </ActionForm>
            ) : null}
          </div>
        ))}
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="border border-line p-3">
          <h2 className="font-serif text-2xl">Lista de desejos</h2>
          <p className="mt-2 text-sm text-muted">{watches} itens</p>
        </div>
        <div className="border border-line p-3">
          <h2 className="font-serif text-2xl">Alertas</h2>
          {alerts.length === 0 ? <p className="mt-2 text-sm text-muted">Nenhum alerta.</p> : null}
          <ul className="mt-2 text-sm">
            {alerts.map((alert) => (
              <li key={alert.id}>{alert.kind} · {alert.subjectId}</li>
            ))}
          </ul>
          {notifications.map((notification) => (
            <p key={notification.id} className="mt-2 text-xs text-muted">{notification.body}</p>
          ))}
        </div>
      </section>
    </div>
  );
}
