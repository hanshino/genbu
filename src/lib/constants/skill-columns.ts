// /skills 列表可切換的欄位。名稱欄固定顯示，不在此列。
// 數值欄的 key 直接用 magic 表欄位名：同時是 URL `cols` / `sortBy` 的值，也是 MagicSummary 的屬性名。
// ponytail: 詳情頁（skill-detail / skill-level-table）有自己的 label，字面略不同，未合併。

export const SKILL_BASE_COLUMNS = [
  { key: "id", label: "編號" },
  { key: "clan", label: "門派" },
  { key: "skillType", label: "分類" },
  { key: "target", label: "作用目標" },
  { key: "attrib", label: "屬性" },
  { key: "maxLevel", label: "最高 Lv" },
] as const;

export const SKILL_NUMERIC_COLUMNS = [
  { key: "spend_mp", label: "真氣消耗" },
  { key: "recharge_time", label: "施放時間(ms)" },
  { key: "stun", label: "間隔(ms)" },
  { key: "time", label: "持續時間(ms)" },
  { key: "func_hit_p1", label: "命中係數(%)" },
  { key: "status_prob", label: "狀態機率(%)" },
  { key: "range", label: "施放距離" },
] as const;

export type SkillNumericKey = (typeof SKILL_NUMERIC_COLUMNS)[number]["key"];
export type SkillColumnKey = (typeof SKILL_BASE_COLUMNS)[number]["key"] | SkillNumericKey;

const ALL_KEYS: readonly SkillColumnKey[] = [
  ...SKILL_BASE_COLUMNS.map((c) => c.key),
  ...SKILL_NUMERIC_COLUMNS.map((c) => c.key),
];

export const DEFAULT_SKILL_COLUMNS: readonly SkillColumnKey[] = SKILL_BASE_COLUMNS.map(
  (c) => c.key,
);

export const SKILL_COLS_COOKIE = "skill_cols";

/** 逗號分隔字串 → 依定義順序排好的欄位；不認得的 key 略過，一個都沒有回 null（交給下一層 fallback）。 */
export function parseSkillColumns(raw: string | undefined | null): SkillColumnKey[] | null {
  if (!raw) return null;
  const wanted = new Set(raw.split(","));
  const cols = ALL_KEYS.filter((k) => wanted.has(k));
  return cols.length > 0 ? cols : null;
}

export function isDefaultSkillColumns(cols: readonly SkillColumnKey[]): boolean {
  return (
    cols.length === DEFAULT_SKILL_COLUMNS.length &&
    DEFAULT_SKILL_COLUMNS.every((k) => cols.includes(k))
  );
}
