"use client";

import { Button } from "@/components/ui/button";
import { useCompareTray } from "@/lib/hooks/use-compare-tray";

interface Props {
  itemId: number;
}

export function CompareButton({ itemId }: Props) {
  const tray = useCompareTray();
  const inTray = tray.has(itemId);

  return (
    <Button
      variant={inTray ? "secondary" : "outline"}
      size="sm"
      onClick={() => (inTray ? tray.remove(itemId) : tray.add(itemId))}
      disabled={!inTray && tray.isFull}
      title={tray.isFull && !inTray ? "比較盤已滿（最多 5 件）" : undefined}
    >
      {inTray ? "移出比較盤" : "加入比較"}
    </Button>
  );
}
