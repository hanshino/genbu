"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon, XIcon } from "lucide-react";
import type { Item, ItemRand } from "@/lib/types/item";
import type { RankingItem } from "@/lib/queries/items";
import { groupRandsByItemId, computePoolMaxValues } from "@/lib/scoring";
import { COMPARE_TRAY_MAX } from "@/lib/constants/compare";
import { PHASE2_TYPES, type Phase2Type } from "@/lib/constants/item-types";
import { ItemPicker } from "@/components/compare/item-picker";
import { CompareMatrix } from "@/components/compare/compare-matrix";
import { ComparePresets } from "@/components/compare/compare-presets";
import { CompareRadar } from "@/components/compare/compare-radar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  activeType: Phase2Type;
  initialItems: Item[];
  initialRands: ItemRand[];
  initialIds: number[];
  pool: RankingItem[];
}

export function CompareClient({ activeType, initialItems, initialRands, initialIds, pool }: Props) {
  const router = useRouter();
  const search = useSearchParams();

  const randsByItem = useMemo(() => groupRandsByItemId(initialRands), [initialRands]);
  const maxValues = useMemo(() => computePoolMaxValues(pool), [pool]);

  const updateIds = useCallback(
    (ids: number[]) => {
      const params = new URLSearchParams(search.toString());
      if (ids.length === 0) params.delete("ids");
      else params.set("ids", ids.join(","));
      router.replace(`/compare?${params.toString()}`, { scroll: false });
    },
    [router, search],
  );

  const handlePick = (picked: RankingItem) => {
    if (initialIds.includes(picked.id)) return;
    if (initialIds.length >= COMPARE_TRAY_MAX) return;
    updateIds([...initialIds, picked.id]);
  };

  const handleRemove = (id: number) => {
    updateIds(initialIds.filter((x) => x !== id));
  };

  const handleClear = () => updateIds([]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {PHASE2_TYPES.map((t) => {
          const locked = initialIds.length > 0 && t !== activeType;
          return (
            <Button
              key={t}
              variant={t === activeType ? "default" : "outline"}
              size="sm"
              onClick={() => router.replace(`/compare?type=${encodeURIComponent(t)}`)}
              disabled={locked}
              title={locked ? "清空比較盤後才能切換類型" : undefined}
            >
              {t}
            </Button>
          );
        })}
        <div className="flex-1 min-w-[12rem]">
          <ItemPicker
            pool={pool}
            excludeIds={initialIds}
            onPick={handlePick}
            placeholder={
              initialIds.length >= COMPARE_TRAY_MAX
                ? `已達 ${COMPARE_TRAY_MAX} 件上限`
                : "搜尋裝備名稱或 ID…"
            }
          />
        </div>
        {initialIds.length > 0 && (
          <Button size="sm" variant="ghost" onClick={handleClear}>
            清空
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {initialItems.map((it) => (
          <Badge
            key={it.id}
            variant="secondary"
            className="h-7 gap-1 rounded-full py-0 pl-3 pr-1 text-sm font-normal"
          >
            {it.name}
            <button
              type="button"
              aria-label={`移除 ${it.name}`}
              onClick={() => handleRemove(it.id)}
              className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <XIcon className="size-3" aria-hidden />
            </button>
          </Badge>
        ))}
        {initialItems.length === 0 && (
          <span className="text-sm text-muted-foreground">
            尚未加入裝備。用上方搜尋框加入 1~{COMPARE_TRAY_MAX} 件。
          </span>
        )}
      </div>

      {initialItems.length > 0 && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-lg font-semibold">流派適配</h2>
            <span className="text-xs text-muted-foreground">
              條形＝該列相對強度；<span className="text-primary/80">+N%</span>{" "}
              ＝勝者領先第二名的幅度
            </span>
          </div>
          <ComparePresets items={initialItems} randsByItem={randsByItem} />
        </section>
      )}

      {initialItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">屬性雷達</h2>
          <div className="rounded-md border border-border/60 bg-card p-3">
            <CompareRadar items={initialItems} maxValues={maxValues} />
          </div>
          <p className="text-xs text-muted-foreground">
            數值為相對同類型裝備池最大值的百分比；精確數字見下方屬性細項。
          </p>
        </section>
      )}

      {initialItems.length > 0 && (
        <section>
          <details className="group rounded-md border border-border/60 bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-foreground/90 hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
              <span>屬性細項（完整數值）</span>
              <ChevronDownIcon
                className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="border-t border-border/40 [&>div]:rounded-none [&>div]:border-0">
              <CompareMatrix items={initialItems} />
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
