"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { RankingItem } from "@/lib/queries/items";
import type { ItemRand } from "@/lib/types/item";
import {
  scoreItem,
  presets,
  getPresetById,
  type Weights,
} from "@/lib/scoring";
import { useCustomPresets } from "@/lib/hooks/use-custom-presets";
import { PresetSelector, type PresetSelection } from "@/components/ranking/preset-selector";
import { WeightEditor } from "@/components/ranking/weight-editor";
import { LevelRange } from "@/components/ranking/level-range";
import { ThresholdFilters, thresholdKeys, type Thresholds } from "@/components/ranking/threshold-filters";
import { RankingTable, type RankingRow } from "@/components/ranking/ranking-table";
import { Button } from "@/components/ui/button";

interface Props {
  type: "座騎" | "背飾";
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

export function RankingClient({ type, items, rands }: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // --- URL → initial state ---------------------------------------------------
  const urlWeights = parseWeights(search.get("weights"));
  const initialPresetId = search.get("preset") ?? "pure-str";
  const initialWeights = urlWeights
    ?? getPresetById(initialPresetId)?.weights
    ?? presets[0].weights;

  const [weights, setWeights] = useState<Weights>(initialWeights);
  const [selection, setSelection] = useState<PresetSelection>(
    urlWeights
      ? { kind: "ad-hoc" }
      : getPresetById(initialPresetId)
        ? { kind: "builtin", id: initialPresetId }
        : { kind: "ad-hoc" }
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

  // --- Sync state → URL ------------------------------------------------------
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
    // Any manual edit drops us into ad-hoc unless the new weights match the current builtin.
    setSelection({ kind: "ad-hoc" });
    pushUrl({ preset: null, weights: serializeWeights(next) });
  };

  // --- Scoring ---------------------------------------------------------------
  const randsByItem = useMemo(() => {
    const map = new Map<number, ItemRand[]>();
    for (const r of rands) {
      const key = Number(r.id);
      const arr = map.get(key);
      if (arr) arr.push(r);
      else map.set(key, [r]);
    }
    return map;
  }, [rands]);

  const rows = useMemo<RankingRow[]>(() => {
    return items
      .filter((it) => it.level >= minLv && it.level <= maxLv)
      .filter((it) => {
        const rec = it as unknown as Record<string, number>;
        for (const [k, v] of Object.entries(thresholds)) {
          if (v !== undefined && (rec[k] ?? 0) < v) return false;
        }
        return true;
      })
      .map((it) => {
        const its = it as unknown as import("@/lib/types/item").Item;
        const rs = randsByItem.get(it.id) ?? [];
        const scored = scoreItem(its, rs, weights);
        const presetScores: Record<string, number> = {};
        for (const p of presets) {
          presetScores[p.id] = scoreItem(its, rs, p.weights).score;
        }
        return { scored, presetScores };
      })
      .filter((r) => r.scored.score !== 0);
  }, [items, randsByItem, weights, minLv, maxLv, thresholds]);

  const activePresetId = selection.kind === "builtin" ? selection.id : null;

  // --- Save as custom --------------------------------------------------------
  const onSaveCustom = () => {
    const name = window.prompt("為這組權重命名：");
    if (!name) return;
    saveCustom({ name, type, weights });
  };

  return (
    <div
      className={
        "grid gap-6 md:grid-cols-[18rem_1fr] transition-opacity motion-reduce:transition-none " +
        (isPending ? "opacity-60" : "")
      }
    >
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
