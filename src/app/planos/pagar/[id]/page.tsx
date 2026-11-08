import { notFound, redirect } from "next/navigation";
import { formatMoney } from "@/domain/money";
import { ActionForm } from "@/components/action-form";
import { confirmSubscriptionAction } from "@/server/actions";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function PaySubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const { id } = await params;
  const subscription = await prisma.subscription.findFirst({
    where: { id, userId: user.id },
    include: { plan: true },
  });
  if (!subscription) notFound();
  const price = subscription.priceId ? await prisma.planPrice.findUnique({ where: { id: subscription.priceId } }) : null;
  return (
    <div className="max-w-lg">
      <p className="font-mono text-xs uppercase tracking-wide text-stamp">Ambiente de testes</p>
      <h1 className="mt-2 font-serif text-4xl">{subscription.plan.name}</h1>
      <p className="mt-3 text-muted">Nenhum provedor real será chamado. A confirmação grava uma fatura e libera os direitos por webhook idempotente.</p>
      <p className="mt-4 font-mono">{price ? formatMoney(price.amountMinor, price.currency) : "Sem preço"}</p>
      <ActionForm action={confirmSubscriptionAction} className="mt-6 flex gap-3">
        <input type="hidden" name="subscriptionId" value={subscription.id} />
        <button name="decision" value="approve" className="bg-ink px-3 py-2 text-sm text-paper">
          Simular pagamento aprovado
        </button>
        <button name="decision" value="decline" className="border border-ink px-3 py-2 text-sm">
          Simular recusa
        </button>
      </ActionForm>
    </div>
  );
}
