"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { presets } from "@/lib/scoring";
import type { ScoredItem } from "@/lib/scoring";
import { Button } from "@/components/ui/button";
import { useCompareTray } from "@/lib/hooks/use-compare-tray";

export interface RankingRow {
  scored: ScoredItem;
  // Score under every built-in preset, keyed by preset.id
  presetScores: Record<string, number>;
}

type SortKey = "current" | string; // "current" or preset id

interface Props {
  rows: RankingRow[];
  activePresetId: string | null; // null = custom / ad-hoc
  highlightId?: number | null;
  limit?: number;
  onShowAll?: () => void;
  showingAll?: boolean;
}

// Auto-collapse preset columns on narrow viewports; user can override.
function useInitialCompactMode() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
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

  // In compact mode, only show the "current" column and (if a preset is active)
  // that preset's column. Other preset columns are hidden.
  const visiblePresets = compact
    ? presets.filter((p) => p.id === activePresetId)
    : presets;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
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
      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-2 py-1.5 text-left w-10">#</th>
              <th className="px-2 py-1.5 text-left">名稱</th>
              <th className="px-2 py-1.5 text-right w-14">等級</th>
              <th
                className="px-2 py-1.5 text-right w-20 cursor-pointer hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                role="button"
                tabIndex={0}
                onClick={() => setSortKey("current")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSortKey("current");
                  }
                }}
                aria-label="依目前流派排序"
                title="依目前流派排序"
              >
                目前 {sortKey === "current" ? "▼" : ""}
              </th>
              {visiblePresets.map((p) => (
                <th
                  key={p.id}
                  className={
                    "px-2 py-1.5 text-right w-20 cursor-pointer hover:bg-muted focus-visible:bg-muted focus-visible:outline-none " +
                    (activePresetId === p.id ? "bg-primary/5 text-primary" : "")
                  }
                  role="button"
                  tabIndex={0}
                  onClick={() => setSortKey(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSortKey(p.id);
                    }
                  }}
                  aria-label={`依 ${p.label} 分數排序`}
                  title={`依 ${p.label} 分數排序`}
                >
                  {p.label.replace("系列", "")} {sortKey === p.id ? "▼" : ""}
                </th>
              ))}
              <th className="px-2 py-1.5 text-center w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => {
              const { item } = row.scored;
              const isHighlighted = highlightId === item.id;
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
                  <td className="px-2 py-1.5 text-right font-mono">
                    {Math.round(row.scored.score)}
                  </td>
                  {visiblePresets.map((p) => (
                    <td
                      key={p.id}
                      className={
                        "px-2 py-1.5 text-right font-mono " +
                        (activePresetId === p.id ? "bg-primary/5 font-semibold" : "")
                      }
                    >
                      {Math.round(row.presetScores[p.id] ?? 0)}
                    </td>
                  ))}
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
