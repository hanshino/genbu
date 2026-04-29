"use client";

import { startTransition, useCallback, useMemo, useRef, useState } from "react";
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
  PRESET_PRIMARY_STATS,
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
import { Input } from "@/components/ui/input";
import { track } from "@/lib/analytics/track";
import {
  Dialog,
  DialogCloseButton,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  return Object.entries(w)
    .map(([k, v]) => `${k}:${v}`)
    .join(",");
}

function resolveInitialSelection(
  urlWeights: Weights | null,
  initialPresetId: string,
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
  const initialWeights =
    urlWeights ?? getPresetById(initialPresetId)?.weights ?? presets[0].weights;

  const [weights, setWeights] = useState<Weights>(initialWeights);
  const [selection, setSelection] = useState<PresetSelection>(
    resolveInitialSelection(urlWeights, initialPresetId),
  );

  const levelRange = useMemo(() => {
    const all = items.map((i) => i.level);
    return {
      absoluteMin: Math.min(...all),
      absoluteMax: Math.max(...all),
    };
  }, [items]);

  const [minLv, setMinLv] = useState<number>(Number(search.get("minLv")) || 60);
  const [maxLv, setMaxLv] = useState<number>(Number(search.get("maxLv")) || 140);

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
  const { presets: customPresets, save: saveCustom, remove: removeCustom } = useCustomPresets();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

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
    [router, search],
  );

  const handlePresetChange = (next: PresetSelection) => {
    setSelection(next);
    track("ranking_change", {
      control: "preset",
      value: next.kind === "builtin" ? next.id : next.kind,
    });
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

  // Preset scores + percentiles depend only on (items, randsByItem) — hoist
  // them out of the weights-sensitive memo so slider drags don't rescore the
  // universe. Percentile is computed per preset against the full type pool
  // (ignores level/threshold filters) so a gear's "position in its universe"
  // stays stable when filters narrow the visible rows.
  const {
    presetScoresByItem,
    presetPercentilesByItem,
    alignedPresetsByItem,
    primaryStrengthByItem,
  } = useMemo(() => {
    const scoresByItem = new Map<number, Record<string, number>>();
    const alignedByItem = new Map<number, string[]>();
    // Effective stat values (base + expected random) per item, used both for
    // alignment checks and for rarity percentiles below.
    const effectiveStatsByItem = new Map<number, Record<string, number>>();
    for (const it of items) {
      const expected = expectedRandom(randsByItem.get(it.id) ?? []);
      const scores: Record<string, number> = {};
      const aligned: string[] = [];
      const record = it as unknown as Record<string, unknown>;
      const effective: Record<string, number> = {};
      for (const p of presets) {
        scores[p.id] = scoreWithShared(it, expected, p.weights);
        const primaries = PRESET_PRIMARY_STATS.get(p.id) ?? [];
        for (const stat of primaries) {
          if (effective[stat] !== undefined) continue;
          const base = record[stat];
          const baseN = typeof base === "number" ? base : 0;
          effective[stat] = baseN + (expected[stat] ?? 0);
        }
        // All primary-weight stats (max-weight stats, possibly tied) must be
        // nonzero. Presets with multiple tied primaries (e.g. 爆刀 agi+str)
        // need both; otherwise an item that has just one half is mislabeled.
        const hit = primaries.length > 0 && primaries.every((stat) => (effective[stat] ?? 0) > 0);
        if (hit) aligned.push(p.id);
      }
      scoresByItem.set(it.id, scores);
      alignedByItem.set(it.id, aligned);
      effectiveStatsByItem.set(it.id, effective);
    }

    const percentilesByItem = new Map<number, Record<string, number>>();
    for (const it of items) percentilesByItem.set(it.id, {});
    const n = items.length;
    for (const p of presets) {
      if (n === 0) continue;
      const sorted = items
        .map((it) => ({
          id: it.id,
          score: scoresByItem.get(it.id)?.[p.id] ?? 0,
        }))
        .sort((a, b) => a.score - b.score);
      // Assign tied scores the same percentile (max-rank of the tie group).
      let i = 0;
      while (i < n) {
        let j = i;
        while (j < n && sorted[j].score === sorted[i].score) j++;
        const pct = (j / n) * 100;
        for (let k = i; k < j; k++) {
          percentilesByItem.get(sorted[k].id)![p.id] = pct;
        }
        i = j;
      }
    }

    // Per-stat rarity percentile across the full pool, for every stat that
    // appears as any preset's primary. This is the key signal for chip
    // identity: a stat most of the pool lacks (e.g. str on 座騎) is a
    // distinctive "specialist" signal when present, while a stat every item
    // has (atk) carries less information. Ties → max-rank tie percentile.
    const relevantStats = new Set<string>();
    for (const primaries of PRESET_PRIMARY_STATS.values()) {
      for (const s of primaries) relevantStats.add(s);
    }
    const statPercentilesByItem = new Map<number, Record<string, number>>();
    for (const it of items) statPercentilesByItem.set(it.id, {});
    for (const stat of relevantStats) {
      if (n === 0) continue;
      const sorted = items
        .map((it) => ({
          id: it.id,
          val: effectiveStatsByItem.get(it.id)?.[stat] ?? 0,
        }))
        .sort((a, b) => a.val - b.val);
      let i = 0;
      while (i < n) {
        let j = i;
        while (j < n && sorted[j].val === sorted[i].val) j++;
        const pct = (j / n) * 100;
        for (let k = i; k < j; k++) {
          statPercentilesByItem.get(sorted[k].id)![stat] = pct;
        }
        i = j;
      }
    }

    // Per (item, preset): strength = the MIN rarity percentile across the
    // preset's primary stats. The weakest primary caps the specialist signal
    // — e.g. a 爆刀 item with great agi but weak str is not a strong 爆刀
    // fit. For single-primary presets this degenerates to that stat's pct.
    const strengthByItem = new Map<number, Record<string, number>>();
    for (const it of items) {
      const statPcts = statPercentilesByItem.get(it.id) ?? {};
      const strengths: Record<string, number> = {};
      for (const p of presets) {
        const primaries = PRESET_PRIMARY_STATS.get(p.id) ?? [];
        if (primaries.length === 0) {
          strengths[p.id] = 0;
          continue;
        }
        let min = Infinity;
        for (const s of primaries) {
          const pct = statPcts[s] ?? 0;
          if (pct < min) min = pct;
        }
        strengths[p.id] = min === Infinity ? 0 : min;
      }
      strengthByItem.set(it.id, strengths);
    }

    return {
      presetScoresByItem: scoresByItem,
      presetPercentilesByItem: percentilesByItem,
      alignedPresetsByItem: alignedByItem,
      primaryStrengthByItem: strengthByItem,
    };
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
        presetPercentiles: presetPercentilesByItem.get(it.id) ?? {},
        alignedPresets: alignedPresetsByItem.get(it.id) ?? [],
        primaryStrengths: primaryStrengthByItem.get(it.id) ?? {},
      }))
      .filter((r) => r.scored.score !== 0);
  }, [
    items,
    randsByItem,
    presetScoresByItem,
    presetPercentilesByItem,
    alignedPresetsByItem,
    primaryStrengthByItem,
    weights,
    minLv,
    maxLv,
    thresholds,
  ]);

  const activePresetId = selection.kind === "builtin" ? selection.id : null;

  const onConfirmSave = () => {
    const name = presetName.trim();
    if (!name) return;
    saveCustom({ name, type, weights });
    setPresetName("");
    setSaveDialogOpen(false);
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
              onClick={() => {
                if (t !== type) track("ranking_change", { control: "type", value: t });
                pushUrl({ type: t });
              }}
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
          onDeleteCustomPreset={removeCustom}
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
        <Dialog
          open={saveDialogOpen}
          onOpenChange={(open) => {
            setSaveDialogOpen(open);
            if (!open) setPresetName("");
          }}
        >
          <DialogTrigger
            render={
              <Button variant="outline" size="sm" className="w-full">
                儲存為我的配方
              </Button>
            }
          />
          <DialogPopup>
            <DialogCloseButton />
            <DialogHeader>
              <DialogTitle>儲存配方</DialogTitle>
              <DialogDescription>為目前的權重設定命名，儲存到「我的配方」。</DialogDescription>
            </DialogHeader>
            <Input
              ref={nameInputRef}
              placeholder="輸入配方名稱"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onConfirmSave();
              }}
              autoFocus
            />
            <DialogFooter>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSaveDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                size="sm"
                disabled={!presetName.trim()}
                onClick={onConfirmSave}
              >
                儲存
              </Button>
            </DialogFooter>
          </DialogPopup>
        </Dialog>
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
