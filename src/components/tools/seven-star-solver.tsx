"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  solveSevenStar,
  sevenStarToNumber,
  type SevenStarState,
} from "@/lib/solvers/seven-star";
import { InlineAlert } from "./inline-alert";

function isValid(n: number) {
  return Number.isInteger(n) && n >= 1 && n <= 127;
}

export function SevenStarSolver() {
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
        <label className="text-sm font-medium">輸入數字（1~127）</label>
        <Input
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

      <div className="flex flex-wrap items-center gap-2">
        {states.map((on, i) => (
          <Button
            key={i}
            variant="ghost"
            size="lg"
            onClick={() => toggleStar(i)}
            aria-label={`星 ${i + 1} ${on ? "開" : "關"}`}
            className="flex h-16 w-16 flex-col gap-1 p-1"
          >
            <Star
              className={on ? "h-8 w-8 fill-amber-400 text-amber-400" : "text-muted-foreground h-8 w-8"}
            />
            <span className="text-xs">星{i + 1}</span>
          </Button>
        ))}
      </div>

      <div className="text-muted-foreground font-mono text-sm">
        二進位（星 1..7）: {states.map((s) => (s ? "1" : "0")).join(" ")}
      </div>
    </div>
  );
}
