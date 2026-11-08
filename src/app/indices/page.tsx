import { cookies } from "next/headers";
import { isLocale, t } from "@/i18n";
import { prisma } from "@/server/db";

export default async function IndicesPage() {
  const jar = await cookies();
  const locale = isLocale(jar.get("pp_locale")?.value) ? jar.get("pp_locale")!.value : "pt-BR";
  const indices = await prisma.marketIndex.findMany({ include: { methodologies: { where: { active: true } } }, orderBy: { name: "asc" } });
  return (
    <div>
      <h1 className="font-serif text-4xl">{t(locale, "indices.title")}</h1>
      <p className="mt-3 max-w-2xl text-muted">{t(locale, "indices.unpublished")}</p>
      <ul className="mt-6 space-y-3">
        {indices.map((index) => (
          <li key={index.id} className="border border-line p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-2xl">{index.name}</h2>
              <span className="font-mono text-xs text-muted">sem nível</span>
            </div>
            <p className="mt-2 text-sm text-muted">{index.methodologies[0]?.summary}</p>
            <p className="mt-2 font-mono text-[11px] text-muted">Mínimo de componentes: {index.methodologies[0]?.minConstituents ?? "—"}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
