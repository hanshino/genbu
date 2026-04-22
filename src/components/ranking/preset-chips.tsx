"use client";

import { presets } from "@/lib/scoring";
import { cn } from "@/lib/utils";

const PRIMARY_MIN = 80;
const SECONDARY_MIN = 75;
// Top-2 primary strengths within this ratio → broad-spectrum, label 通用.
// Tuned so 醫毒 99 vs 手甲 89 (ratio 0.90) still shows dual chip; only near-
// identical strengths (e.g. str 93.6 vs pow 94.6, ratio 0.99) roll up to 通用.
const GENERALIST_STRENGTH_RATIO = 0.95;
// Secondary chip only if its primary strength is close enough to the top's.
const SECONDARY_STRENGTH_RATIO = 0.8;
// Minimum primary-stat pool-rarity percentile to count as a real specialist.
// Below this, the item's primary stat is too common to distinguish it from a
// generic piece — fall back to 通用 rather than claim a flavour.
const SPECIALIST_MIN = 85;

interface Props {
  percentiles: Record<string, number>;
  // Pool-rarity percentile of the item's value in the preset's primary-weight
  // stat. A preset whose primary is rare in the pool (e.g. str on 座騎) and
  // present on this item scores high; a preset whose primary is common and
  // middling on this item scores low. This is what distinguishes a genuine
  // 純外 specialist from a generic high-atk piece that would also score well
  // on 手甲.
  primaryStrengths: Record<string, number>;
  alignedPresets: readonly string[];
  activePresetId?: string | null;
}

export function PresetChips({
  percentiles,
  primaryStrengths,
  alignedPresets,
  activePresetId,
}: Props) {
  const alignedSet = new Set(alignedPresets);
  const qualified = presets
    .filter((p) => alignedSet.has(p.id))
    .map((p) => ({
      preset: p,
      pct: percentiles[p.id] ?? 0,
      strength: primaryStrengths[p.id] ?? 0,
    }))
    .filter((r) => r.pct >= PRIMARY_MIN)
    // Sort by rarity-weighted strength. Tiebreak by score percentile so that
    // presets sharing the same primary (e.g. 純玄 & 玄內 both on wis) yield
    // the one the item actually ranks higher in.
    .sort((a, b) => b.strength - a.strength || b.pct - a.pct);

  if (qualified.length === 0) {
    // No primary-aligned preset hit the ≥80 gate. If the item still ranks
    // strongly on any preset (via secondary overlap), label it 通用 — it's
    // broad-spectrum with no single flavour owner.
    const broadStrong = presets.some((p) => (percentiles[p.id] ?? 0) >= PRIMARY_MIN);
    if (!broadStrong) {
      return <span className="text-xs text-muted-foreground">—</span>;
    }
    return (
      <span
        title="未對齊任何流派主屬性，但跨流派分位高：屬於沒有單一流派歸屬的通用裝"
        className="inline-flex items-center rounded-sm bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900 ring-1 ring-amber-300/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/60"
      >
        通用
      </span>
    );
  }

  const top = qualified[0];
  const second = qualified[1];

  // Primary stat not rare enough in the pool → not a real specialist. E.g.
  // item with only atk (common) passes 手甲 primary alignment but atk=150 is
  // middle-of-pack rarity — labeling such items 手甲 inflates that flavour.
  if (top.strength < SPECIALIST_MIN) {
    return (
      <span
        title={`主屬性稀有度不足（${top.preset.label.replace("系列", "")} 主屬分位 ${top.strength.toFixed(0)}），歸為無明確流派`}
        className="inline-flex items-center rounded-sm bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900 ring-1 ring-amber-300/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/60"
      >
        通用
      </span>
    );
  }

  // Multiple aligned presets with near-identical primary strength → genuinely
  // straddles multiple flavours; label 通用 rather than pick a fake winner.
  if (second && second.strength / (top.strength || 1) >= GENERALIST_STRENGTH_RATIO) {
    const breakdown = qualified
      .slice(0, 3)
      .map((r) => `${r.preset.label.replace("系列", "")} ${r.strength.toFixed(0)}`)
      .join("、");
    return (
      <span
        title={`多流派主屬性皆強勢：${breakdown}（分位）`}
        className="inline-flex items-center rounded-sm bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900 ring-1 ring-amber-300/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/60"
      >
        通用
      </span>
    );
  }

  const chips: typeof qualified = [top];
  if (
    second &&
    second.pct >= SECONDARY_MIN &&
    second.strength / (top.strength || 1) >= SECONDARY_STRENGTH_RATIO
  ) {
    chips.push(second);
  }

  return (
    <div className="flex flex-wrap gap-1">
      {chips.map(({ preset, pct, strength }) => {
        const isActive = activePresetId === preset.id;
        return (
          <span
            key={preset.id}
            title={`${preset.label}：主屬分位 ${strength.toFixed(0)}、公式分位 ${Math.round(pct)}`}
            className={cn(
              "inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs",
              isActive
                ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                : "bg-muted text-foreground/80 ring-1 ring-border/60",
            )}
          >
            {preset.label.replace("系列", "")}
          </span>
        );
      })}
    </div>
  );
}
