import { notFound, redirect } from "next/navigation";
import { formatMoney } from "@/domain/money";
import { ActionForm } from "@/components/action-form";
import { paySandboxAction } from "@/server/actions";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { sandboxCommerceEnabled } from "@/server/sandbox";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ resultado?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const { paymentId } = await params;
  const { resultado } = await searchParams;
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, order: { buyerId: user.id } },
    include: { order: { include: { items: true, sellerOrders: true } } },
  });
  if (!payment) notFound();
  return (
    <div className="max-w-lg">
      <p className="font-mono text-xs uppercase tracking-wide text-stamp">Sandbox · sem captura real</p>
      <h1 className="mt-2 font-serif text-4xl">Pagamento de teste</h1>
      <p className="mt-3 font-mono">{formatMoney(payment.amountMinor, payment.currency)} · {payment.status}</p>
      <p className="mt-2 text-sm text-muted">{payment.order.sellerOrders.length} pedido(s) de vendedor dentro desta compra. O frete de cada loja fica separado da comissão.</p>
      {resultado === "recusado" ? <p className="mt-3 text-down">Pagamento recusado. A reserva de estoque foi liberada.</p> : null}
      {payment.status === "PENDING" && sandboxCommerceEnabled() ? (
        <ActionForm action={paySandboxAction} className="mt-6 flex gap-3">
          <input type="hidden" name="paymentId" value={payment.id} />
          <button name="decision" value="approve" className="bg-ink px-3 py-2 text-sm text-paper">Simular Pix aprovado</button>
          <button name="decision" value="decline" className="border border-ink px-3 py-2 text-sm">Simular recusa</button>
        </ActionForm>
      ) : null}
      {payment.status === "PENDING" && !sandboxCommerceEnabled() ? (
        <p className="mt-6 text-sm text-muted">O pagamento simulado está desligado neste ambiente. A tela fica disponível para navegação, sem baixar estoque nem marcar pedido como pago.</p>
      ) : null}
    </div>
  );
}
