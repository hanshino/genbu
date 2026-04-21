"use client";

import { useMemo, useState } from "react";
import type { RankingItem } from "@/lib/queries/items";
import { Input } from "@/components/ui/input";

interface Props {
  pool: RankingItem[];
  excludeIds: readonly number[];
  onPick: (item: RankingItem) => void;
  placeholder?: string;
}

export function ItemPicker({ pool, excludeIds, onPick, placeholder = "搜尋裝備名稱或 ID…" }: Props) {
  const [q, setQ] = useState("");

  const trimmed = q.trim();
  const matches = useMemo(() => {
    if (trimmed.length === 0) return [] as RankingItem[];
    const asNum = Number(trimmed);
    return pool
      .filter((it) => !excludeIds.includes(it.id))
      .filter((it) =>
        (Number.isInteger(asNum) && it.id === asNum) ||
        it.name.includes(trimmed)
      )
      .slice(0, 10);
  }, [pool, excludeIds, trimmed]);

  const showEmpty = trimmed.length > 0 && matches.length === 0;

  return (
    <div className="relative">
      <Input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label="搜尋裝備"
      />
      {matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
          {matches.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onClick={() => {
                  onPick(it);
                  setQ("");
                }}
              >
                <span>{it.name}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  Lv{it.level} · #{it.id}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {showEmpty && (
        <div
          role="status"
          aria-live="polite"
          className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md"
        >
          查無符合「{trimmed}」的裝備
        </div>
      )}
    </div>
  );
}
