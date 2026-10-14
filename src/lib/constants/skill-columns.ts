// /skills 列表可切換的欄位。名稱欄固定顯示，不在此列。
// 數值欄的 key 直接用 magic 表欄位名：同時是 URL `cols` / `sortBy` 的值，也是 MagicSummary 的屬性名。
// ponytail: 詳情頁（skill-detail / skill-level-table）有自己的 label，字面略不同，未合併。
import { defineColumnSet, isDefaultColumns, parseColumns, type ColumnKey } from "@/lib/columns";

export const SKILL_COLUMNS = defineColumnSet({
  cookie: "skill_cols",
  note: "數值欄皆為該技能最高等級的數值",
  base: [
    { key: "id", label: "編號" },
    { key: "clan", label: "門派" },
    { key: "skillType", label: "分類" },
    { key: "target", label: "作用目標" },
    { key: "attrib", label: "屬性" },
    { key: "maxLevel", label: "最高 Lv" },
  ],
  numeric: [
    { key: "spend_mp", label: "真氣消耗" },
    { key: "recharge_time", label: "施放時間(ms)" },
    { key: "stun", label: "間隔(ms)" },
    { key: "time", label: "持續時間(ms)" },
    { key: "func_hit_p1", label: "命中係數(%)" },
    { key: "status_prob", label: "狀態機率(%)" },
    { key: "range", label: "施放距離" },
  ],
});

export type SkillColumnKey = ColumnKey<typeof SKILL_COLUMNS>;
export const DEFAULT_SKILL_COLUMNS = SKILL_COLUMNS.defaults;

export const parseSkillColumns = (raw: string | undefined | null) =>
  parseColumns(SKILL_COLUMNS, raw);
export const isDefaultSkillColumns = (cols: readonly string[]) =>
  isDefaultColumns(SKILL_COLUMNS, cols);
