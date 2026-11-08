import { CardCondition } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { isHistoryRange } from "@/domain/history-window";
import { rateLimit } from "@/server/access";
import { readSession } from "@/server/auth";
import { EntitlementDenied, loadPriceHistory } from "@/server/pricing";

const CONDITIONS = new Set<string>(["NEAR_MINT", "LIGHTLY_PLAYED", "MODERATELY_PLAYED", "HEAVILY_PLAYED", "DAMAGED"]);

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`history:${ip}`, 120)) {
    return NextResponse.json({ error: { code: "RATE_LIMIT" } }, { status: 429 });
  }
  const range = request.nextUrl.searchParams.get("range") ?? "3m";
  if (!isHistoryRange(range)) return NextResponse.json({ error: { code: "RANGE" } }, { status: 400 });
  const conditionValue = request.nextUrl.searchParams.get("condition") ?? "NEAR_MINT";
  if (!CONDITIONS.has(conditionValue)) return NextResponse.json({ error: { code: "CONDITION" } }, { status: 400 });
  const session = await readSession();
  try {
    const history = await loadPriceHistory({
      userId: session?.id ?? null,
      printingId: id,
      condition: conditionValue as CardCondition,
      gradeKey: request.nextUrl.searchParams.get("gradeKey") ?? "raw",
      marketId: request.nextUrl.searchParams.get("market") ?? "BR",
      range,
    });
    if (!history) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    return NextResponse.json(history, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof EntitlementDenied) {
      return NextResponse.json(
        {
          error: {
            code: "ENTITLEMENT_REQUIRED",
            entitlement: "price_history_full",
            message:
              "Veja como esta carta evoluiu desde seu lançamento. Tenha acesso ao histórico completo e às análises avançadas com o Collector Pro.",
            cta: { label: "Desbloquear histórico completo", href: "/planos?origem=grafico" },
          },
        },
        { status: 403, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    throw error;
  }
}
