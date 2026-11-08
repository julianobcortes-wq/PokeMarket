import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMoney } from "@/domain/money";
import { currentUser } from "@/server/auth";
import { accessFor } from "@/server/access";
import { sellerOrdersFor } from "@/server/commerce";
import { prisma } from "@/server/db";

export default async function SellerHome() {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  if (!user.seller) redirect("/vender");
  const [listings, orders, access] = await Promise.all([
    prisma.listing.findMany({ where: { sellerId: user.seller.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    sellerOrdersFor(user.id),
    accessFor(user.id),
  ]);
  const paid = orders.filter((order) => order.status === "COMPLETED");
  const net = paid.reduce((sum, order) => sum + order.sellerNetMinor, 0);
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl">{user.seller.displayName}</h1>
          <p className="text-sm text-muted">{user.seller.status}. Seller Pro não é exigido para anunciar.</p>
        </div>
        {user.seller.status === "APPROVED" ? (
          <Link href="/vendedor/anunciar" className="bg-ink px-3 py-2 text-sm text-paper">Novo anúncio</Link>
        ) : (
          <p className="text-sm text-down">Loja suspensa ou bloqueada: novos anúncios estão fechados.</p>
        )}
      </div>
      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Anúncios" value={String(listings.length)} />
        <Stat label="Pedidos" value={String(orders.length)} />
        <Stat label="Líquido reconhecido" value={formatMoney(net, "BRL")} />
      </dl>
      {!access.has("seller_analytics") ? (
        <p className="mt-4 text-sm text-muted">Comparação com concorrentes, giro e exportação ficam no Seller Pro. O operacional básico continua aqui.</p>
      ) : (
        <p className="mt-4 text-sm">Seller Pro ativo. Sugestão de preço só aparece quando houver vendas verificadas suficientes — hoje a estimativa ainda pode estar vazia.</p>
      )}
      <h2 className="mt-8 font-serif text-2xl">Pedidos da loja</h2>
      <ul className="mt-2 divide-y divide-line border border-line">
        {orders.map((order) => (
          <li key={order.id}>
            <Link href={`/vendedor/pedidos/${order.id}`} className="flex justify-between px-3 py-2 text-sm">
              <span>{order.status}</span>
              <span className="font-mono">{formatMoney(order.itemsMinor, order.currency)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="border border-line p-3"><dt className="font-mono text-[11px] uppercase text-muted">{label}</dt><dd className="mt-1 text-lg">{value}</dd></div>;
}
