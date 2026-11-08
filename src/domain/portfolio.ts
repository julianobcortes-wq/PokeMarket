export type Holding = {
  id: string;
  quantity: number;
  unitCostMinor: number;
  unitValueMinor: number | null;
};

export type CapitalFlow = {
  kind: "buy" | "sell";
  costMinor: number;
  proceedsMinor: number;
};

export type PortfolioBridge = {
  marketStartMinor: number | null;
  marketEndMinor: number | null;
  capitalInMinor: number;
  capitalOutMinor: number;
  appreciationMinor: number | null;
  costBasisMinor: number | null;
  unquotedIds: string[];
  partial: boolean;
};

function marketValue(holdings: Holding[]): { value: number; unquoted: string[] } | null {
  const unquoted = holdings.filter((holding) => holding.unitValueMinor == null).map((holding) => holding.id);
  if (unquoted.length > 0) return { value: 0, unquoted };
  const value = holdings.reduce(
    (sum, holding) => sum + holding.quantity * (holding.unitValueMinor ?? 0),
    0,
  );
  return { value, unquoted: [] };
}

/**
 * Appreciation excludes cash used to buy cards and cash received from sales.
 * Adding a card at its current reference value does not count as a gain.
 * Null reference values make the market bridge partial instead of zero.
 */
export function portfolioBridge(start: Holding[], end: Holding[], flows: CapitalFlow[]): PortfolioBridge {
  const startMarket = marketValue(start);
  const endMarket = marketValue(end);
  const capitalInMinor = flows.filter((flow) => flow.kind === "buy").reduce((sum, flow) => sum + flow.costMinor, 0);
  const capitalOutMinor = flows.filter((flow) => flow.kind === "sell").reduce((sum, flow) => sum + flow.proceedsMinor, 0);
  const partial = Boolean(startMarket?.unquoted.length || endMarket?.unquoted.length);
  const unquotedIds = [...(startMarket?.unquoted ?? []), ...(endMarket?.unquoted ?? [])];
  const appreciationMinor =
    partial || !startMarket || !endMarket
      ? null
      : endMarket.value - startMarket.value - capitalInMinor + capitalOutMinor;
  const costBasisMinor = end.every((holding) => holding.quantity === 0 || holding.unitCostMinor >= 0)
    ? end.reduce((sum, holding) => sum + holding.quantity * holding.unitCostMinor, 0)
    : null;
  return {
    marketStartMinor: partial ? null : (startMarket?.value ?? null),
    marketEndMinor: partial ? null : (endMarket?.value ?? null),
    capitalInMinor,
    capitalOutMinor,
    appreciationMinor,
    costBasisMinor,
    unquotedIds,
    partial,
  };
}
