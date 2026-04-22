import { itemAttributeNames } from "@/lib/constants/i18n";

export interface StatBarChartProps {
  values: object;
  maxValues: Record<string, number>;
  // Optional: restrict which keys to render and in what order
  keys?: readonly string[];
}

const DEFAULT_KEYS = [
  "str",
  "pow",
  "wis",
  "agi",
  "dex",
  "vit",
  "atk",
  "matk",
  "def",
  "mdef",
  "hit",
  "dodge",
  "critical",
] as const;

export function StatBarChart({ values, maxValues, keys = DEFAULT_KEYS }: StatBarChartProps) {
  const record = values as Readonly<Record<string, unknown>>;
  const rows = keys
    .map((k) => {
      const raw = record[k];
      return {
        key: k,
        label: itemAttributeNames[k] ?? k,
        value: typeof raw === "number" ? raw : 0,
        max: Math.max(1, maxValues[k] ?? 0),
      };
    })
    .filter((r) => r.value !== 0 || (maxValues[r.key] ?? 0) !== 0);

  if (rows.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const pct = Math.max(0, Math.min(100, (r.value / r.max) * 100));
        return (
          <div key={r.key} className="grid grid-cols-[4rem_1fr_3rem] items-center gap-2 text-xs">
            <span className="text-muted-foreground">{r.label}</span>
            <div
              className="h-2 rounded-sm bg-muted overflow-hidden"
              role="meter"
              aria-label={r.label}
              aria-valuenow={r.value}
              aria-valuemin={0}
              aria-valuemax={r.max}
            >
              <div
                className="h-full bg-primary/70 transition-[width] motion-reduce:transition-none"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-mono text-right">{r.value}</span>
          </div>
        );
      })}
    </div>
  );
}
