export function formatMoney(amountMinor: number, currency: string, locale = "pt-BR"): string {
  const digits = currency === "JPY" ? 0 : 2;
  const major = amountMinor / (currency === "JPY" ? 1 : 100);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(major);
}

export function parseMajorToMinor(input: string, currency: string): number | null {
  const normalized = input.trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const major = Number(normalized);
  if (!Number.isFinite(major) || major < 0) return null;
  const factor = currency === "JPY" ? 1 : 100;
  return Math.round(major * factor);
}
