export const HISTORY_RANGES = ["7d", "30d", "3m", "6m", "1y", "3y", "5y", "max"] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** "3 meses" is an operational window of 90 rolling days from the query instant. */
const RANGE_DAYS: Record<Exclude<HistoryRange, "max">, number> = {
  "7d": 7,
  "30d": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
  "3y": 1095,
  "5y": 1825,
};

export const FREE_RANGES: ReadonlySet<HistoryRange> = new Set(["7d", "30d", "3m"]);

export function isHistoryRange(value: string): value is HistoryRange {
  return (HISTORY_RANGES as readonly string[]).includes(value);
}

export function historyAccess(
  range: HistoryRange,
  hasFullHistory: boolean,
  now: Date,
):
  | { allowed: true; from: Date | null; to: Date; entitlement: "price_history_90d" | "price_history_full" }
  | { allowed: false; entitlement: "price_history_full" } {
  const premium = !FREE_RANGES.has(range);
  if (premium && !hasFullHistory) {
    return { allowed: false, entitlement: "price_history_full" };
  }
  if (range === "max") {
    return { allowed: true, from: null, to: now, entitlement: "price_history_full" };
  }
  const from = new Date(now.getTime() - RANGE_DAYS[range] * DAY_MS);
  return {
    allowed: true,
    from,
    to: now,
    entitlement: premium ? "price_history_full" : "price_history_90d",
  };
}
