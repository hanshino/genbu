// compounds + compound_groups（COMPOUND.INI / [COMPGROUP] + [COMPOUND]）
// 煉化／合成配方：煉化「核心材料 + 副材料」依機率產出條目（裝備加成 / 物品 / 道具）。
//
// type 分四類（見 COMPOUND.INI 的 Type 欄）：
//   - ITEM_COMPOUND_GROUP     僅作為群組節點（無實際配方欄位）
//   - ITEM_COMPOUND_EQUIPMENT 武器／防具煉化（mod_prob 多為 ITEM_BONUS_*）
//   - ITEM_COMPOUND_ORNAMENT  飾品／真元裝還原（mod_prob 常為 ITEM_BONUS_CREATEITEM）
//   - ITEM_COMPOUND_ITEM      道具合成（mod_prob.type 為產出物品 id 字串）

export type CompoundType =
  | "ITEM_COMPOUND_GROUP"
  | "ITEM_COMPOUND_EQUIPMENT"
  | "ITEM_COMPOUND_ORNAMENT"
  | "ITEM_COMPOUND_ITEM";

/**
 * ITEM_COMPOUND_EQUIPMENT 配方的 material_items[0].id 是裝備槽位代碼（不是 item id）。
 * 對應 COMPOUND.INI 的 ITEM_EQUIPMENT_* 常數。
 */
export type EquipmentSlotKind = 1 | 2 | 3 | 4 | 5;

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlotKind, string> = {
  1: "武器類",
  2: "帽子類",
  3: "衣服類",
  4: "鞋子類",
  5: "飾品類",
};

export interface CompoundGroup {
  id: number;
  name: string | null;
}

/** 副材料一筆。 */
export interface CompoundMaterialItem {
  id: number;
  amount: number | null;
}

/**
 * 產出機率表的一筆條目。
 * - prob 以百萬分制（1,000,000 = 100%）；同一 compound 的所有 prob 加總 = 1,000,000。
 * - type 可能是 ITEM_BONUS_* 常數（裝備加成）或純數字字串（產出物品 id）。
 *   `0` 表示「無事發生」的 padding 條目。
 */
export interface CompoundModProb {
  type: string;
  min: number | null;
  max: number | null;
  prob: number | null;
}

/** compounds 原始 row（material_items / mod_prob 仍為 JSON 字串）。 */
export interface CompoundRow {
  id: number;
  type: CompoundType | string;
  name: string | null;
  level: number | null;
  group: number | null;
  money: number | null;
  material_core_id: number | null;
  material_core_amount: number | null;
  material_items: string | null;
  fail_item_id: number | null;
  fail_item_amount: number | null;
  mod_count_min: number | null;
  mod_count_max: number | null;
  mod_prob: string | null;
  equip_crash: number;
  help: string | null;
}

/** 解析後的 compound（JSON 欄位轉成陣列、equip_crash 轉成 boolean）。 */
export interface Compound {
  id: number;
  type: CompoundType | string;
  name: string | null;
  level: number | null;
  group: number | null;
  money: number | null;
  materialCoreId: number | null;
  materialCoreAmount: number | null;
  materialItems: CompoundMaterialItem[];
  failItemId: number | null;
  failItemAmount: number | null;
  modCountMin: number | null;
  modCountMax: number | null;
  modProb: CompoundModProb[];
  equipCrash: boolean;
  help: string | null;
}
