export function formatMoney(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)} 億`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)} 萬`;
  return n.toLocaleString();
}

export function formatRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return "";
  if (min === max) return `${min}`;
  return `${min}~${max}`;
}

/** prob 以百萬分制（1,000,000 = 100%）。 */
export function formatProb(probMillionths: number): string {
  const pct = (probMillionths / 1_000_000) * 100;
  if (pct < 0.1) return `${pct.toFixed(2)}%`;
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(0)}%`;
}

export function formatProbRange(min: number, max: number): string {
  if (min === max) return formatProb(max);
  return `${formatProb(min)}~${formatProb(max)}`;
}

export function formatBonusRange(min: number, max: number): string {
  if (min === max) return `+${max}`;
  return `+${min}~+${max}`;
}
