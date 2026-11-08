import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function ApplicationsPage() {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") redirect("/");
  const rows = await prisma.sellerApplication.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <div>
      <h1 className="font-serif text-4xl">Inscrições</h1>
      <ul className="mt-4 divide-y divide-line border border-line">
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={`/admin/inscricoes/${row.id}`} className="flex justify-between px-3 py-3 text-sm">
              <span>{row.legalName} · {row.city}/{row.state}</span>
              <span className="font-mono text-xs">{row.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
