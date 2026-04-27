import { clsx, type ClassValue } from "clsx";
import type { CSSProperties } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function serializeSearchParams(params: Record<string, string | undefined>): string {
  return new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => {
      const v = entry[1];
      return v != null && v !== "";
    }),
  ).toString();
}

export function heatmapCell(value: number, min: number, max: number): CSSProperties | undefined {
  if (!Number.isFinite(value) || value === 0) return undefined;
  const span = max - min;
  const pct = span > 0 ? (value - min) / span : 0;
  const alpha = 0.05 + pct * 0.3;
  return {
    backgroundColor: `color-mix(in oklch, var(--primary) ${(alpha * 100).toFixed(1)}%, transparent)`,
  };
}

// 小機率時需要更多小數位才看得出差距；極小值顯示「<0.01%」避免變成 0.00%。
export function formatPercent(rate: number, total: number): string {
  if (total <= 0) return "—";
  const pct = (rate / total) * 100;
  if (pct >= 10) return `${pct.toFixed(1)}%`;
  if (pct >= 0.1) return `${pct.toFixed(2)}%`;
  if (pct >= 0.01) return `${pct.toFixed(3)}%`;
  return "<0.01%";
}
