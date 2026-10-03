"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TrainingSort } from "@/lib/training-spots";

const SORT_LABELS: Record<TrainingSort, string> = {
  spawns: "怪最多",
  hit: "命中需求低",
  equip: "裝備掉落多",
};

function useParamUpdater() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  return (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) params.delete(key);
    else params.set(key, value);
    // replace：切換顯示條件不堆 history entry。
    startTransition(() => router.replace(`?${params.toString()}`, { scroll: false }));
  };
}

/** ?elite=show 代表「顯示只有菁英符合的地圖」；預設（無參數）隱藏。 */
export function EliteFilterSwitch({ hideEliteOnly }: { hideEliteOnly: boolean }) {
  const update = useParamUpdater();
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm select-none">
      <Switch
        checked={hideEliteOnly}
        onCheckedChange={(checked) => update("elite", checked ? null : "show")}
        className="mt-0.5"
      />
      <span className="flex flex-col">
        隱藏只有菁英怪符合等級的地圖
        <span className="text-xs text-muted-foreground">
          例如整張圖都是低等怪，只有一隻菁英剛好在你的等級範圍
        </span>
      </span>
    </label>
  );
}

export function TrainingSortToggle({ sort }: { sort: TrainingSort }) {
  const update = useParamUpdater();
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      排序
      <ToggleGroup
        aria-label="排序"
        value={[sort]}
        onValueChange={(value) => {
          const next = value[0] as TrainingSort | undefined;
          if (next && next !== sort) update("sort", next === "spawns" ? null : next);
        }}
      >
        {(Object.keys(SORT_LABELS) as TrainingSort[]).map((key) => (
          <ToggleGroupItem key={key} value={key} size="sm">
            {SORT_LABELS[key]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
