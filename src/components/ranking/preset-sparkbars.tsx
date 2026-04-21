"use client";

import { presets } from "@/lib/scoring";
import { cn } from "@/lib/utils";

interface Props {
  scores: Record<string, number>;
  percentiles: Record<string, number>;
  activePresetId?: string | null;
}

export function PresetSparkbars({ scores, percentiles, activePresetId }: Props) {
  const label = presets
    .map((p) => `${p.label}分位${Math.round(percentiles[p.id] ?? 0)}`)
    .join(" ");

  return (
    <div
      className="flex h-5 items-end gap-[2px]"
      role="img"
      aria-label={`流派分位 ${label}`}
    >
      {presets.map((p) => {
        const pct = Math.max(0, Math.min(100, percentiles[p.id] ?? 0));
        const score = scores[p.id] ?? 0;
        const isActive = activePresetId === p.id;
        return (
          <span
            key={p.id}
            title={`${p.label}：分位 ${Math.round(pct)}（分 ${Math.round(score)}）`}
            className={cn(
              "w-2 rounded-sm",
              isActive ? "bg-primary" : "bg-primary/30"
            )}
            style={{ height: `${20 + pct * 0.8}%` }}
          />
        );
      })}
    </div>
  );
}
