"use client";

import type { Item, ItemRand } from "@/lib/types/item";

interface Props {
  initialItems: Item[];
  initialRands: ItemRand[];
  initialIds: number[];
}

export function CompareClient({ initialItems, initialRands, initialIds }: Props) {
  return (
    <pre className="text-xs text-muted-foreground">
      ids={initialIds.join(",")} items={initialItems.length} rands={initialRands.length}
    </pre>
  );
}
