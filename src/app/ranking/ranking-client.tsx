"use client";

import { startTransition, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { RankingItem } from "@/lib/queries/items";
import type { ItemRand } from "@/lib/types/item";
import {
  scoreItem,
  presets,
  getPresetById,
  groupRandsByItemId,
  expectedRandom,
  scoreWithShared,
  type Weights,
} from "@/lib/scoring";
import type { Phase2Type } from "@/lib/constants/item-types";
import { useCustomPresets } from "@/lib/hooks/use-custom-presets";
import { PresetSelector, type PresetSelection } from "@/components/ranking/preset-selector";
import { WeightEditor } from "@/components/ranking/weight-editor";
import { LevelRange } from "@/components/ranking/level-range";
import { ThresholdFilters } from "@/components/ranking/threshold-filters";
import { THRESHOLD_KEYS as thresholdKeys, type Thresholds } from "@/lib/constants/ranking";
import { RankingTable, type RankingRow } from "@/components/ranking/ranking-table";
import { Button } from "@/components/ui/button";

interface Props {
  type: Phase2Type;
  items: RankingItem[];
  rands: ItemRand[];
}

// Parse `weights` query param formatted as `key:val,key:val`
function parseWeights(raw: string | null): Weights | null {
  if (!raw) return null;
  const out: Weights = {};
  for (const pair of raw.split(",")) {
    const [k, v] = pair.split(":");
    if (!k) continue;
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function serializeWeights(w: Weights): string {
  return Object.entries(w).map(([k, v]) => `${k}:${v}`).join(",");
}

function resolveInitialSelection(
  urlWeights: Weights | null,
  initialPresetId: string
): PresetSelection {
  if (urlWeights) return { kind: "ad-hoc" };
  if (getPresetById(initialPresetId)) return { kind: "builtin", id: initialPresetId };
  return { kind: "ad-hoc" };
}

export function RankingClient({ type, items, rands }: Props) {
  const router = useRouter();
  const search = useSearchParams();

  const urlWeights = parseWeights(search.get("weights"));
  const initialPresetId = search.get("preset") ?? "pure-str";
  const initialWeights = urlWeights
    ?? getPresetById(initialPresetId)?.weights
    ?? presets[0].weights;

  const [weights, setWeights] = useState<Weights>(initialWeights);
  const [selection, setSelection] = useState<PresetSelection>(
    resolveInitialSelection(urlWeights, initialPresetId)
  );

  const levelRange = useMemo(() => {
    const all = items.map((i) => i.level);
    return {
      absoluteMin: Math.min(...all),
      absoluteMax: Math.max(...all),
    };
  }, [items]);

  const [minLv, setMinLv] = useState<number>(
    Number(search.get("minLv")) || 50
  );
  const [maxLv, setMaxLv] = useState<number>(
    Number(search.get("maxLv")) || 100
  );

  const [thresholds, setThresholds] = useState<Thresholds>(() => {
    const out: Thresholds = {};
    for (const k of thresholdKeys) {
      const v = search.get(`${k}Min`);
      if (v !== null && v !== "") out[k] = Number(v);
    }
    return out;
  });

  const [showAll, setShowAll] = useState(search.get("showAll") === "1");
  const highlightId = Number(search.get("highlight")) || null;
  const { presets: customPresets, save: saveCustom } = useCustomPresets();

  const pushUrl = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(search.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      startTransition(() => {
        router.replace(`/ranking?${params.toString()}`, { scroll: false });
      });
    },
    [router, search]
  );

  const handlePresetChange = (next: PresetSelection) => {
    setSelection(next);
    if (next.kind === "builtin") {
      const p = getPresetById(next.id);
      if (p) {
        setWeights(p.weights);
        pushUrl({ preset: next.id, weights: null });
      }
    } else if (next.kind === "custom") {
      const c = customPresets.find((x) => x.id === next.id);
      if (c) {
        setWeights(c.weights);
        pushUrl({ preset: null, weights: serializeWeights(c.weights) });
      }
    } else {
      pushUrl({ preset: null, weights: serializeWeights(weights) });
    }
  };

  const handleWeightsChange = (next: Weights) => {
    setWeights(next);
    setSelection({ kind: "ad-hoc" });
    pushUrl({ preset: null, weights: serializeWeights(next) });
  };

  const randsByItem = useMemo(() => groupRandsByItemId(rands), [rands]);

  // Preset scores depend only on (items, randsByItem) — hoist them out of the
  // weights-sensitive memo so slider drags don't rescore the universe.
  const presetScoresByItem = useMemo(() => {
    const map = new Map<number, Record<string, number>>();
    for (const it of items) {
      const expected = expectedRandom(randsByItem.get(it.id) ?? []);
      const scores: Record<string, number> = {};
      for (const p of presets) {
        scores[p.id] = scoreWithShared(it, expected, p.weights);
      }
      map.set(it.id, scores);
    }
    return map;
  }, [items, randsByItem]);

  const rows = useMemo<RankingRow[]>(() => {
    return items
      .filter((it) => it.level >= minLv && it.level <= maxLv)
      .filter((it) => {
        for (const k of thresholdKeys) {
          const min = thresholds[k];
          if (min !== undefined && (it[k] ?? 0) < min) return false;
        }
        return true;
      })
      .map((it) => ({
        scored: scoreItem(it, randsByItem.get(it.id) ?? [], weights),
        presetScores: presetScoresByItem.get(it.id) ?? {},
      }))
      .filter((r) => r.scored.score !== 0);
  }, [items, randsByItem, presetScoresByItem, weights, minLv, maxLv, thresholds]);

  const activePresetId = selection.kind === "builtin" ? selection.id : null;

  const onSaveCustom = () => {
    const name = window.prompt("為這組權重命名：");
    if (!name) return;
    saveCustom({ name, type, weights });
  };

  return (
    <div className="grid gap-6 md:grid-cols-[18rem_1fr]">
      <aside className="space-y-5 md:sticky md:top-16 md:self-start">
        {/* Type tabs */}
        <div className="flex gap-1">
          {(["座騎", "背飾"] as const).map((t) => (
            <Button
              key={t}
              variant={t === type ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => pushUrl({ type: t })}
            >
              {t}
            </Button>
          ))}
        </div>
        <LevelRange
          min={minLv}
          max={maxLv}
          absoluteMin={levelRange.absoluteMin}
          absoluteMax={levelRange.absoluteMax}
          onChange={({ min, max }) => {
            setMinLv(min);
            setMaxLv(max);
            pushUrl({ minLv: String(min), maxLv: String(max) });
          }}
        />
        <PresetSelector
          value={selection}
          onChange={handlePresetChange}
          customPresets={customPresets}
        />
        <WeightEditor weights={weights} onChange={handleWeightsChange} />
        <ThresholdFilters
          values={thresholds}
          onChange={(next) => {
            setThresholds(next);
            const patch: Record<string, string | null> = {};
            for (const k of thresholdKeys) {
              patch[`${k}Min`] = next[k] !== undefined ? String(next[k]) : null;
            }
            pushUrl(patch);
          }}
        />
        <Button variant="outline" size="sm" className="w-full" onClick={onSaveCustom}>
          儲存為我的配方
        </Button>
      </aside>
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {rows.length} 件符合條件
        </div>
        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
            沒有符合條件的裝備。試試放寬等級區間或移除門檻。
          </div>
        ) : (
          <RankingTable
            rows={rows}
            activePresetId={activePresetId}
            highlightId={highlightId}
            showingAll={showAll}
            onShowAll={() => {
              setShowAll(true);
              pushUrl({ showAll: "1" });
            }}
          />
        )}
      </div>
    </div>
  );
}
