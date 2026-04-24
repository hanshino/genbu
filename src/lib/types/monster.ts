// npc 表：戰鬥主資料（包含 monsters.id 的超集合 — monsters 是 npc 中的可戰鬥子集）
export interface NpcRow {
  id: number;
  name: string;
  pic: number | null;
  type: number | null;
  sub_type: number | null;
  elemental: string | null;
  elemental_attack: number | null;
  level: number;
  hp: number | null;
  str: number | null;
  pow: number | null;
  vit: number | null;
  dex: number | null;
  agi: number | null;
  wis: number | null;
  walk_speed: number | null;
  attack_speed: number | null;
  attack_range: number | null;
  damage_min: number | null;
  damage_max: number | null;
  pDamage_min: number | null;
  pDamage_max: number | null;
  extra_def: number | null;
  magic_def: number | null;
  base_hit: number | null;
  base_dodge: number | null;
  critical_hit: number | null;
  uncanny_dodge: number | null;
  fire_def: number | null;
  water_def: number | null;
  lightning_def: number | null;
  wood_def: number | null;
  extra_status: number | null;
  status_prob: number | null;
  drop_exp: number | null;
  weaken_res: number | null;
  stun_res: number | null;
  shape_res: number | null;
  bleed_res: number | null;
  drop_money_min: number | null;
  drop_money_max: number | null;
}

// monsters 表：掉落資料（drop_item 為 JSON 字串）
export interface MonsterDrop {
  id: number;
  name: string;
  level: number;
  drop_item: string | null;
}

// 解析後的單筆掉落
export interface DropEntry {
  itemId: number;
  rate: number;
}

// 「含掉落來源資訊」的怪物，給 items 詳情頁用
export interface MonsterDropSource {
  id: number;
  name: string;
  level: number;
  rate: number;
}

// 怪物列表投影：列表頁顯示所需欄位
export interface MonsterSummary {
  id: number;
  name: string;
  level: number;
  type: number | null;
  elemental: string | null;
  hp: number | null;
  hasDrop: boolean;
}

// 怪物詳情頁：npc 全量 + 是否為一般怪
export interface MonsterDetail extends NpcRow {
  drop_item: string | null;
}

// 怪物詳情頁的單筆掉落物（JOIN items）
export interface MonsterDropItem {
  itemId: number;
  name: string | null;
  type: string | null;
  level: number | null;
  rate: number;
}

// 怪物掉落表完整回傳：drops 已過濾掉 itemId=0 的空槽，
// totalWeight 是所有 slot 權重總和（含空槽），用來算真實百分比。
export interface MonsterDropTable {
  drops: MonsterDropItem[];
  totalWeight: number;
}
