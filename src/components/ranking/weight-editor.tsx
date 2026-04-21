"use client";

import { useMemo } from "react";
import { itemAttributeNames } from "@/lib/constants/i18n";
import type { Weights } from "@/lib/scoring";
import { Button } from "@/components/ui/button";

const SCOREABLE_KEYS = [
  "hp", "mp",
  "str", "pow", "vit", "dex", "agi", "wis",
  "atk", "matk", "def", "mdef",
  "dodge", "uncanny_dodge", "critical", "hit", "speed",
  "fire", "water", "thunder", "tree", "freeze",
  "min_damage", "max_damage", "min_pdamage", "max_pdamage",
] as const;

const MIN_WEIGHT = -2;
const MAX_WEIGHT = 3;
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
    () => SCOREABLE_KEYS.filter((k) => !(k in weights)),
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
                <select
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={r.key}
                  onChange={(e) => setRowKey(r.key, e.target.value)}
                  aria-label={`屬性：${label}`}
                >
                  <option value={r.key}>{label}</option>
                  {availableKeys.map((k) => (
                    <option key={k} value={k}>
                      {itemAttributeNames[k] ?? k}
                    </option>
                  ))}
                </select>
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
                  className="h-6 flex-1 cursor-pointer accent-primary"
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
