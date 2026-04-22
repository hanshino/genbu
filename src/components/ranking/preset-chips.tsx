"use client";

import { presets } from "@/lib/scoring";
import { cn } from "@/lib/utils";

const PRIMARY_MIN = 80;
const SECONDARY_MIN = 75;
// Top-3 within this range → no single flavour, call it 通用.
const GENERALIST_GAP = 5;

interface Props {
  percentiles: Record<string, number>;
  activePresetId?: string | null;
}

export function PresetChips({ percentiles, activePresetId }: Props) {
  const ranked = presets
    .map((p) => ({ preset: p, pct: percentiles[p.id] ?? 0 }))
    .sort((a, b) => b.pct - a.pct);

  const top = ranked[0];
  if (!top || top.pct < PRIMARY_MIN) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  // Three+ presets essentially tied at the top = broad-spectrum gear; a
  // single 通用 tag is more honest than cherry-picking whichever two
  // happened to win by noise.
  const third = ranked[2];
  if (third && top.pct - third.pct < GENERALIST_GAP) {
    const breakdown = ranked
      .filter((r) => r.pct >= PRIMARY_MIN)
      .map((r) => `${r.preset.label.replace("系列", "")} ${Math.round(r.pct)}`)
      .join("、");
    return (
      <span
        title={`跨流派強勢：${breakdown}`}
        className="inline-flex items-center rounded-sm bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900 ring-1 ring-amber-300/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/60"
      >
        通用
      </span>
    );
  }

  const chips: typeof ranked = [top];
  if (ranked[1] && ranked[1].pct >= SECONDARY_MIN) chips.push(ranked[1]);

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
