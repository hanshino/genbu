"use client";

import { presets } from "@/lib/scoring";
import type { CustomPreset } from "@/lib/hooks/use-custom-presets";

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
      <select
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        value={currentValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "ad-hoc") return onChange({ kind: "ad-hoc" });
          const [kind, id] = v.split(":", 2);
          if (kind === "builtin" || kind === "custom") onChange({ kind, id });
        }}
      >
        <optgroup label="預設">
          {presets.map((p) => (
            <option key={p.id} value={`builtin:${p.id}`}>{p.label}</option>
          ))}
        </optgroup>
        {customPresets.length > 0 && (
          <optgroup label="我的配方">
            {customPresets.map((p) => (
              <option key={p.id} value={`custom:${p.id}`}>{p.name}</option>
            ))}
          </optgroup>
        )}
        <option value="ad-hoc">自訂（手動權重）</option>
      </select>
    </div>
  );
}
