import { clsx, type ClassValue } from "clsx"
import type { CSSProperties } from "react"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function heatmapCell(
  value: number,
  min: number,
  max: number
): CSSProperties | undefined {
  if (!Number.isFinite(value) || value === 0) return undefined
  const span = max - min
  const pct = span > 0 ? (value - min) / span : 0
  const alpha = 0.05 + pct * 0.3
  return {
    backgroundColor: `color-mix(in oklch, var(--primary) ${(alpha * 100).toFixed(1)}%, transparent)`,
  }
}
