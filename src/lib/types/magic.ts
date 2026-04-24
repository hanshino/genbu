// magic table 行型別（對齊 tthol.sqlite PRAGMA）
// PK 為複合鍵 (id, level) — 每個技能展開為多筆 level 行。

export interface Magic {
  id: number;
  level: number;
  name: string;
  icon: string | null;
  clan: string | null;
  clan2: string | null;
  target: string | null;
  help: number | null;
  cast_effect: number | null;
  range: number | null;
  spend_mp: number | null;
  break_prob: number | null;
  stun: number | null;
  status_param: number | null;
  extra_status: number | null;
  time: number | null;
  group: number | null;
  order: number | null;
  func_dmg: number | null;
  func_dmg_p1: number | null;
  func_dmg_p2: number | null;
  func_dmg_p3: number | null;
  func_dmg_p4: number | null;
  func_dmg_p5: number | null;
  func_hit: number | null;
  func_hit_p1: number | null;
  skill_type: number | null;
  teacher: number | null;
  func_case: number | null;
  func_case_p1: number | null;
  func_case_p2: number | null;
  func_case_p3: number | null;
  func_case_p4: number | null;
  func_case_p5: number | null;
  pk_disable: number | null;
  attrib: number | null;
  status_prob: number | null;
  recharge_time: number | null;
  hit_range: number | null;
  recharge_effect: number | null;
  spend_flag: number | null;
  spend_hp: number | null;
  exclude: number | null;
  pet_id: number | null;
  confine_state: number | null;
}

// 列表頁投影：每個 skill 一列，聚合最高 level
export interface MagicSummary {
  id: number;
  name: string;
  maxLevel: number;
  clan: string | null;
  clan2: string | null;
  skill_type: number | null;
  attrib: number | null;
  target: string | null;
}
