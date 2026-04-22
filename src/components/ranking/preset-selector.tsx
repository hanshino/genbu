"use client";

import { Trash2Icon } from "lucide-react";
import { presets } from "@/lib/scoring";
import type { CustomPreset } from "@/lib/hooks/use-custom-presets";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PresetSelection =
  | { kind: "builtin"; id: string }
  | { kind: "custom"; id: string }
  | { kind: "ad-hoc" }; // user has edited weights beyond a named preset

interface Props {
  value: PresetSelection;
  onChange: (s: PresetSelection) => void;
  customPresets: readonly CustomPreset[];
  onDeleteCustomPreset?: (id: string) => void;
}

export function PresetSelector({ value, onChange, customPresets, onDeleteCustomPreset }: Props) {
  const currentValue = value.kind === "ad-hoc" ? "ad-hoc" : `${value.kind}:${value.id}`;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">流派</label>
      <Select
        value={currentValue}
        onValueChange={(v) => {
          if (!v) return;
          if (v === "ad-hoc") return onChange({ kind: "ad-hoc" });
          const [kind, id] = v.split(":", 2);
          if (kind === "builtin" || kind === "custom") onChange({ kind, id });
        }}
      >
        <SelectTrigger className="w-full" aria-label="流派">
          <SelectValue>
            {(val) => {
              if (val === "ad-hoc") return "自訂（手動權重）";
              if (typeof val !== "string") return null;
              const [kind, id] = val.split(":", 2);
              if (kind === "builtin") {
                return presets.find((p) => p.id === id)?.label ?? val;
              }
              if (kind === "custom") {
                return customPresets.find((p) => p.id === id)?.name ?? val;
              }
              return val;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>預設</SelectLabel>
            {presets.map((p) => (
              <SelectItem key={p.id} value={`builtin:${p.id}`}>
                {p.label}
              </SelectItem>
            ))}
          </SelectGroup>
          {customPresets.length > 0 && (
            <SelectGroup>
              <SelectLabel>我的配方</SelectLabel>
              {customPresets.map((p) => (
                <SelectItem key={p.id} value={`custom:${p.id}`}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          <SelectItem value="ad-hoc">自訂（手動權重）</SelectItem>
        </SelectContent>
      </Select>

      {customPresets.length > 0 && onDeleteCustomPreset && (
        <div className="space-y-1 pt-1">
          <p className="text-xs text-muted-foreground">我的配方</p>
          {customPresets.map((p) => {
            const isActive = value.kind === "custom" && value.id === p.id;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 transition-colors ${
                  isActive
                    ? "border-primary/40 bg-primary/5"
                    : "border-border/60 bg-card/50 hover:bg-muted/40"
                }`}
              >
                <button
                  type="button"
                  className="flex-1 truncate text-left text-sm"
                  onClick={() => onChange({ kind: "custom", id: p.id })}
                >
                  {p.name}
                </button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onDeleteCustomPreset(p.id)}
                  aria-label={`刪除配方 ${p.name}`}
                >
                  <Trash2Icon className="size-3.5" aria-hidden />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
