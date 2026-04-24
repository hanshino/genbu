"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ROOM_NAMES,
  solveForestMatrix,
  type RoomName,
  type ForestMatrixResult,
} from "@/lib/solvers/forest-matrix";
import { NumberPadPopover } from "./number-pad-popover";
import { InlineAlert } from "./inline-alert";

type Inputs = Record<RoomName, number | null>;

const EMPTY: Inputs = {
  魁: null, 晶: null, 阜: null,
  寶: null, 帝: null, 彤: null,
  牡: null, 蒼: null, 岡: null,
};

const REASON_MESSAGE: Record<
  Exclude<ForestMatrixResult, { ok: true }>["reason"],
  string
> = {
  invalid_sum: "總和必須是 12 或 15",
  invalid_value: "水晶數必須是 1~9 的整數",
  same_room: "兩間房間不能重複",
  center_known: "帝之間由總和自動決定，不能當作關閉的房間",
  redundant_pair: "這兩間互為對稱（通過帝之間的同一條線），無法唯一求解",
  no_valid_solution: "這組輸入無合法解（推算出的格子超出 1~9）",
};

export function ForestMatrixSolver() {
  const [sum, setSum] = useState<12 | 15>(15);
  const [inputs, setInputs] = useState<Inputs>(EMPTY);

  const known = useMemo(
    () =>
      ROOM_NAMES.filter((r) => r !== "帝" && inputs[r] !== null).map((r) => ({
        room: r,
        value: inputs[r] as number,
      })),
    [inputs],
  );

  const centerValue = sum / 3;
  const [result, setResult] = useState<ForestMatrixResult | null>(null);

  function setRoom(r: RoomName, v: number | null) {
    setInputs((prev) => ({ ...prev, [r]: v }));
    setResult(null);
  }

  function onSolve() {
    if (known.length !== 2) return;
    setResult(
      solveForestMatrix({
        sum,
        known: [known[0], known[1]],
      }),
    );
  }

  function onClear() {
    setInputs(EMPTY);
    setResult(null);
  }

  const solved = result?.ok ? result.cells : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">總和</span>
        {[12, 15].map((n) => (
          <Button
            key={n}
            variant={sum === n ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setSum(n as 12 | 15);
              setResult(null);
            }}
          >
            {n}
          </Button>
        ))}
        <span className="text-muted-foreground ml-2 text-sm">
          帝 = {centerValue}
        </span>
      </div>

      <div className="mx-auto grid w-fit grid-cols-3 gap-2">
        {ROOM_NAMES.map((room) => {
          const isCenter = room === "帝";
          const input = inputs[room];
          const solvedValue = solved ? solved[room] : null;
          const display = isCenter
            ? centerValue
            : input !== null
              ? input
              : solvedValue;
          const isDerived = solved !== null && input === null && !isCenter;

          const cellClasses = cn(
            "flex h-20 w-20 flex-col items-center justify-center rounded-md border text-center transition-colors",
            "sm:h-24 sm:w-24",
            isCenter && "bg-muted/60 border-border/60",
            !isCenter && display === null && "bg-card hover:bg-muted/40",
            !isCenter && display !== null && !isDerived && "bg-card",
            isDerived && "bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-200",
          );

          if (isCenter) {
            return (
              <div key={room} className={cellClasses}>
                <span className="text-muted-foreground text-xs">{room}</span>
                <span className="font-heading text-2xl">{centerValue}</span>
              </div>
            );
          }

          const trigger = (
            <button type="button" className={cellClasses}>
              <span className="text-muted-foreground text-xs">{room}</span>
              <span className="font-heading text-2xl">
                {display ?? "—"}
              </span>
            </button>
          );

          return (
            <NumberPadPopover
              key={room}
              value={input}
              trigger={trigger}
              onPick={(v) => setRoom(room, v)}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Button disabled={known.length !== 2} onClick={onSolve}>
          解題
        </Button>
        <Button variant="outline" onClick={onClear}>
          清除
        </Button>
        <span className="text-muted-foreground text-xs">
          已填 {known.length} / 2 間關閉房間
        </span>
      </div>

      {result && !result.ok && <InlineAlert>{REASON_MESSAGE[result.reason]}</InlineAlert>}
    </div>
  );
}
