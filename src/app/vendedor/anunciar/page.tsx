import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { createListingAction } from "@/server/actions";
import { currentUser } from "@/server/auth";
import { preferredTranslation } from "@/server/catalog";
import { prisma } from "@/server/db";

export default async function NewListingPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await currentUser();
  if (!user?.seller || user.seller.status !== "APPROVED") redirect("/vender");
  const { q = "" } = await searchParams;
  const cards = q
    ? await prisma.card.findMany({
        where: { translations: { some: { name: { contains: q, mode: "insensitive" } } } },
        include: { translations: true, printings: true },
        take: 8,
      })
    : [];
  return (
    <div className="max-w-xl">
      <h1 className="font-serif text-4xl">Anunciar no catálogo</h1>
      <p className="mt-3 text-muted">Escolha a impressão existente. A ficha da carta não é recriada.</p>
      <form className="mt-4 flex gap-2" action="/vendedor/anunciar">
        <input name="q" defaultValue={q} placeholder="Nome da carta" className="w-full border border-line px-2 py-2" />
        <button className="border border-ink px-3">Buscar</button>
      </form>
      <ul className="mt-4 space-y-4">
        {cards.map((card) => (
          <li key={card.id} className="border border-line p-3">
            <p className="font-medium">{preferredTranslation(card.translations, "pt-BR")?.name ?? card.id}</p>
            {card.printings.map((printing) => (
              <ActionForm key={printing.id} action={createListingAction} className="mt-3 grid gap-2 border-t border-line pt-3">
                <input type="hidden" name="printingId" value={printing.id} />
                <p className="font-mono text-xs">{printing.language} · {printing.finish}{printing.stamp ? ` · ${printing.stamp}` : ""}</p>
                <select name="condition" className="border border-line px-2 py-2 text-sm">
                  <option value="NEAR_MINT">Near Mint</option>
                  <option value="LIGHTLY_PLAYED">Lightly Played</option>
                  <option value="MODERATELY_PLAYED">Moderately Played</option>
                  <option value="HEAVILY_PLAYED">Heavily Played</option>
                  <option value="DAMAGED">Damaged</option>
                </select>
                <input name="grader" placeholder="Certificadora, se houver" className="border border-line px-2 py-2 text-sm" />
                <input name="grade" placeholder="Nota" className="border border-line px-2 py-2 text-sm" />
                <input name="certNumber" placeholder="Número do certificado" className="border border-line px-2 py-2 text-sm" />
                <input name="quantity" defaultValue="1" className="border border-line px-2 py-2 text-sm" />
                <input name="price" placeholder="Preço em reais" required className="border border-line px-2 py-2 text-sm" />
                <input name="photoUrl" placeholder="URL da foto real (https)" className="border border-line px-2 py-2 text-sm" />
                <button className="bg-ink px-3 py-2 text-sm text-paper">Publicar</button>
              </ActionForm>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
