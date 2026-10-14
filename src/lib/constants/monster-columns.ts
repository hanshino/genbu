// /monsters 列表可切換的欄位。名稱欄固定顯示，不在此列。
// 數值欄 key = npc 表欄位名（URL `cols` / `sortBy` 用，SQL 以 `n.<key>` 引用），label 取自 monsterFieldLabels。
// 這些欄位在 DB 裡沒有 NULL；怪物的 0 是真實數值（例如 0 火抗），照常顯示 0。
import { defineColumnSet, type ColumnKey } from "@/lib/columns";
import { monsterFieldLabels } from "@/lib/constants/field-labels";
import type { NpcRow } from "@/lib/types/monster";

const stat = <K extends keyof NpcRow & string>(key: K) => ({ key, label: monsterFieldLabels[key] });

export const MONSTER_COLUMNS = defineColumnSet({
  cookie: "monster_cols",
  base: [
    { key: "id", label: "編號" },
    { key: "spawns", label: "出沒地點" },
    { key: "type", label: "類型" },
    { key: "elemental", label: "屬性" },
    { key: "level", label: "等級" },
    { key: "hp", label: "血量" },
    { key: "hasDrop", label: "掉落" },
  ],
  numeric: [
    stat("damage_min"),
    stat("damage_max"),
    stat("pDamage_min"),
    stat("pDamage_max"),
    stat("extra_def"),
    stat("magic_def"),
    stat("base_hit"),
    stat("base_dodge"),
    stat("critical_hit"),
    stat("uncanny_dodge"),
    stat("attack_speed"),
    stat("walk_speed"),
    stat("attack_range"),
    stat("drop_exp"),
    stat("fire_def"),
    stat("water_def"),
    stat("lightning_def"),
    stat("wood_def"),
  ],
});

export type MonsterColumnKey = ColumnKey<typeof MONSTER_COLUMNS>;
export type MonsterNumericKey = (typeof MONSTER_COLUMNS.numeric)[number]["key"];
