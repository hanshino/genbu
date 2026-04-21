"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckIcon, PlusIcon } from "lucide-react";
import { presets } from "@/lib/scoring";
import type { ScoredItem } from "@/lib/scoring";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PresetChips } from "@/components/ranking/preset-chips";
import { useCompareTray } from "@/lib/hooks/use-compare-tray";

export interface RankingRow {
  scored: ScoredItem;
  presetScores: Record<string, number>;
  presetPercentiles: Record<string, number>;
}

type SortKey = "current" | string;

interface Props {
  rows: RankingRow[];
  activePresetId: string | null;
  highlightId?: number | null;
  limit?: number;
  onShowAll?: () => void;
  showingAll?: boolean;
}

function useInitialCompactMode() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional SSR-safe hydration of matchMedia default
    setCompact(mq.matches);
  }, []);
  return [compact, setCompact] as const;
}

export function RankingTable({
  rows,
  activePresetId,
  highlightId,
  limit = 30,
  onShowAll,
  showingAll,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("current");
  const [compact, setCompact] = useInitialCompactMode();
  const tray = useCompareTray();

  const sorted = useMemo(() => {
    const compareFn = (a: RankingRow, b: RankingRow) =>
      sortKey === "current"
        ? b.scored.score - a.scored.score
        : (b.presetScores[sortKey] ?? 0) - (a.presetScores[sortKey] ?? 0);
    return [...rows].sort(compareFn);
  }, [rows, sortKey]);

  const shown = showingAll ? sorted : sorted.slice(0, limit);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span id="rank-sort-label">排序：</span>
          <Select
            value={sortKey}
            onValueChange={(v) => {
              if (v) setSortKey(v);
            }}
          >
            <SelectTrigger size="sm" aria-labelledby="rank-sort-label">
              <SelectValue>
                {(val) => {
                  if (val === "current") return "目前流派";
                  if (typeof val !== "string") return null;
                  return presets.find((p) => p.id === val)?.label ?? val;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">目前流派</SelectItem>
              {presets.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span>顯示：</span>
          <Button
            size="sm"
            variant={compact ? "default" : "outline"}
            onClick={() => setCompact(true)}
          >
            簡潔
          </Button>
          <Button
            size="sm"
            variant={compact ? "outline" : "default"}
            onClick={() => setCompact(false)}
          >
            完整
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="w-10 px-2 py-1.5 text-left">#</th>
              <th className="px-2 py-1.5 text-left">名稱</th>
              <th className="w-14 px-2 py-1.5 text-right">等級</th>
              <th className="w-20 px-2 py-1.5 text-right">
                {sortKey === "current"
                  ? "目前"
                  : presets.find((p) => p.id === sortKey)?.label.replace("系列", "") ?? "分數"}
              </th>
              {!compact && (
                <th
                  className="w-[132px] px-2 py-1.5 text-left"
                  title="在該流派池內分位 ≥ 80 才上主標籤；副標籤需 ≥ 75"
                >
                  流派
                </th>
              )}
              <th className="w-32 px-2 py-1.5 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => {
              const { item } = row.scored;
              const isHighlighted = highlightId === item.id;
              const displayScore =
                sortKey === "current"
                  ? row.scored.score
                  : row.presetScores[sortKey] ?? 0;
              return (
                <tr
                  key={item.id}
                  className={
                    "group border-t border-border/40 hover:bg-muted/40 " +
                    (isHighlighted ? "bg-yellow-50 dark:bg-yellow-900/20" : "")
                  }
                >
                  <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <Link
                      href={`/items/${item.id}`}
                      className="inline-flex min-h-[44px] items-center text-foreground transition-colors hover:text-primary hover:underline focus-visible:underline focus-visible:text-primary focus-visible:outline-none"
                    >
                      {item.name}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">{item.level}</td>
                  <td className="px-2 py-1.5 text-right font-mono font-semibold">
                    {Math.round(displayScore)}
                  </td>
                  {!compact && (
                    <td className="px-2 py-1.5">
                      <PresetChips
                        percentiles={row.presetPercentiles}
                        activePresetId={activePresetId ?? (sortKey !== "current" ? sortKey : null)}
                      />
                    </td>
                  )}
                  <td className="px-2 py-1.5 text-center">
                    {tray.has(item.id) ? (
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => tray.remove(item.id)}
                        aria-label="移出比較盤"
                        title="移出比較盤"
                        className="h-7 w-7"
                      >
                        <CheckIcon className="size-3.5" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => tray.add(item.id)}
                        disabled={tray.isFull}
                        aria-label={tray.isFull ? "比較盤已滿" : "加入比較"}
                        title={tray.isFull ? "比較盤已滿（最多 5 件）" : "加入比較"}
                        className="h-7 w-7 opacity-100 transition-opacity focus-visible:opacity-100 disabled:opacity-40 md:opacity-0 md:group-hover:opacity-100 motion-reduce:transition-none"
                      >
                        <PlusIcon className="size-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!showingAll && sorted.length > limit && onShowAll && (
          <div className="p-2 text-center">
            <Button variant="ghost" size="sm" onClick={onShowAll}>
              顯示全部（{sorted.length} 件）
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
