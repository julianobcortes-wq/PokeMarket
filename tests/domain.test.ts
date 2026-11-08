import { describe, expect, it } from "vitest";
import { settleOrder } from "@/domain/commission";
import { isValidCpf, isValidCnpj } from "@/domain/documents";
import { hasEntitlement, resolveEntitlements } from "@/domain/entitlements";
import { historyAccess } from "@/domain/history-window";
import { decideIndexPublication } from "@/domain/indices";
import { sortOffers } from "@/domain/offers";
import { estimateMarket, periodVariation } from "@/domain/price-engine";
import { portfolioBridge } from "@/domain/portfolio";
import { identifyCard } from "@/server/tcgdex";

const now = new Date("2026-11-07T12:00:00.000Z");
const key = { language: "en", finish: "NORMAL", condition: "NEAR_MINT", gradeKey: "raw", marketId: "US" };

function sale(partial: Partial<Parameters<typeof estimateMarket>[0][number]> = {}) {
  return {
    priceMinor: 1000,
    observedAt: "2026-11-01T00:00:00.000Z",
    type: "verified_sale" as const,
    units: 1,
    language: "en",
    finish: "NORMAL",
    condition: "NEAR_MINT",
    gradeKey: "raw",
    marketId: "US",
    canceled: false,
    demo: false,
    buyerIsSeller: false,
    licenseAllowsDisplay: true,
    sourceId: "pokeplace",
    ...partial,
  };
}

describe("histórico e freemium", () => {
  it("libera 90 dias e recusa 1 ano sem assinatura", () => {
    expect(historyAccess("3m", false, now).allowed).toBe(true);
    const denied = historyAccess("1y", false, now);
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) expect(denied.entitlement).toBe("price_history_full");
  });

  it("não calcula variação sem observação no início do período", () => {
    expect(periodVariation([{ at: "2026-11-01", priceMinor: 100 }], 30, now)).toBeNull();
    expect(periodVariation([{ at: "2026-10-01", priceMinor: 100 }, { at: "2026-11-07", priceMinor: 150 }], 30, now)).toBeCloseTo(50);
  });
});

describe("motor de preços", () => {
  it("não promove anúncio nem referência externa a preço estimado", () => {
    const result = estimateMarket(
      [
        sale({ type: "asking", priceMinor: 500 }),
        sale({ type: "asking", priceMinor: 700 }),
        sale({ type: "asking", priceMinor: 900 }),
        sale({ type: "licensed_indicator", priceMinor: 42, sourceId: "scrydex" }),
      ],
      key,
      now,
    );
    expect(result.estimate.status).toBe("asking_only");
    expect(result.external?.label).toBe("external_reference_not_pokeplace_estimate");
    expect(result.estimate.status === "asking_only" && result.estimate.medianAskMinor).not.toBe(42);
  });

  it("separa carta japonesa graduada de carta inglesa crua", () => {
    const sales = [100, 110, 120, 130, 140].map((priceMinor, index) =>
      sale({ priceMinor, observedAt: `2026-11-0${index + 1}T00:00:00.000Z` }),
    );
    sales.push(sale({ language: "ja", gradeKey: "PSA_10", priceMinor: 9_000_000, marketId: "JP" }));
    const result = estimateMarket(sales, key, now);
    expect(result.estimate.status).toBe("estimated");
    if (result.estimate.status === "estimated") expect(result.estimate.priceMinor).toBe(120);
  });

  it("diz que faltam dados quando há poucas vendas", () => {
    const result = estimateMarket([sale(), sale(), sale()], key, now);
    expect(result.estimate.status).toBe("insufficient");
  });

  it("ignora venda cancelada, demonstração e auto-negociação", () => {
    const rows = [1, 2, 3, 4, 5].map((n) => sale({ priceMinor: 100 * n, canceled: n === 1, demo: n === 2, buyerIsSeller: n === 3 }));
    const result = estimateMarket(rows, key, now);
    expect(result.estimate.status).toBe("insufficient");
  });
});

