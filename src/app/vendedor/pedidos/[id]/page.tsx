import { notFound, redirect } from "next/navigation";
import { formatMoney } from "@/domain/money";
import { currentUser } from "@/server/auth";
import { CommerceError, readSellerOrder } from "@/server/commerce";

export default async function SellerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const { id } = await params;
  try {
    const order = await readSellerOrder(user.id, id);
    return (
      <div>
        <h1 className="font-serif text-4xl">Pedido da loja</h1>
        <p className="mt-2 font-mono text-sm">{order.status} · {formatMoney(order.itemsMinor, order.currency)}</p>
        <ul className="mt-4 divide-y divide-line border border-line">
          {order.items.map((item) => (
            <li key={item.id} className="px-3 py-2 text-sm">{item.titleSnapshot} · {item.quantity}</li>
          ))}
        </ul>
        {order.commission ? <p className="mt-3 text-sm">Comissão {formatMoney(order.commission.commissionMinor, order.currency)} · líquido {formatMoney(order.commission.sellerNetMinor, order.currency)}</p> : null}
      </div>
    );
  } catch (error) {
    if (error instanceof CommerceError) notFound();
    throw error;
  }
}
