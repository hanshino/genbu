"use client";

import { useId, useState } from "react";
import { Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  solveSevenStar,
  sevenStarToNumber,
  type SevenStarState,
} from "@/lib/solvers/seven-star";
import { InlineAlert } from "./inline-alert";

// Big Dipper (北斗七星) layout — oriented to match the in-game view (bowl at
// bottom-left, handle extending up-right). Positions are percentages of a
// square container. Stars 1-4 form the bowl (勺); 4→5→6→7 trace the handle (柄).
const STAR_POSITIONS: ReadonlyArray<{ x: number; y: number; name: string }> = [
  { x: 55, y: 88, name: "天樞" },
  { x: 15, y: 88, name: "天璇" },
  { x: 15, y: 55, name: "天璣" },
  { x: 55, y: 55, name: "天權" },
  { x: 68, y: 40, name: "玉衡" },
  { x: 80, y: 25, name: "開陽" },
  { x: 90, y: 12, name: "搖光" },
];

function isValid(n: number) {
  return Number.isInteger(n) && n >= 1 && n <= 127;
}

export function SevenStarSolver() {
  const inputId = useId();
  const [states, setStates] = useState<SevenStarState>(() => solveSevenStar(1));
  const [raw, setRaw] = useState("1");

  const parsed = Number(raw);
  const rawInvalid = raw.trim() !== "" && !isValid(parsed);

  function handleNumberChange(v: string) {
    setRaw(v);
    const parsedV = Number(v);
    if (isValid(parsedV)) setStates(solveSevenStar(parsedV));
  }

  function toggleStar(i: number) {
    const next = states.map((s, idx) => (idx === i ? !s : s)) as unknown as SevenStarState;
    setStates(next);
    setRaw(String(sevenStarToNumber(next)));
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor={inputId} className="text-sm font-medium">
          輸入數字（1~127）
        </label>
        <Input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={1}
          max={127}
          value={raw}
          onChange={(e) => handleNumberChange(e.target.value)}
          className="max-w-xs"
        />
        {rawInvalid && <InlineAlert>數字須介於 1~127 且為整數</InlineAlert>}
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[480px] rounded-lg border border-border/50 bg-muted/20">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <polyline
            points="55,55 68,40 80,25 90,12"
            className="stroke-border fill-none"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <polygon
            points="55,88 15,88 15,55 55,55"
            className="stroke-border fill-none"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {STAR_POSITIONS.map((pos, i) => {
          const on = states[i];
          return (
            <button
              key={i}
              type="button"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onClick={() => toggleStar(i)}
              aria-label={`星 ${i + 1} ${pos.name} ${on ? "開" : "關"}`}
              aria-pressed={on}
              className={cn(
                "absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center",
                "rounded-full border bg-background/90 backdrop-blur-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "cursor-pointer",
                on ? "border-amber-500/60 bg-amber-50 dark:bg-amber-950/40" : "border-border hover:bg-muted",
              )}
            >
              <Star
                className={cn(
                  "h-5 w-5",
                  on ? "fill-amber-400 text-amber-500" : "text-muted-foreground",
                )}
              />
              <span className="mt-0.5 text-[9px] leading-none font-medium">{i + 1}</span>
            </button>
          );
        })}
      </div>

      <div className="text-muted-foreground font-mono text-sm">
        二進位（星 1..7）: {states.map((s) => (s ? "1" : "0")).join(" ")}
      </div>
    </div>
  );
}