describe("coleção", () => {
  it("não trata compra como valorização", () => {
    const bridge = portfolioBridge(
      [],
      [{ id: "a", quantity: 1, unitCostMinor: 10000, unitValueMinor: 10000 }],
      [{ kind: "buy", costMinor: 10000, proceedsMinor: 0 }],
    );
    expect(bridge.appreciationMinor).toBe(0);
    expect(bridge.capitalInMinor).toBe(10000);
  });

  it("mede a valorização de uma carta que já estava na coleção", () => {
    const bridge = portfolioBridge(
      [{ id: "a", quantity: 1, unitCostMinor: 8000, unitValueMinor: 10000 }],
      [{ id: "a", quantity: 1, unitCostMinor: 8000, unitValueMinor: 13000 }],
      [],
    );
    expect(bridge.appreciationMinor).toBe(3000);
  });

  it("não inventa valor quando falta cotação", () => {
    const bridge = portfolioBridge([], [{ id: "a", quantity: 1, unitCostMinor: 1000, unitValueMinor: null }], []);
    expect(bridge.partial).toBe(true);
    expect(bridge.appreciationMinor).toBeNull();
  });
});

describe("índice, oferta, comissão e direitos", () => {
  it("não publica índice sem base suficiente", () => {
    expect(decideIndexPublication({ constituentsWithCurrentEstimate: 3, constituentsWithPriorPeriod: 0, minConstituents: 30 }).published).toBe(false);
  });

  it("não prioriza a loja da operação", () => {
    const sorted = sortOffers([
      { id: "bella", priceMinor: 200, shippingMinor: 0, handlingDays: 1, completedOrders: 100, isOperationStore: true },
      { id: "outra", priceMinor: 100, shippingMinor: 0, handlingDays: 4, completedOrders: 0, isOperationStore: false },
    ]);
    expect(sorted[0].id).toBe("outra");
  });

  it("separa comissão, frete e GMV", () => {
    const settlement = settleOrder({ itemsMinor: 10_000, shippingMinor: 1_500, rateBps: 1000, paymentFeeMinor: 300 });
    expect(settlement.gmvMinor).toBe(10_000);
    expect(settlement.commissionMinor).toBe(1_000);
    expect(settlement.sellerNetMinor).toBe(10_500);
    expect(settlement.paymentFeeMinor).toBe(300);
    expect(settlement.platformCommissionMinor).not.toBe(settlement.gmvMinor);
  });

  it("une Collector Pro e Seller Pro sem duplicar o histórico", () => {
    const resolved = resolveEntitlements({
      now,
      graceMs: 0,
      sellerApproved: true,
      subscriptions: [
        { id: "1", planId: "collector_pro", status: "ACTIVE", periodEnd: null },
        { id: "2", planId: "seller_pro", status: "ACTIVE", periodEnd: null },
      ],
      grantsByPlan: {
        free: [{ code: "price_history_90d", config: null }],
        collector_pro: [{ code: "price_history_full", config: null }],
        seller_pro: [{ code: "price_history_full", config: null }, { code: "seller_analytics", config: null }],
      },
    });
    expect(hasEntitlement(resolved, "price_history_full")).toBe(true);
    expect(hasEntitlement(resolved, "seller_analytics")).toBe(true);
    expect([...resolved.keys()].filter((code) => code === "price_history_full")).toHaveLength(1);
  });

  it("tira ferramenta de vendedor se a loja não está aprovada", () => {
    const resolved = resolveEntitlements({
      now,
      graceMs: 0,
      sellerApproved: false,
      subscriptions: [{ id: "2", planId: "seller_pro", status: "ACTIVE", periodEnd: null }],
      grantsByPlan: { seller_pro: [{ code: "price_history_full", config: null }, { code: "seller_analytics", config: null }] },
    });
    expect(resolved.has("price_history_full")).toBe(true);
    expect(resolved.has("seller_analytics")).toBe(false);
  });

  it("revoga depois do vencimento", () => {
    const resolved = resolveEntitlements({
      now,
      graceMs: 0,
      sellerApproved: false,
      subscriptions: [{ id: "1", planId: "collector_pro", status: "EXPIRED", periodEnd: new Date("2026-11-01") }],
      grantsByPlan: { collector_pro: [{ code: "price_history_full", config: null }] },
    });
    expect(resolved.has("price_history_full")).toBe(false);
    expect(resolved.has("price_history_90d")).toBe(true);
  });
});

describe("documentos e identificação", () => {
  it("valida CPF e CNPJ", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCnpj("11.444.777/0001-61")).toBe(true);
  });

  it("não inventa carta a partir de uma foto sem provedor", () => {
    expect(identifyCard()).toEqual({ status: "provider_not_configured" });
  });
});
