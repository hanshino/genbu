"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  solveMagicTriangle,
  type MagicTriangleResult,
} from "@/lib/solvers/god-quest";
import { InlineAlert } from "./inline-alert";
import { MagicTriangleSvg } from "./magic-triangle-svg";

const VALID_SUMS = [17, 18, 19, 20, 21, 22, 23] as const;

const REASON_MESSAGE: Record<
  Exclude<MagicTriangleResult, { ok: true }>["reason"],
  string
> = {
  invalid_sum: "總和必須在 17 ~ 23 之間",
  invalid_leak: "封印數字必須是 1 ~ 9 的整數",
  no_solution: "這組輸入沒有合法解",
};

export function GodQuestSolver() {
  const [sum, setSum] = useState<number>(19);
  const [leakInput, setLeakInput] = useState("1");
  const [result, setResult] = useState<MagicTriangleResult | null>(null);
  const [index, setIndex] = useState(0);

  function onSolve() {
    const leak = Number(leakInput);
    setResult(solveMagicTriangle(sum, leak));
    setIndex(0);
  }

  const solutions = result?.ok ? result.solutions : [];
  const current = solutions[index];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">總和</label>
          <Select value={String(sum)} onValueChange={(v) => setSum(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VALID_SUMS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">封印數字（左上中）</label>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={9}
            value={leakInput}
            onChange={(e) => setLeakInput(e.target.value)}
            className="w-28"
          />
        </div>
        <Button onClick={onSolve}>計算</Button>
      </div>

      {result && !result.ok && <InlineAlert>{REASON_MESSAGE[result.reason]}</InlineAlert>}

      {result?.ok && current && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              共 {solutions.length} 組解 — 第 {index + 1} 組
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                aria-label="上一組"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={index >= solutions.length - 1}
                onClick={() => setIndex((i) => Math.min(solutions.length - 1, i + 1))}
                aria-label="下一組"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex justify-center">
            <MagicTriangleSvg solution={current} />
          </div>

          <div className="text-muted-foreground text-center text-sm">
            左邊 = {current.T + current.u1 + current.u2 + current.BL}
            ｜ 右邊 = {current.T + current.p1 + current.p2 + current.BR}
            ｜ 底邊 = {current.BL + current.m1 + current.m2 + current.BR}
          </div>
        </div>
      )}
    </div>
  );
}
