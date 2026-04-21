"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Item, ItemRand } from "@/lib/types/item";
import type { RankingItem } from "@/lib/queries/items";
import { ItemPicker } from "@/components/compare/item-picker";
import { CompareMatrix } from "@/components/compare/compare-matrix";
import { ComparePresets } from "@/components/compare/compare-presets";
import { CompareRadar } from "@/components/compare/compare-radar";
import { StatBarChart } from "@/components/items/stat-bar-chart";
import { Button } from "@/components/ui/button";

const MAX_ITEMS = 5;

interface Props {
  activeType: "座騎" | "背飾";
  initialItems: Item[];
  initialRands: ItemRand[];
  initialIds: number[];
  pool: RankingItem[];
}

export function CompareClient({ activeType, initialItems, initialRands, initialIds, pool }: Props) {
  const router = useRouter();
  const search = useSearchParams();

  const randsByItem = useMemo(() => {
    const map = new Map<number, ItemRand[]>();
    for (const r of initialRands) {
      const key = Number(r.id);
      const arr = map.get(key);
      if (arr) arr.push(r);
      else map.set(key, [r]);
    }
    return map;
  }, [initialRands]);

  const maxValues = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of pool) {
      for (const [k, v] of Object.entries(it)) {
        if (typeof v === "number") m[k] = Math.max(m[k] ?? 0, v);
      }
    }
    return m;
  }, [pool]);

  const updateIds = useCallback(
    (ids: number[]) => {
      const params = new URLSearchParams(search.toString());
      if (ids.length === 0) params.delete("ids");
      else params.set("ids", ids.join(","));
      router.replace(`/compare?${params.toString()}`, { scroll: false });
    },
    [router, search]
  );

  const handlePick = (picked: RankingItem) => {
    if (initialIds.includes(picked.id)) return;
    if (initialIds.length >= MAX_ITEMS) return;
    updateIds([...initialIds, picked.id]);
  };

  const handleRemove = (id: number) => {
    updateIds(initialIds.filter((x) => x !== id));
  };

  const handleClear = () => updateIds([]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {(["座騎", "背飾"] as const).map((t) => (
          <Button
            key={t}
            variant={t === activeType ? "default" : "outline"}
            size="sm"
            onClick={() =>
              router.replace(`/compare?type=${encodeURIComponent(t)}`)
            }
            disabled={initialIds.length > 0 && t !== activeType}
            title={
              initialIds.length > 0 && t !== activeType
                ? "清空比較盤後才能切換類型"
                : undefined
            }
          >
            {t}
          </Button>
        ))}
        <div className="flex-1 min-w-[12rem]">
          <ItemPicker
            pool={pool}
            excludeIds={initialIds}
            onPick={handlePick}
            placeholder={
              initialIds.length >= MAX_ITEMS
                ? `已達 ${MAX_ITEMS} 件上限`
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

      <div className="flex flex-wrap gap-2">
        {initialItems.map((it) => (
          <span
            key={it.id}
            className="inline-flex items-center gap-1 rounded-full border border-border pl-3 pr-1 py-1 text-sm"
          >
            {it.name}
            <button
              type="button"
              aria-label={`移除 ${it.name}`}
              onClick={() => handleRemove(it.id)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ×
            </button>
          </span>
        ))}
        {initialItems.length === 0 && (
          <span className="text-sm text-muted-foreground">
            尚未加入裝備。用上方搜尋框加入 1~{MAX_ITEMS} 件。
          </span>
        )}
      </div>

      {initialItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">屬性雷達</h2>
          <div className="rounded-md border border-border/60 bg-card p-3">
            <CompareRadar items={initialItems} maxValues={maxValues} />
          </div>
          <p className="text-xs text-muted-foreground">
            數值為相對同類型裝備池最大值的百分比；精確數字見下方屬性矩陣。
          </p>
        </section>
      )}

      {initialItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">屬性矩陣</h2>
          <CompareMatrix items={initialItems} />
        </section>
      )}

      {initialItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7 流派分數</h2>
          <ComparePresets items={initialItems} randsByItem={randsByItem} />
        </section>
      )}

      {initialItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">屬性形狀</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {initialItems.map((it) => (
              <div key={it.id} className="rounded-md border border-border/60 p-3">
                <div className="mb-2 text-sm font-medium">{it.name}</div>
                <StatBarChart
                  values={it as unknown as Record<string, number>}
                  maxValues={maxValues}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
