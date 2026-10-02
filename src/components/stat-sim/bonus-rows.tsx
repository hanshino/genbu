"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STAT_KEYS, type PanelBonus, type StatKey } from "@/lib/types/stat-sim";
import { STAT_LABELS, selectOnFocus } from "./labels";

/** 「屬性 + 數值」的手動加值列；鑲嵌、隨機屬性、英雄、陣法共用。 */
export function BonusRows({
  value,
  onChange,
  label,
}: {
  value: PanelBonus;
  onChange: (next: PanelBonus) => void;
  label: string;
}) {
  const used = STAT_KEYS.filter((key) => value[key] != null);
  const unused = STAT_KEYS.filter((key) => value[key] == null);
  const set = (key: StatKey, amount: number) => onChange({ ...value, [key]: amount });
  const drop = (key: StatKey) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {used.map((key) => (
        <div key={key} className="grid grid-cols-[minmax(0,1fr)_96px_auto] items-center gap-2">
          <Select
            value={key}
            onValueChange={(next) => {
              if (!next || next === key) return;
              const rest = { ...value };
              const amount = rest[key]!;
              delete rest[key];
              onChange({ ...rest, [next as StatKey]: amount });
            }}
          >
            <SelectTrigger size="sm" className="w-full" aria-label={`${label}屬性`}>
              <SelectValue>{(v: unknown) => STAT_LABELS[v as StatKey] ?? ""}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {[key, ...unused].map((k) => (
                <SelectItem key={k} value={k}>
                  {STAT_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            onFocus={selectOnFocus}
            // 數值改完（離開欄位）才寫回，打字中的「-」不會被吃掉
            key={`${key}:${value[key]}`}
            type="number"
            inputMode="numeric"
            defaultValue={value[key]}
            aria-label={`${label}${STAT_LABELS[key]}數值`}
            className="h-7 text-right font-mono"
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (e.target.value.trim() !== "" && Number.isFinite(n)) set(key, n);
              else e.target.value = String(value[key]);
            }}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`移除${label}${STAT_LABELS[key]}`}
            onClick={() => drop(key)}
          >
            <XIcon />
          </Button>
        </div>
      ))}
      {unused.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => set(unused[0], 0)}>
          <PlusIcon />
          新增一項
        </Button>
      )}
    </div>
  );
}
