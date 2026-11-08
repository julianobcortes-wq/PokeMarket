import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney } from "@/domain/money";
import { preferredTranslation } from "@/server/catalog";
import { prisma } from "@/server/db";

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const seller = await prisma.seller.findUnique({
    where: { slug },
    include: { listings: { where: { status: "ACTIVE" }, include: { printing: { include: { card: { include: { translations: true } } } } }, take: 40 } },
  });
  if (!seller || (seller.status !== "APPROVED" && seller.status !== "SUSPENDED")) notFound();
  const completed = await prisma.sellerOrder.count({ where: { sellerId: seller.id, status: "COMPLETED" } });
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-wide text-muted">{seller.city}/{seller.state}</p>
      <h1 className="font-serif text-4xl">{seller.displayName}</h1>
      <p className="mt-2 text-sm">
        {seller.isOperationStore ? <span className="mr-2 border border-line px-1">Loja da operação</span> : null}
        {seller.status} · {completed} pedidos concluídos
      </p>
      {seller.bio ? <p className="mt-3 max-w-2xl text-muted">{seller.bio}</p> : null}
      <ul className="mt-6 divide-y divide-line border border-line">
        {seller.listings.map((listing) => {
          const name = preferredTranslation(listing.printing?.card.translations ?? [], "pt-BR")?.name ?? "Item";
          return (
            <li key={listing.id} className="flex justify-between px-3 py-3 text-sm">
              <Link href={listing.printing ? `/cartas/${listing.printing.cardId}` : "/cartas"}>{name}</Link>
              <span className="font-mono">{formatMoney(listing.priceMinor, listing.currency)}</span>
            </li>
          );
        })}
      </ul>
      {seller.listings.length === 0 ? <p className="mt-4 text-muted">Esta loja ainda não publicou anúncios.</p> : null}
    </div>
  );
}
