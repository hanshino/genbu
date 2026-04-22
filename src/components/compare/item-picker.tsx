"use client";

import { useMemo, useState } from "react";
import type { RankingItem } from "@/lib/queries/items";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

interface Props {
  pool: RankingItem[];
  excludeIds: readonly number[];
  onPick: (item: RankingItem) => void;
  placeholder?: string;
}

export function ItemPicker({
  pool,
  excludeIds,
  onPick,
  placeholder = "搜尋裝備名稱或 ID…",
}: Props) {
  const [q, setQ] = useState("");

  const trimmed = q.trim();
  const matches = useMemo(() => {
    if (trimmed.length === 0) return [];
    const asNum = Number(trimmed);
    const idMatch = Number.isInteger(asNum) ? asNum : null;
    return pool
      .filter(
        (it) => !excludeIds.includes(it.id) && (it.id === idMatch || it.name.includes(trimmed)),
      )
      .slice(0, 10);
  }, [pool, excludeIds, trimmed]);

  return (
    <Combobox
      items={matches}
      filter={null}
      itemToStringLabel={(it: RankingItem) => it.name}
      inputValue={q}
      onInputValueChange={setQ}
      onValueChange={(picked) => {
        if (!picked) return;
        onPick(picked as RankingItem);
        setQ("");
      }}
    >
      <ComboboxInput placeholder={placeholder} aria-label="搜尋裝備" showTrigger={false} />
      <ComboboxContent>
        <ComboboxEmpty>查無符合「{trimmed}」的裝備</ComboboxEmpty>
        <ComboboxList>
          <ComboboxCollection>
            {(it: RankingItem) => (
              <ComboboxItem key={it.id} value={it}>
                <span className="flex-1">{it.name}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  Lv{it.level} · #{it.id}
                </span>
              </ComboboxItem>
            )}
          </ComboboxCollection>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
