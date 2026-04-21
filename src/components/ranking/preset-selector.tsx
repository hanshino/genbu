"use client";

import { presets } from "@/lib/scoring";
import type { CustomPreset } from "@/lib/hooks/use-custom-presets";
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
}

export function PresetSelector({ value, onChange, customPresets }: Props) {
  const currentValue =
    value.kind === "ad-hoc"
      ? "ad-hoc"
      : `${value.kind}:${value.id}`;

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
    </div>
  );
}
