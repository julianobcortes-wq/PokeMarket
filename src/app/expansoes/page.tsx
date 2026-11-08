import Link from "next/link";
import { prisma } from "@/server/db";

export default async function ExpansionsPage() {
  const expansions = await prisma.expansion.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { cards: true } } } });
  return (
    <div>
      <h1 className="font-serif text-4xl">Coleções</h1>
      <p className="mt-2 max-w-2xl text-muted">Cada expansão é única no catálogo. O anúncio do vendedor aponta para uma impressão daqui, sem criar outra ficha.</p>
      <ul className="mt-6 divide-y divide-line border border-line">
        {expansions.map((expansion) => (
          <li key={expansion.id}>
            <Link href={`/expansoes/${expansion.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-panel">
              <span>{expansion.name}</span>
              <span className="font-mono text-xs text-muted">{expansion._count.cards} cartas</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
