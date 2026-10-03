"use client";

import { Fragment } from "react";
import { ScaleIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmt, signed } from "./labels";

export interface ImportCompareRow {
  key: string;
  label: string;
  group: string;
  game: number;
  sim: number | null;
  reason?: string;
}

const num = "text-right font-mono tabular-nums";

export function ImportCompareCard({
  rows,
  onClose,
}: {
  rows: ImportCompareRow[];
  onClose: () => void;
}) {
  // 依第一次出現的順序分組
  const groups = new Map<string, ImportCompareRow[]>();
  for (const r of rows) groups.set(r.group, [...(groups.get(r.group) ?? []), r]);

  return (
    <section
      aria-label="遊戲當時面板 vs 目前模擬"
      className="overflow-hidden rounded-xl bg-card text-sm ring-1 ring-foreground/10"
    >
      <header className="flex items-center gap-2.5 border-b border-border/60 bg-muted/30 py-2.5 pr-2.5 pl-4">
        <ScaleIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <h3 className="font-heading text-sm font-semibold">遊戲當時面板 vs 目前模擬</h3>
        <Button
          size="icon-sm"
          variant="ghost"
          className="ml-auto"
          aria-label="關閉對照卡"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </header>
      <p className="border-b border-border/60 px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        左邊是匯入當下遊戲裡的數字，右邊是模擬器現在算出來的。有差不代表哪邊錯了，多半是藥水、英雄陣法或還沒支援的公式造成的，看看就好。
      </p>

      <Table className="text-[13px]">
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="h-8 px-3 text-[11px] text-muted-foreground">項目</TableHead>
            <TableHead className="h-8 px-3 text-right text-[11px] text-muted-foreground">
              遊戲值
            </TableHead>
            <TableHead className="h-8 px-3 text-right text-[11px] text-muted-foreground">
              模擬值
            </TableHead>
            <TableHead className="h-8 px-3 text-right text-[11px] text-muted-foreground">
              差值
            </TableHead>
            <TableHead className="hidden h-8 px-3 text-[11px] text-muted-foreground sm:table-cell">
              可能原因
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...groups].map(([group, items]) => (
            <Fragment key={group}>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead
                  colSpan={5}
                  scope="colgroup"
                  className="h-7 px-3 font-heading text-[11px] font-normal tracking-[0.1em] text-muted-foreground"
                >
                  {group}
                </TableHead>
              </TableRow>
              {items.map((r) => {
                const delta = r.sim == null ? null : r.game - r.sim;
                const same = delta === 0;
                return (
                  <TableRow
                    key={r.key}
                    data-testid={`compare-row-${r.key}`}
                    data-same={same || undefined}
                    className={cn("border-border/40", same && "text-muted-foreground/70")}
                  >
                    <TableCell className="px-3 py-1.5">{r.label}</TableCell>
                    <TableCell className={cn("px-3 py-1.5", num)}>{fmt(r.game)}</TableCell>
                    <TableCell className={cn("px-3 py-1.5", num)}>
                      {r.sim == null ? (
                        <span className="font-sans text-xs text-muted-foreground">無法計算</span>
                      ) : (
                        fmt(r.sim)
                      )}
                    </TableCell>
                    <TableCell
                      className={cn("px-3 py-1.5", num, delta && "font-medium text-foreground")}
                    >
                      {delta == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : delta === 0 ? (
                        "0"
                      ) : (
                        signed(delta)
                      )}
                    </TableCell>
                    <TableCell className="hidden min-w-40 px-3 py-1.5 text-xs leading-relaxed whitespace-normal text-muted-foreground sm:table-cell">
                      {r.reason}
                    </TableCell>
                  </TableRow>
                );
              })}
            </Fragment>
          ))}
        </TableBody>
      </Table>

      <p className="border-t border-border/60 bg-muted/20 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        差值只是給你參考，不是錯誤。覺得礙眼可以直接把這張卡關掉。
      </p>
    </section>
  );
}
