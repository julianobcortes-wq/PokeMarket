import { notFound, redirect } from "next/navigation";
import { formatMoney } from "@/domain/money";
import { ActionForm } from "@/components/action-form";
import { completeOrderAction } from "@/server/actions";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { sandboxCommerceEnabled } from "@/server/sandbox";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, buyerId: user.id },
    include: { items: true, payments: true, sellerOrders: { include: { shipment: true, commission: true, seller: true } } },
  });
  if (!order) notFound();
  return (
    <div>
      <h1 className="font-serif text-4xl">Pedido</h1>
      <p className="mt-2 font-mono text-sm">{order.status} · {formatMoney(order.totalMinor, order.currency)}{order.sandbox ? " · sandbox" : ""}</p>
      <ul className="mt-4 divide-y divide-line border border-line">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between px-3 py-2 text-sm">
            <span>{item.titleSnapshot} · {item.quantity}</span>
            <span className="font-mono">{formatMoney(item.unitPriceMinor * item.quantity, item.currency)}</span>
          </li>
        ))}
      </ul>
      <ul className="mt-4 space-y-2 text-sm">
        {order.sellerOrders.map((sellerOrder) => (
          <li key={sellerOrder.id} className="border border-line p-3">
            <p>{sellerOrder.seller.displayName} · {sellerOrder.status}</p>
            <p className="text-muted">Frete {formatMoney(sellerOrder.shippingMinor, sellerOrder.currency)} · envio {sellerOrder.shipment?.integrated ? sellerOrder.shipment.carrier : "sem transportadora integrada"}</p>
            {sellerOrder.commission ? <p className="font-mono text-xs">Comissão {formatMoney(sellerOrder.commission.commissionMinor, sellerOrder.currency)} · líquido do vendedor {formatMoney(sellerOrder.commission.sellerNetMinor, sellerOrder.currency)}</p> : <p className="text-xs text-muted">Comissão só é reconhecida quando o pedido é concluído.</p>}
          </li>
        ))}
      </ul>
      {order.status === "PAID" && order.sandbox && sandboxCommerceEnabled() ? (
        <ActionForm action={completeOrderAction} className="mt-4">
          <input type="hidden" name="orderId" value={order.id} />
          <button className="border border-ink px-3 py-2 text-sm">Confirmar recebimento</button>
        </ActionForm>
      ) : null}
    </div>
  );
}
