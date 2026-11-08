import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMoney } from "@/domain/money";
import { collectionView } from "@/server/collection";
import { currentUser } from "@/server/auth";
import { preferredTranslation } from "@/server/catalog";
import { prisma } from "@/server/db";

export default async function CollectionPage() {
  const user = await currentUser();
  if (!user) redirect("/entrar?next=/colecao");
  const view = await collectionView(user.id);
  const printings = await prisma.printing.findMany({
    where: { id: { in: view.items.map((row) => row.item.printingId).filter((id): id is string => Boolean(id)) } },
    include: { card: { include: { translations: true } } },
  });
  const byId = new Map(printings.map((printing) => [printing.id, printing]));
  return (
    <div>
      <h1 className="font-serif text-4xl">Minha coleção</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Compras entram como custo. A diferença para a referência só aparece quando existe preço estimado por venda verificada. Sem cotação, o item fica sem valor de mercado — não como zero.
      </p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Custo das compras" value={formatMoney(view.bridge.capitalInMinor, "BRL")} />
        <Stat label="Referência atual" value={view.bridge.marketEndMinor == null ? "Incompleta" : formatMoney(view.bridge.marketEndMinor, "BRL")} />
        <Stat label="Valorização" value={view.bridge.appreciationMinor == null ? "Sem base" : formatMoney(view.bridge.appreciationMinor, "BRL")} />
      </dl>
      {!view.fullHistory ? <p className="mt-3 text-sm text-muted">O histórico longo da coleção faz parte do Collector Pro. O custo e a posição atual continuam visíveis.</p> : null}
      {view.items.length === 0 ? <p className="mt-8 text-muted">Adicione uma carta pela página do produto.</p> : null}
      <ul className="mt-6 divide-y divide-line border border-line">
        {view.items.map((row) => {
          const printing = row.item.printingId ? byId.get(row.item.printingId) : undefined;
          const name = preferredTranslation(printing?.card.translations ?? [], "pt-BR")?.name ?? printing?.cardId ?? "Item";
          return (
            <li key={row.item.id} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
              <div>
                <Link href={printing ? `/cartas/${printing.cardId}` : "/cartas"}>{name}</Link>
                <p className="text-muted">{row.quantity} un. · custo {formatMoney(row.cost, "BRL")}</p>
              </div>
              <p>{row.value == null ? "sem cotação" : formatMoney(row.value, "BRL")}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line p-3">
      <dt className="font-mono text-[11px] uppercase text-muted">{label}</dt>
      <dd className="mt-1 text-lg">{value}</dd>
    </div>
  );
}
