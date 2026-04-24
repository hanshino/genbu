"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatPercent } from "@/lib/utils";
import type { MonsterDropItem } from "@/lib/types/monster";

interface MonsterDropTableProps {
  drops: MonsterDropItem[];
  totalWeight: number;
}

type Mode = "percent" | "raw";

export function MonsterDropTable({ drops, totalWeight }: MonsterDropTableProps) {
  const [mode, setMode] = useState<Mode>("percent");

  if (drops.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-card px-6 py-12 text-center text-muted-foreground">
        無掉落資料
      </div>
    );
  }

  const visibleWeight = drops.reduce((s, d) => s + d.rate, 0);
  const emptyWeight = Math.max(0, totalWeight - visibleWeight);
  const emptyPercent = formatPercent(emptyWeight, totalWeight);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-card px-4 py-2">
          <span className="text-sm font-medium">掉落物 · 共 {drops.length} 項</span>
          <div className="inline-flex rounded-md border border-border/60 p-0.5 text-xs">
            <ModeButton active={mode === "percent"} onClick={() => setMode("percent")}>
              百分比
            </ModeButton>
            <ModeButton active={mode === "raw"} onClick={() => setMode("raw")}>
              原始數值
            </ModeButton>
          </div>
        </div>
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[90px]">編號</TableHead>
              <TableHead>名稱</TableHead>
              <TableHead className="w-[120px]">類型</TableHead>
              <TableHead className="w-[70px] text-right">等級</TableHead>
              <TableHead className="w-[110px] text-right">
                {mode === "percent" ? "掉落機率" : "掉落率"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drops.map((d) => (
              <TableRow key={d.itemId}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {d.itemId}
                </TableCell>
                <TableCell>
                  {d.name ? (
                    <Link href={`/items/${d.itemId}`} className="font-medium hover:underline">
                      {d.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">（道具資料缺失）</span>
                  )}
                </TableCell>
                <TableCell>
                  {d.type ? (
                    <Badge variant="secondary" className="font-normal">
                      {d.type}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {d.level != null ? d.level : "—"}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {mode === "percent" ? formatPercent(d.rate, totalWeight) : d.rate.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {mode === "percent"
          ? emptyWeight > 0
            ? `每次擊殺的獨立機率；另有 ${emptyPercent} 機率不掉落任何物品`
            : "每次擊殺的獨立機率"
          : "掉落率為遊戲原始數值，數值越高機率越大"}
      </p>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-6 rounded px-2 text-xs font-normal",
        active
          ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </Button>
  );
}
