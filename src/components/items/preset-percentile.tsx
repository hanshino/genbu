import { presets } from "@/lib/scoring";

interface Props {
  itemScores: Record<string, number>;
  poolScores: Record<string, number[]>;
}

export function PresetPercentile({ itemScores, poolScores }: Props) {
  return (
    <div className="space-y-1.5">
      {presets.map((p) => {
        const s = itemScores[p.id] ?? 0;
        const pool = (poolScores[p.id] ?? []).filter((x) => x !== 0);
        const total = pool.length;

        if (s === 0 || total === 0) {
          return (
            <div
              key={p.id}
              className="grid grid-cols-[6rem_1fr_5rem] items-center gap-2 text-xs opacity-50"
            >
              <span className="text-muted-foreground">{p.label}</span>
              <div className="h-2 rounded-sm bg-muted" />
              <span className="text-right text-muted-foreground">—</span>
            </div>
          );
        }

        const worseCount = pool.filter((x) => x < s).length;
        const percentile = Math.round((worseCount / total) * 100);
        const rank = total - worseCount;

        return (
          <div
            key={p.id}
            className="grid grid-cols-[6rem_1fr_5rem] items-center gap-2 text-xs"
            title={`${p.label}：於 ${total} 件同類型裝備中第 ${rank} 名`}
          >
            <span className="text-muted-foreground">{p.label}</span>
            <div
              className="relative h-2 rounded-sm bg-muted"
              role="meter"
              aria-label={`${p.label} 百分位`}
              aria-valuenow={percentile}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-sm bg-primary/20"
                style={{ width: `${percentile}%` }}
              />
              <div
                className="absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-primary"
                style={{ left: `${percentile}%` }}
              />
            </div>
            <span className="text-right font-mono tabular-nums">
              勝過 {percentile}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
