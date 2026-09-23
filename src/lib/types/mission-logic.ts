// 任務邏輯（接取條件、流程、獎勵、禮盒）—— headless 資料層。
//
// 資料來源皆為上游 tthol_data 解析寫回的表：mission_events（生命週期事件）、
// mission_requirements（接取條件，逐條已附中文 summary）、mission_rewards
// （完成獎勵與需交付物）、item_box_rewards（開道具禮盒得到什麼）。
// 語意詳見 docs/msg-trigger-codes.md 與上游 tthol_data repo 的
// scripts/trigger_op_investigation.md、CLAUDE.md。
//
// 通用規則：全部查詢排除 is_gm=1；mission_id 系表另外要求 is_mission=1
// （mission_id 欄位共用了旗標/計時器 id 空間，不是純 FK）。

import type { EntityImage } from "@/lib/queries/images";

/** 接取／完成任務的限時（來自 A35/A36 計時器；-1/null 一律過濾掉）。 */
export interface MissionTimer {
  minutes: number;
}

/** 條件所屬的粗分類，供 UI 選 icon。 */
export type ConditionKind =
  | "level"
  | "stat"
  | "charisma"
  | "intimacy"
  | "gold"
  | "item"
  | "faction"
  | "gender"
  | "skill"
  | "prereq"
  | "other";

/** 持有道具條件（op=31）解析出的連結資料。 */
export interface ConditionItemLink {
  itemId: number;
  itemName: string;
  qty: number;
  icon: EntityImage | null;
}

/** 技能等級條件（op=34，a0 = magic.id*100+level）解析出的連結資料。 */
export interface ConditionSkillLink {
  magicId: number;
  level: number;
  magicName: string | null;
}

/** 前置任務條件（op=28 且 a1=15）解析出的連結資料。 */
export interface ConditionPrereqLink {
  missionId: number;
  missionName: string | null;
}

/** 單條接取條件（mission_requirements 一列）。 */
export interface MissionCondition {
  op: number;
  negated: boolean;
  a0: number | null;
  a1: number | null;
  a2: number | null;
  a3: number | null;
  a4: number | null;
  /** mission_requirements.summary，已去除結尾的推測標記 "°"。 */
  summary: string;
  /** summary 原本以 "°" 結尾，或 op_defs(kind='C', op).confidence !== "confirmed"。 */
  likely: boolean;
  kind: ConditionKind;
  /** 條件不滿足時 NPC 的回話（messages.msg 原文，含 FONT 標記，用 <GameText> 顯示）；約 25% 條件才有。 */
  rejectText: string | null;
  item: ConditionItemLink | null;
  skill: ConditionSkillLink | null;
  prereq: ConditionPrereqLink | null;
}

/** 一組接取條件：同一 (msg_id, trigger_idx)。不同組之間「擇一」。 */
export interface MissionRequirementGroup {
  msgId: number;
  triggerIdx: number;
  /** 0 = 全部條件都要成立；1 = 任一成立即可。 */
  mode: 0 | 1;
  conditions: MissionCondition[];
}

/** 任務流程時間軸上的一個節點。 */
export interface MissionFlowStep {
  /** 0 = 接取；1..14 = 完成第 step 步；15 = 整個任務完成。 */
  step: number;
  /** 觸發該事件的 NPC（可能多個訊息對到同一步）。 */
  npcs: string[];
  /** 對應訊息原文（含 FONT 標記與字面 \n，未截斷；用 <GameText maxChars> 顯示）；查無文字為 null。 */
  dialogue: string | null;
}

export type RewardType =
  | "item"
  | "timed_item"
  | "exp"
  | "exp_pct"
  | "gold"
  | "charisma"
  | "intimacy"
  | "hero_token"
  | "skill"
  | "aura"
  | "take_item"
  | "pay_gold"
  | "pay_charisma";

/** 獎勵／交付物解析出的連結資料（依 type 只會填其中一種）。 */
export interface RewardResolved {
  itemName?: string;
  itemIcon?: EntityImage | null;
  heroId?: number;
  heroName?: string;
  magicId?: number;
  level?: number;
  magicName?: string | null;
}

/** 一筆獎勵或交付物（mission_rewards / item_box_rewards 共用形狀）。 */
export interface Reward {
  type: RewardType;
  refId: number | null;
  qty: number | null;
  durationMin: number | null;
  resolved: RewardResolved;
}

/** getMissionLogic 回傳的完整任務邏輯。 */
export interface MissionLogic {
  acceptNpcs: string[];
  completeNpcs: string[];
  timers: MissionTimer[];
  requirementGroups: MissionRequirementGroup[];
  flow: MissionFlowStep[];
  rewards: Reward[];
  deliveries: Reward[];
}

/** item_box_rewards 依 (grant_msg_id, grant_trigger_idx) 分組的一次開箱結果。 */
export interface ItemBoxGrant {
  choicePath: string | null;
  rewards: Reward[];
}

/** 禮盒內容樹的一筆獎勵；本身也是禮盒時帶 contents（超過深度或循環時為 null）。 */
export interface BoxRewardNode extends Reward {
  contents: ItemBoxOption[] | null;
}

/**
 * 道具頁用的開箱選項：同 choicePath 的 grant 已合併、同 grant 內相同道具已加總數量。
 * choicePath 為 null 表示無選單（多組時代表依條件而定的不同結果）。
 */
export interface ItemBoxOption {
  choicePath: string | null;
  rewards: BoxRewardNode[];
}

/** 某任務獎勵此道具的精簡列（給道具頁反查用）。 */
export interface MissionRewardingItem {
  missionId: number;
  missionName: string | null;
  qty: number | null;
  durationMin: number | null;
}

/** 某任務會收走此道具的精簡列（給道具頁反查用）。 */
export interface MissionTakingItem {
  missionId: number;
  missionName: string | null;
  qty: number | null;
}

/** 含此道具的禮盒（給道具頁反查用）。 */
export interface BoxContainingItem {
  boxItemId: number;
  boxItemName: string | null;
  boxIcon: EntityImage | null;
  qty: number | null;
  durationMin: number | null;
  choicePath: string | null;
}

/** 英雄符令來源（禮盒或任務獎勵）。 */
export interface HeroTokenSource {
  kind: "box" | "mission";
  /** kind="box" 時為禮盒道具 id；kind="mission" 時為任務 id。 */
  id: number;
  name: string | null;
  qty: number | null;
  choicePath: string | null;
}
