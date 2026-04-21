"use client";

interface Props {
  min: number;
  max: number;
  absoluteMin: number;
  absoluteMax: number;
  onChange: (range: { min: number; max: number }) => void;
}

export function LevelRange({ min, max, absoluteMin, absoluteMax, onChange }: Props) {
  const clamp = (n: number) => Math.max(absoluteMin, Math.min(absoluteMax, n));

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">等級範圍</label>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={absoluteMin}
          max={absoluteMax}
          value={min}
          onChange={(e) => {
            const v = clamp(Number(e.target.value) || absoluteMin);
            onChange({ min: Math.min(v, max), max });
          }}
          className="min-h-[44px] rounded-md border border-border bg-background px-2 py-1 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="text-muted-foreground text-xs">~</span>
        <input
          type="number"
          inputMode="numeric"
          min={absoluteMin}
          max={absoluteMax}
          value={max}
          onChange={(e) => {
            const v = clamp(Number(e.target.value) || absoluteMax);
            onChange({ min, max: Math.max(v, min) });
          }}
          className="min-h-[44px] rounded-md border border-border bg-background px-2 py-1 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        允許 {absoluteMin}~{absoluteMax}
      </p>
    </div>
  );
}
