"use client";

import Link from "next/link";
import { useState } from "react";
import { ItemIcon } from "@/components/common/item-icon";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DropCategory, TrainingDrop } from "@/lib/training-spots";

/** 每個分類預設顯示的圖示數；其餘收成 +N。 */
const ICON_LIMIT = 9;

const CATEGORIES: ReadonlyArray<{ key: DropCategory; label: string; tone: string; dot: string }> = [
  { key: "equip", label: "裝備", tone: "border-chart-4/60 bg-chart-4/10", dot: "bg-chart-4" },
  { key: "pet", label: "娃娃", tone: "border-chart-5/50 bg-chart-5/10", dot: "bg-chart-5" },
  { key: "stone", label: "魂石", tone: "border-chart-3/50 bg-chart-3/10", dot: "bg-chart-3" },
  { key: "rare", label: "珍稀", tone: "border-chart-2/60 bg-chart-2/10", dot: "bg-chart-2" },
];

function formatDropPercent(percent: number): string {
  if (percent >= 1) return `${Math.round(percent)}%`;
  if (percent >= 0.01) return `${percent.toFixed(2).replace(/0$/, "")}%`;
  return "<0.01%";
}

function DropIcon({ drop, tone }: { drop: TrainingDrop; tone: string }) {
  const rate = formatDropPercent(drop.percent);
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={80}
        aria-label={`${drop.name} ${rate}`}
        className={cn(
          "relative grid size-9 place-items-center rounded-md border outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          tone,
        )}
      >
        <ItemIcon image={drop.icon} alt="" className="size-7 border-0 bg-transparent" />
        <span className="absolute -right-1 -bottom-1.5 rounded-sm border border-border/60 bg-card px-0.5 font-mono text-[0.55rem] leading-tight text-muted-foreground">
          {rate}
        </span>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-auto max-w-64 gap-1 text-xs">
        <Link href={`/items/${drop.itemId}`} className="font-medium hover:underline">
          {drop.name}
          {drop.level != null && drop.level > 0 && (
            <span className="ml-1 font-mono text-muted-foreground">Lv{drop.level}</span>
          )}
        </Link>
        <span className="flex flex-wrap items-center gap-1 text-muted-foreground">
          <span className="font-mono">{rate} / 隻</span>·
          {drop.sourceElite && (
            <Badge variant="outline" className="h-4 border-chart-4/60 px-1 text-[0.6rem] text-chart-4">
              菁英
            </Badge>
          )}
          {drop.sourceName}
        </span>
      </PopoverContent>
    </Popover>
  );
}

export function TrainingDropList({ drops }: { drops: TrainingDrop[] }) {
  const [expanded, setExpanded] = useState(false);
  const material = drops.filter((d) => d.category === "material").length;
  const potion = drops.filter((d) => d.category === "potion").length;

  return (
    <div className="flex flex-col gap-2.5">
      {CATEGORIES.map(({ key, label, tone, dot }) => {
        const list = drops.filter((d) => d.category === key);
        if (list.length === 0) return null;
        const shown = expanded ? list : list.slice(0, ICON_LIMIT);
        const rest = list.length - shown.length;
        return (
          <div key={key} className="grid grid-cols-[4rem_1fr] items-start gap-2">
            <span className="flex items-center gap-1.5 pt-2 text-xs font-medium whitespace-nowrap">
              <span aria-hidden className={cn("size-2 rounded-[2px]", dot)} />
              {label}
              <span className="font-mono text-[0.65rem] font-normal text-muted-foreground">
                {list.length}
              </span>
            </span>
            <div className="flex min-w-0 flex-wrap gap-x-1.5 gap-y-2.5">
              {shown.map((d) => (
                <DropIcon key={d.itemId} drop={d} tone={tone} />
              ))}
              {rest > 0 && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="h-9 rounded-md border border-dashed border-border px-2 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  +{rest}
                </button>
              )}
            </div>
          </div>
        );
      })}
      <div className="grid grid-cols-[4rem_1fr] items-center gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <span aria-hidden className="size-2 rounded-[2px] bg-muted-foreground" />
          素材
        </span>
        <span>
          一般素材 {material} 種、藥品 {potion} 種
        </span>
      </div>
    </div>
  );
}
