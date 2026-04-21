// npc 表：主要戰鬥屬性
export interface NpcRow {
  id: number;
  name: string;
  level: number;
  type: number;
  elemental: string | null;
  hp: number;
  str: number;
  pow: number;
  vit: number;
  dex: number;
  agi: number;
  wis: number;
  damage_min: number;
  damage_max: number;
  pDamage_min: number;
  pDamage_max: number;
  extra_def: number;
  magic_def: number;
  base_hit: number;
  base_dodge: number;
  critical_hit: number;
  uncanny_dodge: number;
  fire_def: number;
  water_def: number;
  lightning_def: number;
  wood_def: number;
  drop_exp: number;
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

export interface MonsterDropSource {
  id: number;
  name: string;
  level: number;
  rate: number;
}
