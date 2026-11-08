import { NextRequest, NextResponse } from "next/server";
import { decideIndexPublication } from "@/domain/indices";
import { prisma } from "@/server/db";
import { consumeRateLimit, withRateLimit } from "@/server/http-limit";

export async function GET(request: NextRequest) {
  const limit = consumeRateLimit(request, "indices", 60);
  if (!limit.ok) return withRateLimit(NextResponse.json({ error: { code: "RATE_LIMIT" } }, { status: 429 }), limit.token);
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
  return withRateLimit(NextResponse.json({ indices: body }, { headers: { "Cache-Control": "private, no-store" } }), limit.token);
}
