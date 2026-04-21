"use client";

import { presets } from "@/lib/scoring";
import { cn } from "@/lib/utils";

interface Props {
  scores: Record<string, number>;
  activePresetId?: string | null;
}

export function PresetSparkbars({ scores, activePresetId }: Props) {
  const values = presets.map((p) => scores[p.id] ?? 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const span = max - min;

  const label = presets
    .map((p, i) => `${p.label}${Math.round(values[i])}`)
    .join(" ");

  return (
    <div
      className="flex h-5 items-end gap-[2px]"
      role="img"
      aria-label={`流派剪影 ${label}`}
    >
      {presets.map((p, i) => {
        const v = values[i];
        const pct = span > 0 ? (v - min) / span : 0.5;
        const isActive = activePresetId === p.id;
        return (
          <span
            key={p.id}
            title={`${p.label}: ${Math.round(v)}`}
            className={cn(
              "w-2 rounded-sm transition-colors motion-reduce:transition-none",
              isActive ? "bg-primary" : "bg-primary/30"
            )}
            style={{ height: `${20 + pct * 80}%` }}
          />
        );
      })}
    </div>
  );
}
