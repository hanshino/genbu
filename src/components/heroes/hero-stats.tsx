import type { HeroStats as HeroStatsData } from "@/lib/types/hero";

/** 依 hero 表欄位順序呈現；label 沿用站內既有的屬性中文名。 */
const STAT_ROWS: { key: keyof HeroStatsData; label: string }[] = [
  { key: "hp", label: "體力" },
  { key: "mp", label: "真氣" },
  { key: "atk", label: "物攻" },
  { key: "matk", label: "內勁" },
  { key: "def", label: "防禦" },
  { key: "mdef", label: "護勁" },
  { key: "hit", label: "命中" },
  { key: "dodge", label: "閃躲" },
  { key: "critical", label: "重擊" },
  { key: "uncannyDodge", label: "拆招" },
];

/**
 * 英雄基本數值。schema 上 10 個欄位皆為 not null，
 * 因此全部顯示（含 0），0 是資料中的實際值，不是缺值。
 */
export function HeroStats({ stats }: { stats: HeroStatsData }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">基本數值</h2>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border/60 bg-border/60 sm:grid-cols-3 lg:grid-cols-5">
        {STAT_ROWS.map((row) => (
          <div key={row.key} className="min-w-0 bg-card px-4 py-3">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="mt-0.5 truncate font-mono text-base tabular-nums">
              {stats[row.key].toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        以上為 hero 表的原始欄位值，數值 0 是資料中的實際內容，不代表資料缺漏。
      </p>
    </section>
  );
}
