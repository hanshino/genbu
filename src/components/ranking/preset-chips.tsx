"use client";

import { presets } from "@/lib/scoring";
import { cn } from "@/lib/utils";

const PRIMARY_MIN = 80;
const SECONDARY_MIN = 75;

interface Props {
  percentiles: Record<string, number>;
  activePresetId?: string | null;
}

export function PresetChips({ percentiles, activePresetId }: Props) {
  const ranked = presets
    .map((p) => ({ preset: p, pct: percentiles[p.id] ?? 0 }))
    .sort((a, b) => b.pct - a.pct);

  const chips: typeof ranked = [];
  if (ranked[0] && ranked[0].pct >= PRIMARY_MIN) chips.push(ranked[0]);
  if (chips.length > 0 && ranked[1] && ranked[1].pct >= SECONDARY_MIN) {
    chips.push(ranked[1]);
  }

  if (chips.length === 0) {
    return <span className="text-xs text-muted-foreground">通用</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {chips.map(({ preset, pct }) => {
        const isActive = activePresetId === preset.id;
        return (
          <span
            key={preset.id}
            title={`${preset.label}：分位 ${Math.round(pct)}`}
            className={cn(
              "inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs",
              isActive
                ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                : "bg-muted text-foreground/80 ring-1 ring-border/60"
            )}
          >
            {preset.label.replace("系列", "")}
          </span>
        );
      })}
    </div>
  );
}
