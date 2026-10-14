// /items 列表可切換的欄位。名稱欄固定顯示，不在此列。
// 數值欄 key = items 表的實際欄位名（URL `cols` / `sortBy` 用、SQL 直接引用）；
// field = Item 型別上的舊 key（items.ts 用 alias 把改名欄位對回舊 key），label 取自 i18n。
// 這些欄位在 DB 裡沒有 NULL，「沒有這項數值」一律存 0，所以列表把 0 當成「—」並排在最後。
import { defineColumnSet, type ColumnKey } from "@/lib/columns";
import { itemAttributeNames } from "@/lib/constants/i18n";
import type { Item } from "@/lib/types/item";

type NumericItemField = { [F in keyof Item]: Item[F] extends number ? F : never }[keyof Item];

const stat = <K extends string>(key: K, field: NumericItemField) => ({
  key,
  field,
  label: itemAttributeNames[field],
});

export const ITEM_COLUMNS = defineColumnSet({
  cookie: "item_cols",
  note: "數值為裝備基礎值，未含隨機屬性與強化",
  base: [
    { key: "id", label: "編號" },
    { key: "type", label: "類型" },
    { key: "level", label: "等級" },
    { key: "weight", label: "重量" },
  ],
  numeric: [
    stat("atk", "atk"),
    stat("matk", "matk"),
    stat("extra_def", "def"),
    stat("magic_def", "mdef"),
    stat("hit", "hit"),
    stat("dodge", "dodge"),
    stat("critical_hit", "critical"),
    stat("uncanny_dodge", "uncanny_dodge"),
    stat("damage_min", "min_damage"),
    stat("damage_max", "max_damage"),
    stat("pdamage_min", "min_pdamage"),
    stat("pdamage_max", "max_pdamage"),
    stat("hp", "hp"),
    stat("mp", "mp"),
    stat("walk_speed", "speed"),
    stat("value", "value"),
  ],
});

export type ItemColumnKey = ColumnKey<typeof ITEM_COLUMNS>;
