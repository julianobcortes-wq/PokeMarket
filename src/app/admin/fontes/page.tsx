import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function SourcesPage() {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") redirect("/");
  const [sources, jobs] = await Promise.all([
    prisma.dataSource.findMany(),
    prisma.ingestionJob.findMany({ orderBy: { startedAt: "desc" }, take: 8 }),
  ]);
  return (
    <div>
      <h1 className="font-serif text-4xl">Fontes</h1>
      <ul className="mt-4 space-y-3">
        {sources.map((source) => (
          <li key={source.id} className="border border-line p-3 text-sm">
            <p className="font-medium">{source.name} · {source.enabled ? "ligada" : "desligada"}</p>
            <p className="text-muted">{source.licenseNote}</p>
          </li>
        ))}
      </ul>
      <h2 className="mt-8 font-serif text-2xl">Ingestões</h2>
      <ul className="mt-2 text-sm">
        {jobs.map((job) => (
          <li key={job.id}>{job.status} · {job.connectorVersion} · {JSON.stringify(job.stats)}</li>
        ))}
      </ul>
    </div>
  );
}
