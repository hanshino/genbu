"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { presets } from "@/lib/scoring";
import type { ScoredItem } from "@/lib/scoring";
import { Button } from "@/components/ui/button";
import { PresetSparkbars } from "@/components/ranking/preset-sparkbars";
import { useCompareTray } from "@/lib/hooks/use-compare-tray";

export interface RankingRow {
  scored: ScoredItem;
  presetScores: Record<string, number>;
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
          <label htmlFor="rank-sort">排序：</label>
          <select
            id="rank-sort"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="min-h-[36px] rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="current">目前流派</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
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
                <th className="w-[108px] px-2 py-1.5 text-left">流派剪影</th>
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
                    "border-t border-border/40 hover:bg-muted/20 " +
                    (isHighlighted ? "bg-yellow-50 dark:bg-yellow-900/20" : "")
                  }
                >
                  <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <Link
                      href={`/items/${item.id}`}
                      className="inline-flex min-h-[44px] items-center hover:underline focus-visible:underline focus-visible:outline-none"
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
                      <PresetSparkbars
                        scores={row.presetScores}
                        activePresetId={activePresetId ?? (sortKey !== "current" ? sortKey : null)}
                      />
                    </td>
                  )}
                  <td className="px-2 py-1.5 text-center">
                    <Button
                      size="sm"
                      variant={tray.has(item.id) ? "secondary" : "outline"}
                      onClick={() =>
                        tray.has(item.id) ? tray.remove(item.id) : tray.add(item.id)
                      }
                      disabled={!tray.has(item.id) && tray.isFull}
                      className="min-h-[44px]"
                    >
                      {tray.has(item.id) ? "已在比較" : "加入比較"}
                    </Button>
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
