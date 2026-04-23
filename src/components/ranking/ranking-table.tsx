"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckIcon, PlusIcon } from "lucide-react";
import { presets } from "@/lib/scoring";
import type { ScoredItem } from "@/lib/scoring";
import { imageOfItem } from "@/lib/equipment-images";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PresetChips } from "@/components/ranking/preset-chips";
import { useCompareTray } from "@/lib/hooks/use-compare-tray";
import { cn } from "@/lib/utils";

function ItemThumbnail({ itemId }: { itemId: number }) {
  const cover = imageOfItem({ id: itemId });
  if (!cover) {
    return (
      <div className="h-9 w-9 shrink-0 rounded border border-border/30 bg-muted/20" aria-hidden />
    );
  }
  return (
    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded border border-border/50 bg-muted/30">
      {/* eslint-disable-next-line @next/next/no-img-element -- hotlink 直連；走 next/image 會集中到 Vercel optimizer IP，對 tthol.uj.com.tw 反而更易被限流 */}
      <img
        src={cover.src}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-contain"
        aria-hidden
      />
    </div>
  );
}

export interface RankingRow {
  scored: ScoredItem;
  presetScores: Record<string, number>;
  presetPercentiles: Record<string, number>;
  alignedPresets: readonly string[];
  primaryStrengths: Record<string, number>;
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
      <div className="rounded-md border border-border/60 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-10 py-1.5">#</TableHead>
              <TableHead className="py-1.5">名稱</TableHead>
              <TableHead className="w-14 py-1.5 text-right">等級</TableHead>
              <TableHead className="w-20 py-1.5 text-right">
                {sortKey === "current"
                  ? "目前"
                  : (presets.find((p) => p.id === sortKey)?.label.replace("系列", "") ?? "分數")}
              </TableHead>
              {!compact && (
                <TableHead
                  className="w-[132px] py-1.5"
                  title="分位 ≥ 80 為合格，依主屬性在 pool 中的稀有度排序主標（如 str 罕見、atk 常見）。前 2 名稀有度接近視為通用裝。"
                >
                  流派
                </TableHead>
              )}
              <TableHead className="w-20 py-1.5 text-center">加入比較</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row, i) => {
              const { item } = row.scored;
              const isHighlighted = highlightId === item.id;
              const displayScore =
                sortKey === "current" ? row.scored.score : (row.presetScores[sortKey] ?? 0);
              return (
                <TableRow
                  key={item.id}
                  className={cn("group", isHighlighted && "bg-yellow-50 dark:bg-yellow-900/20")}
                >
                  <TableCell className="py-1.5 text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="py-1.5">
                    <Link
                      href={`/items/${item.id}?from=ranking`}
                      className="inline-flex min-h-[44px] items-center gap-2 text-foreground transition-colors hover:text-primary hover:underline focus-visible:underline focus-visible:text-primary focus-visible:outline-none"
                    >
                      <ItemThumbnail itemId={item.id} />
                      <span>{item.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="py-1.5 text-right font-mono">{item.level}</TableCell>
                  <TableCell className="py-1.5 text-right font-mono font-semibold">
                    {Math.round(displayScore)}
                  </TableCell>
                  {!compact && (
                    <TableCell className="py-1.5">
                      <PresetChips
                        percentiles={row.presetPercentiles}
                        primaryStrengths={row.primaryStrengths}
                        alignedPresets={row.alignedPresets}
                        activePresetId={activePresetId ?? (sortKey !== "current" ? sortKey : null)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="py-1.5 text-center">
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
                        variant="outline"
                        onClick={() => tray.add(item.id)}
                        disabled={tray.isFull}
                        aria-label={tray.isFull ? "比較盤已滿" : "加入比較"}
                        title={tray.isFull ? "比較盤已滿（最多 5 件）" : "加入比較"}
                        className="h-7 w-7 text-muted-foreground transition-colors hover:text-foreground group-hover:border-primary/40 group-hover:text-primary disabled:opacity-40"
                      >
                        <PlusIcon className="size-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
