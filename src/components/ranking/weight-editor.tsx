"use client";

import { useMemo } from "react";
import { itemAttributeNames } from "@/lib/constants/i18n";
import type { Weights } from "@/lib/scoring";
import { Button } from "@/components/ui/button";

// Attributes that make sense as scoring inputs. Excludes metadata (id/name/type)
// and non-stat fields (weight/value/durability/picture/icon).
const SCOREABLE_KEYS = [
  "hp", "mp",
  "str", "pow", "vit", "dex", "agi", "wis",
  "atk", "matk", "def", "mdef",
  "dodge", "uncanny_dodge", "critical", "hit", "speed",
  "fire", "water", "thunder", "tree", "freeze",
  "min_damage", "max_damage", "min_pdamage", "max_pdamage",
] as const;

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
    <div className="space-y-1.5">
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
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[1fr_5rem_2rem] items-center gap-1.5">
          <select
            className="min-h-[44px] rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={r.key}
            onChange={(e) => setRowKey(r.key, e.target.value)}
          >
            <option value={r.key}>{itemAttributeNames[r.key] ?? r.key}</option>
            {availableKeys.map((k) => (
              <option key={k} value={k}>{itemAttributeNames[k] ?? k}</option>
            ))}
          </select>
          <input
            type="number"
            inputMode="decimal"
            step="0.25"
            className="min-h-[44px] rounded-md border border-border bg-background px-2 py-1 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={r.value}
            onChange={(e) => {
              const v = Number(e.target.value);
              setRowValue(r.key, Number.isFinite(v) ? v : 0);
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => removeRow(r.key)}
            aria-label={`移除 ${r.key}`}
            className="min-h-[44px] min-w-[44px]"
          >
            ×
          </Button>
        </div>
      ))}
    </div>
  );
}
