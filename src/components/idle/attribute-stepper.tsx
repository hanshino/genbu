"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** 手機版的一列屬性：名稱、目前值（＋草稿增量）、說明，右側 44px 的減／加鈕。遊戲視窗縮到手機上按不到，改用這個。 */
export function AttributeStepper({
  name,
  value,
  delta = 0,
  hint,
  canAdd,
  canRemove,
  onAdd,
  onRemove,
}: {
  name: string;
  value: number;
  delta?: number;
  hint?: ReactNode;
  canAdd: boolean;
  canRemove: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-2 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-medium">{name}</span>
          <span className="font-mono text-base tabular-nums">{value}</span>
          {delta > 0 && (
            <span className="font-mono text-sm font-semibold tabular-nums">+{delta}</span>
          )}
        </div>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </div>
      <Button
        variant="outline"
        size="icon"
        className="size-11"
        disabled={!canRemove}
        onClick={onRemove}
        aria-label={`${name}減 1 點`}
      >
        <MinusIcon />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="size-11"
        disabled={!canAdd}
        onClick={onAdd}
        aria-label={`${name}加 1 點`}
      >
        <PlusIcon />
      </Button>
    </li>
  );
}
