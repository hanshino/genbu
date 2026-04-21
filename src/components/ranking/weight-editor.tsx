"use client";

import { useMemo } from "react";
import { itemAttributeNames, displayableAttributeKeys } from "@/lib/constants/i18n";
import type { Weights } from "@/lib/scoring";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MIN_WEIGHT = -2;
// Built-in presets go up to 15 (手甲 dex) — slider must cover that range or
// loading a preset pegs the thumb at max while the stored value overflows.
const MAX_WEIGHT = 15;
const STEP = 0.25;

interface Row { key: string; value: number }

interface Props {
  weights: Weights;
  onChange: (next: Weights) => void;
}

export function WeightEditor({ weights, onChange }: Props) {
  const rows: Row[] = useMemo(
    () => Object.entries(weights).map(([key, value]) => ({ key, value })),
    [weights]
  );

  const availableKeys = useMemo(
    () => displayableAttributeKeys.filter((k) => !(k in weights)),
    [weights]
  );

  const setRowKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    const next: Weights = {};
    for (const [k, v] of Object.entries(weights)) {
      next[k === oldKey ? newKey : k] = v;
    }
    onChange(next);
  };

  const setRowValue = (key: string, value: number) => {
    onChange({ ...weights, [key]: value });
  };

  const removeRow = (key: string) => {
    const next = { ...weights };
    delete next[key];
    onChange(next);
  };

  const addRow = () => {
    const firstFree = availableKeys[0];
    if (!firstFree) return;
    onChange({ ...weights, [firstFree]: 1 });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">權重</label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addRow}
          disabled={availableKeys.length === 0}
        >
          + 新增屬性
        </Button>
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground">尚未設定權重</p>
      )}
      <div className="space-y-2.5">
        {rows.map((r) => {
          const label = itemAttributeNames[r.key] ?? r.key;
          return (
            <div
              key={r.key}
              className="rounded-md border border-border/60 bg-card/50 px-2 py-1.5"
            >
              <div className="flex items-center gap-1.5">
                <Select
                  value={r.key}
                  onValueChange={(v) => {
                    if (v) setRowKey(r.key, v);
                  }}
                >
                  <SelectTrigger className="flex-1" aria-label={`屬性：${label}`}>
                    <SelectValue>
                      {(val) =>
                        typeof val === "string"
                          ? (itemAttributeNames[val] ?? val)
                          : null
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={r.key}>{label}</SelectItem>
                    {availableKeys.map((k) => (
                      <SelectItem key={k} value={k}>
                        {itemAttributeNames[k] ?? k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeRow(r.key)}
                  aria-label={`移除 ${label}`}
                  className="min-h-[36px] min-w-[36px] shrink-0"
                >
                  ×
                </Button>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="range"
                  min={MIN_WEIGHT}
                  max={MAX_WEIGHT}
                  step={STEP}
                  value={r.value}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setRowValue(r.key, Number.isFinite(v) ? v : 0);
                  }}
                  aria-label={`${label} 權重`}
                  className="h-6 flex-1 cursor-pointer accent-foreground/70"
                />
                <output
                  className="w-10 text-right font-mono text-xs tabular-nums text-muted-foreground"
                  aria-live="polite"
                >
                  {r.value > 0 ? `+${r.value}` : r.value}
                </output>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
