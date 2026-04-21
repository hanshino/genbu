"use client";

import { itemAttributeNames } from "@/lib/constants/i18n";

const THRESHOLD_KEYS = ["hit", "def", "mdef", "dodge"] as const;
export type ThresholdKey = (typeof THRESHOLD_KEYS)[number];
export type Thresholds = Partial<Record<ThresholdKey, number>>;

interface Props {
  values: Thresholds;
  onChange: (next: Thresholds) => void;
}

export function ThresholdFilters({ values, onChange }: Props) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">硬性門檻</label>
      <p className="text-xs text-muted-foreground">空白代表不限制</p>
      <div className="space-y-1.5">
        {THRESHOLD_KEYS.map((k) => (
          <div key={k} className="grid grid-cols-[4rem_1fr] items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {itemAttributeNames[k]} ≥
            </span>
            <input
              type="number"
              inputMode="numeric"
              value={values[k] ?? ""}
              placeholder="—"
              onChange={(e) => {
                const raw = e.target.value.trim();
                const next = { ...values };
                if (raw === "") delete next[k];
                else next[k] = Number(raw) || 0;
                onChange(next);
              }}
              className="min-h-[44px] rounded-md border border-border bg-background px-2 py-1 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export const thresholdKeys = THRESHOLD_KEYS;
