"use client";

import { itemAttributeNames } from "@/lib/constants/i18n";
import { THRESHOLD_KEYS, type Thresholds } from "@/lib/constants/ranking";
import { Input } from "@/components/ui/input";
import { useDebouncedCommit } from "@/lib/hooks/use-debounced-commit";

interface Props {
  values: Thresholds;
  onChange: (next: Thresholds) => void;
}

export function ThresholdFilters({ values, onChange }: Props) {
  const [local, setLocal, commitNow] = useDebouncedCommit(values, onChange);

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">硬性門檻</label>
      <p className="text-xs text-muted-foreground">空白代表不限制</p>
      <div className="space-y-1.5">
        {THRESHOLD_KEYS.map((k) => (
          <div key={k} className="grid grid-cols-[4rem_1fr] items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {itemAttributeNames[k]} ≥
            </span>
            <Input
              type="number"
              inputMode="numeric"
              value={local[k] ?? ""}
              placeholder="—"
              onChange={(e) => {
                const raw = e.target.value.trim();
                const next = { ...local };
                if (raw === "") delete next[k];
                else next[k] = Number(raw) || 0;
                setLocal(next);
              }}
              onBlur={() => commitNow()}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitNow();
              }}
              aria-label={`${itemAttributeNames[k]} 門檻`}
              className="font-mono"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
