import { NextRequest, NextResponse } from "next/server";
import { isHistoryRange } from "@/domain/history-window";
import { accessFor } from "@/server/access";
import { readSession } from "@/server/auth";

export async function GET(request: NextRequest) {
  const range = request.nextUrl.searchParams.get("range") ?? "7d";
  if (!isHistoryRange(range)) return NextResponse.json({ error: { code: "RANGE" } }, { status: 400 });
  const session = await readSession();
  const access = await accessFor(session?.id ?? null);
  const premium = !["7d", "30d", "3m"].includes(range);
  if (premium && !access.has("rankings_full")) {
    return NextResponse.json(
      {
        error: {
          code: "ENTITLEMENT_REQUIRED",
          entitlement: "rankings_full",
          message: "Rankings de períodos longos fazem parte do Collector Pro.",
          cta: { label: "Ver planos", href: "/planos?origem=rankings" },
        },
        gainers: [],
        losers: [],
      },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return NextResponse.json(
    {
      range,
      gainers: [],
      losers: [],
      mostTraded: [],
      note: "Ainda não há pares de vendas verificadas para calcular variação. A lista fica vazia de propósito.",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
