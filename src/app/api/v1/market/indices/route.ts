import { NextResponse } from "next/server";
import { decideIndexPublication } from "@/domain/indices";
import { prisma } from "@/server/db";

export async function GET() {
  const indices = await prisma.marketIndex.findMany({ include: { methodologies: { where: { active: true }, take: 1 } } });
  const body = indices.map((index) => {
    const methodology = index.methodologies[0];
    const decision = decideIndexPublication({
      constituentsWithCurrentEstimate: 0,
      constituentsWithPriorPeriod: 0,
      minConstituents: methodology?.minConstituents ?? 30,
    });
    return {
      id: index.id,
      name: index.name,
      published: decision.published,
      reason: decision.published ? null : decision.reason,
      methodology: methodology?.summary ?? null,
      points: null,
    };
  });
  return NextResponse.json({ indices: body }, { headers: { "Cache-Control": "private, no-store" } });
}
