import type { SkillLike } from "@/lib/combat/damage";
import type { Attributes, SectId, SimItem } from "@/lib/types/stat-sim";

/** 放置角色的門派：stat-sim 的主門派，加上入門弟子 1。 */
export type IdleSectId = SectId | 1;

// ---------------------------------------------------------------------------
// 存檔狀態（idle_saves.state 的 JSON，version 1）。純 JSON：不能有 undefined、Map、NaN。
// ---------------------------------------------------------------------------

export type IdleGender = "m" | "f";

/** 角色生日（建立角色時選填；沒有年份）。 */
export interface IdleBirthday {
  month: number;
  day: number;
}

/** 一次施放中、預先抽好的一個命中（落在施放的第 at 個 tick）。 */
export interface PendingHit {
  at: number;
  /** "miss" 沒有傷害。 */
  kind: "hit" | "crit" | "miss";
  damage: number;
}

export type IdlePhase =
  | { kind: "searching"; remaining: number }
  | {
      kind: "casting";
      monsterId: number;
      /** 怪物剩餘 HP；0 = 已被擊倒（施放不中斷，後面的命中是 overkill）。 */
      hp: number;
      skillId: number | null;
      elapsed: number;
      castTicks: number;
      pending: PendingHit[];
      /** pending 中下一個還沒發生的索引。 */
      next: number;
    }
  | { kind: "post-cast"; monsterId: number; hp: number; remaining: number }
  /** 命中不足：角色對這隻怪的命中率是 0，暫停到玩家配點或換技能。 */
  | { kind: "blocked"; monsterId: number; required: number };

export interface IdleStats {
  kills: number;
  /** 累計獲得的經驗與金錢。 */
  exp: number;
  money: number;
  hits: number;
  misses: number;
  /** 實際扣掉怪物 HP 的傷害（不含 overkill）。 */
  damage: number;
}

export interface IdleState {
  /** 角色名字與生日：建立角色時填的，舊存檔沒有。 */
  name?: string;
  birthday?: IdleBirthday;
  presetId: number;
  /** 右手武器（items.id）。沒有（舊存檔）= 用預設角色自己的武器；空手外觀的預設角色靠它指定武器。 */
  weaponItemId?: number;
  gender: IdleGender;
  sectId: IdleSectId;
  level: number;
  /** 目前等級內累積的經驗（升級後扣掉所需經驗）。 */
  exp: number;
  money: number;
  attributes: Attributes;
  unspentPoints: number;
  /** null = 自動（取目前可學範圍內期望傷害最高的）。 */
  skillId: number | null;
  /** 目前實際使用的技能等級；沒有技能（普攻）為 0。由引擎在升級時更新。 */
  skillLevel: number;
  stageId: number;
  /** mulberry32 的目前狀態（uint32）。 */
  seed: number;
  saveCounter: number;
  /** 伺服器最後一次結算到的時間（ms epoch）。 */
  lastSettledAt: number;
  phase: IdlePhase;
  stats: IdleStats;
}

// ---------------------------------------------------------------------------
// 事件：t 是這次 advance 內的 tick 位移（從 0 起），畫面用它排時間。
// ---------------------------------------------------------------------------

export type IdleEvent = { t: number } & (
  | { type: "search-start" }
  | { type: "encounter"; monsterId: number }
  | { type: "cast"; skillId: number | null; castTicks: number }
  | { type: "hit"; damage: number; kind: "hit" | "crit" }
  | { type: "miss" }
  | { type: "kill"; monsterId: number; exp: number; money: number }
  | { type: "level-up"; level: number; points: number }
  | { type: "hit-too-low"; required: number; current: number }
);

export interface IdleSummary {
  ticks: number;
  kills: number;
  exp: number;
  money: number;
  hits: number;
  misses: number;
  damage: number;
  levelBefore: number;
  levelAfter: number;
  levelUps: number;
  pointsGained: number;
  /** 結束時卡在命中不足。 */
  blocked: boolean;
}

// ---------------------------------------------------------------------------
// 引擎需要的靜態資料（由 src/lib/queries/idle.ts 載入；純 JSON，引擎不碰 DB）。
// ---------------------------------------------------------------------------

export interface IdleMonster {
  id: number;
  name: string;
  level: number;
  hp: number;
  extraDef: number;
  magicDef: number;
  baseDodge: number;
  dropExp: number;
  dropMoneyMin: number;
  dropMoneyMax: number;
}

/** 技能的一個等級：magic 的傷害欄位加演出時間軸。 */
export interface IdleSkillLevel extends SkillLike {
  level: number;
  /** magic_learn.char_level */
  learnLevel: number;
  /** 時間軸中每個命中事件的 tick（已排序）。 */
  hitTicks: number[];
  /** 施放時長 = max(時間軸 ticks, 最後一個命中 tick)，至少 1。 */
  castTicks: number;
}

export interface IdleSkill {
  id: number;
  name: string;
  skillType: number | null;
  /** 有演出資料的等級，依等級由小到大。 */
  levels: IdleSkillLevel[];
}

export interface IdleData {
  presetId: number;
  sectId: IdleSectId;
  gender: IdleGender;
  stageId: number;
  /** effect_presets.weapon_item_id 對應的武器；空手為 null。 */
  weapon: SimItem | null;
  monsters: Record<number, IdleMonster>;
  /** 該地圖 monster_spawns 的出現權重（每列一份）。 */
  spawns: { monsterId: number; weight: number }[];
  /** char_levels.exp，索引 = 等級（0 不用）。 */
  levelExp: number[];
  skills: IdleSkill[];
}

export interface AdvanceOptions {
  collectEvents?: boolean;
}

export interface AdvanceResult {
  state: IdleState;
  /** collectEvents 不為 true 時是空陣列。 */
  events: IdleEvent[];
  summary: IdleSummary;
}
