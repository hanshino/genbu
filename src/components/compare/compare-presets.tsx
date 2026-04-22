"use client";

import type { Item, ItemRand } from "@/lib/types/item";
import { presets, expectedRandom, scoreWithShared } from "@/lib/scoring";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Props {
  items: Item[];
  randsByItem: Map<number, ItemRand[]>;
}

export function ComparePresets({ items, randsByItem }: Props) {
  if (items.length === 0) return null;

  const expectedByItem = items.map((it) => expectedRandom(randsByItem.get(it.id) ?? []));
  const rows = presets.map((p) => ({
    preset: p,
    scores: items.map((it, i) => scoreWithShared(it, expectedByItem[i], p.weights)),
  }));

  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[6rem]">流派</TableHead>
            {items.map((it) => (
              <TableHead key={it.id}>{it.name}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const max = Math.max(...r.scores, 0);
            const winnerIdx = max > 0 ? r.scores.indexOf(max) : -1;
            const sortedDesc = [...r.scores].sort((a, b) => b - a);
            const second = sortedDesc[1] ?? 0;
            const marginPct =
              winnerIdx >= 0 && second > 0
                ? ((max - second) / second) * 100
                : null;

            return (
              <TableRow key={r.preset.id}>
                <TableCell className="text-muted-foreground">
                  {r.preset.label}
                </TableCell>
                {r.scores.map((s, i) => {
                  const isWinner = i === winnerIdx;
                  const widthPct = max > 0 ? (s / max) * 100 : 0;
                  return (
                    <TableCell key={items[i].id}>
                      <div className="flex items-center gap-2">
                        <div className="relative h-1.5 flex-1 min-w-[3rem] overflow-hidden rounded-full bg-muted/40">
                          <div
                            className={cn(
                              "h-full transition-all",
                              isWinner ? "bg-primary" : "bg-primary/25"
                            )}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <span
                          className={cn(
                            "min-w-[3.25rem] text-right font-mono tabular-nums",
                            isWinner
                              ? "font-semibold text-primary"
                              : "text-foreground/70"
                          )}
                        >
                          {Math.round(s)}
                        </span>
                        {isWinner && marginPct !== null && marginPct >= 0.5 ? (
                          <span
                            className="min-w-[2.75rem] text-right text-[11px] font-medium text-primary/80 tabular-nums"
                            title={`領先第二名 ${marginPct.toFixed(1)}%`}
                          >
                            +{Math.round(marginPct)}%
                          </span>
                        ) : (
                          <span className="min-w-[2.75rem]" aria-hidden />
                        )}
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
