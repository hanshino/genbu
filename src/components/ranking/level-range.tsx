"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { useDebouncedCommit } from "@/lib/hooks/use-debounced-commit";

interface Props {
  min: number;
  max: number;
  absoluteMin: number;
  absoluteMax: number;
  onChange: (range: { min: number; max: number }) => void;
}

export function LevelRange({ min, max, absoluteMin, absoluteMax, onChange }: Props) {
  const external = useMemo(() => ({ min, max }), [min, max]);
  const [local, setLocal, flush] = useDebouncedCommit(external, onChange);
  const clampAbs = (n: number) => Math.max(absoluteMin, Math.min(absoluteMax, n));

  const commitMin = () => {
    const bounded = Math.min(local.max, clampAbs(local.min));
    const next = { min: bounded, max: local.max };
    setLocal(next);
    flush(next);
  };
  const commitMax = () => {
    const bounded = Math.max(local.min, clampAbs(local.max));
    const next = { min: local.min, max: bounded };
    setLocal(next);
    flush(next);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">等級範圍</label>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min={absoluteMin}
          max={absoluteMax}
          value={local.min}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isFinite(v)) return;
            setLocal({ min: v, max: local.max });
          }}
          onBlur={commitMin}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitMin();
          }}
          aria-label="等級下限"
          className="font-mono"
        />
        <span className="text-muted-foreground text-xs">~</span>
        <Input
          type="number"
          inputMode="numeric"
          min={absoluteMin}
          max={absoluteMax}
          value={local.max}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isFinite(v)) return;
            setLocal({ min: local.min, max: v });
          }}
          onBlur={commitMax}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitMax();
          }}
          aria-label="等級上限"
          className="font-mono"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        允許 {absoluteMin}~{absoluteMax}
      </p>
    </div>
  );
}
