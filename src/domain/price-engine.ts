export type ObservationType = "verified_sale" | "licensed_indicator" | "asking";

export type MarketObservation = {
  priceMinor: number;
  observedAt: string;
  type: ObservationType;
  units: number;
  language: string;
  finish: string;
  condition: string;
  gradeKey: string;
  marketId: string;
  canceled: boolean;
  demo: boolean;
  buyerIsSeller: boolean;
  licenseAllowsDisplay: boolean;
  sourceId: string;
};

export type SeriesKey = {
  language: string;
  finish: string;
  condition: string;
  gradeKey: string;
  marketId: string;
};

export type MarketEstimate =
  | {
      status: "estimated";
      priceMinor: number;
      saleCount: number;
      method: string;
      lastSaleMinor: number | null;
      lowMinor: number;
      highMinor: number;
      currencyNote: "original_observations_only";
    }
  | {
      status: "asking_only";
      lowestAskMinor: number;
      medianAskMinor: number;
      askCount: number;
      method: string;
    }
  | {
      status: "insufficient";
      reason: "no_comparable_observations" | "too_few_sales";
      saleCount: number;
      askCount: number;
    };

export type ExternalReference = {
  sourceId: string;
  priceMinor: number;
  observedAt: string;
  label: "external_reference_not_pokeplace_estimate";
};

const MIN_SALES = 5;
const MIN_ASKS = 3;

export function seriesKeyString(key: SeriesKey): string {
  return [key.language, key.finish, key.condition, key.gradeKey, key.marketId].join("|");
}

export function observationKey(observation: MarketObservation): string {
  return seriesKeyString(observation);
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return sorted[mid];
}

function withoutOutliers(values: number[]): number[] {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
  const q3 = sorted[Math.floor((sorted.length - 1) * 0.75)];
  const iqr = q3 - q1;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  const kept = sorted.filter((value) => value >= low && value <= high);
  return kept.length > 0 ? kept : sorted;
}

export function estimateMarket(
  observations: MarketObservation[],
  key: SeriesKey,
  now: Date,
  windowDays = 90,
): { estimate: MarketEstimate; external: ExternalReference | null } {
  const expected = seriesKeyString(key);
  const comparable = observations.filter(
    (observation) =>
      observationKey(observation) === expected &&
      !observation.canceled &&
      !observation.demo &&
      !observation.buyerIsSeller,
  );
  const windowStart = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  const sales = comparable.filter(
    (observation) =>
      observation.type === "verified_sale" && Date.parse(observation.observedAt) >= windowStart,
  );
  const asks = comparable.filter((observation) => observation.type === "asking");
  const licensed = comparable
    .filter(
      (observation) =>
        observation.type === "licensed_indicator" && observation.licenseAllowsDisplay,
    )
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));

  const external: ExternalReference | null = licensed[0]
    ? {
        sourceId: licensed[0].sourceId,
        priceMinor: licensed[0].priceMinor,
        observedAt: licensed[0].observedAt,
        label: "external_reference_not_pokeplace_estimate",
      }
    : null;

  const cleaned = withoutOutliers(sales.map((sale) => sale.priceMinor));
  if (cleaned.length >= MIN_SALES) {
    const sorted = [...cleaned].sort((a, b) => a - b);
    const latest = [...sales].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];
    return {
      estimate: {
        status: "estimated",
        priceMinor: median(sorted),
        saleCount: cleaned.length,
        method: `median_verified_sales_${windowDays}d_iqr`,
        lastSaleMinor: latest?.priceMinor ?? null,
        lowMinor: sorted[0],
        highMinor: sorted[sorted.length - 1],
        currencyNote: "original_observations_only",
      },
      external,
    };
  }

  const askPrices = asks.map((ask) => ask.priceMinor).sort((a, b) => a - b);
  if (askPrices.length >= MIN_ASKS) {
    return {
      estimate: {
        status: "asking_only",
        lowestAskMinor: askPrices[0],
        medianAskMinor: median(askPrices),
        askCount: askPrices.length,
        method: "asking_reference_not_a_transaction",
      },
      external,
    };
  }

  return {
    estimate: {
      status: "insufficient",
      reason: sales.length > 0 ? "too_few_sales" : "no_comparable_observations",
      saleCount: cleaned.length,
      askCount: askPrices.length,
    },
    external,
  };
}

export function percentChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Variation is null when there is no observation at or before the start of the window. */
export function periodVariation(
  points: { at: string; priceMinor: number }[],
  days: number,
  now: Date,
): number | null {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  const baseline = [...sorted].reverse().find((point) => Date.parse(point.at) <= cutoff);
  const current = sorted[sorted.length - 1];
  if (!baseline || Date.parse(current.at) < cutoff) return null;
  return percentChange(current.priceMinor, baseline.priceMinor);
}
