"use client";

import type { RankingItem } from "@/lib/queries/items";
import type { ItemRand } from "@/lib/types/item";

interface Props {
  type: string;
  items: RankingItem[];
  rands: ItemRand[];
}

export function RankingClient({ type, items, rands }: Props) {
  return (
    <pre className="text-xs text-muted-foreground">
      {type}: {items.length} items, {rands.length} rand rows (UI coming in next task)
    </pre>
  );
}
