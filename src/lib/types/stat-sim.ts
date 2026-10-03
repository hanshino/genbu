export const ATTRIBUTE_KEYS = ["str", "pow", "vit", "agi", "dex", "wis"] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type Attributes = Record<AttributeKey, number>;

export const STAT_KEYS = [
  "hp",
  "mp",
  ...ATTRIBUTE_KEYS,
  "atk",
  "matk",
  "def",
  "mdef",
  "hit",
  "dodge",
  "critical",
  "uncanny_dodge",
  "attack_speed",
  "run_speed",
  "weight",
] as const;
export type StatKey = (typeof STAT_KEYS)[number];
/** 使用 app 的 def / mdef / critical 別名；省略的項目視為 0。 */
export type PanelBonus = Partial<Record<StatKey, number>>;
export type PanelStatKey = Exclude<StatKey, AttributeKey | "weight"> | "weight_cap";

export const EQUIP_SLOTS = [
  "cap",
  "body",
  "foot",
  "right",
  "left",
  "wing",
  "horse",
  "ornament1",
  "ornament2",
  "ornament3",
] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];

/** sect.ini 的單一主門派 bitflag，不是 magic.clan。 */
export type SectId = 2 | 4 | 8 | 512 | 2048 | 4096 | 8192;
export const SUB_SECT_CLANS = ["CLASS_GOD", "CLASS_SHAULIN", "CLASS_ISLE", "CLASS_MAGIC"] as const;
export type SubSectClan = (typeof SUB_SECT_CLANS)[number];

export interface EquippedItem {
  itemId: number;
  enhancementLevel: number;
  /** 舊版手動合計（鑲嵌＋隨機），仍會計入；新存檔改用 randomRolls / sockets，UI 可清除。 */
  manualBonuses: PanelBonus;
  /** 遊戲中實際出現的隨機素質；只列出勾選的，attribute 為 SimRandomOption.attribute。 */
  randomRolls?: RandomRoll[];
  /** 長度 ≤ SimItem.socketCount；null 為空槽。 */
  sockets?: (SocketFill | null)[];
}

export interface RandomRoll {
  attribute: string;
  value: number;
}

export interface SocketFill {
  recipeId: number;
  /** 配方實際抽中的屬性（多屬性配方由玩家選）。 */
  stat: StatKey;
  value: number;
}

/** 合法區間，閉區間 [min, max]；同屬性可有多段（取聯集）。 */
export type ValueRange = [number, number];

export interface SimRandomOption {
  /** item_rand.attribute 原文（中文），作為 RandomRoll.attribute。 */
  attribute: string;
  stat: StatKey;
  ranges: ValueRange[];
}

export interface SocketRecipe {
  id: number;
  name: string;
  /** 可能的結果；不含「無效果」。 */
  effects: Array<{ stat: StatKey; ranges: ValueRange[] }>;
}

export interface CharacterV1 {
  version: 1;
  id: string;
  name: string;
  sectId: SectId;
  /** 最多兩個且不可重複，由輸入／載入端驗證。 */
  subSects: SubSectClan[];
  level: number;
  /** 整數 0 或 10–140；level > 140 時必須為 40–140。 */
  rebirthPoints: number;
  /** 輸入輔助：最多四筆，每筆 100–140；編輯後換算並同步 rebirthPoints。 */
  rebirthLevels?: number[];
  /** 裸六圍，每項從 1 起；含裝輸入須先扣除所有非裸值加成（含被動）。 */
  attributes: Attributes;
  equipment: Record<EquipSlot, EquippedItem | null>;
  /** magic id → 等級，含收藏 1151–1159；未列出的技能視為 0 級。 */
  passiveLevels: Record<number, number>;
  /** 保留 encodePlan 字串；v1 不計入，非空時由引擎回報提示。 */
  meridianPlan: string | null;
  /** 直接加到最終值，不經六圍公式放大。other 是讀不到來源的加成（如伺服器端給角色的體力）；舊存檔沒有。 */
  manual: { hero: PanelBonus; formation: PanelBonus; other?: PanelBonus };
}

export interface CharacterStore {
  version: 1;
  /** 空角色清單時為 null，否則須指向清單中的 id。 */
  activeCharacterId: string | null;
  characters: CharacterV1[];
}

export interface SimItem {
  id: number;
  name: string;
  level: number;
  /** 原始 items.type_name，用於武器條件及攻速規則。 */
  typeName: string | null;
  /** 建議欄位，可包含多格飾品；null 表示未知，不代表已驗證可裝備。 */
  slotHint: EquipSlot[] | null;
  iconUrl?: string | null;
  /** weight 是道具重量，計算時加入負重上限。 */
  stats: PanelBonus;
  strongPathId: number | null;
  /** 省略或空陣列表示沒有隨機素質。 */
  randomOptions?: SimRandomOption[];
  /** 最大槽數：item_rand_counts.comp_count_max，無該列時退回 items.compound_number。空槽不影響計算，故 UI 一律顯示到最大。 */
  socketCount?: number;
  /** item_rand_counts.comp_count_min（槽數下限，僅供提示）。 */
  socketMin?: number;
  /** item_rand_counts.mod_count_min/max：實際出現的隨機素質條數，max 已截到 randomOptions 長度。 */
  randomCount?: [number, number];
  /** compounds 裝備類別 1–5（盾為 3）；null 表示沒有可插配方。 */
  socketCategory?: number | null;
  /** items.damage_min/max；強化、真解不改變，0..0 時省略。 */
  damage?: [number, number];
  /** items.pdamage_min/max（內勁武器傷害，例如拳套）；0..0 時省略。 */
  pdamage?: [number, number];
}

/** magic 的單一等級傷害參數，欄位照 func_dmg_p1..p4 原值（未除以 100）。 */
export interface DamageSkillLevel {
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  /** magic_learn.char_level；缺少學習資料為 -1。 */
  learnLevel: number;
}

export interface DamageSkillDef {
  id: number;
  /** 最高等級的名稱。 */
  name: string;
  clan: string | null;
  skillType: number | null;
  funcDmg: number;
  iconUrl: string | null;
  /** 索引即等級，0 為 null。 */
  levels: (DamageSkillLevel | null)[];
}

/** 傷害分頁打開時才載入（/api/stat-sim/damage），不放進首頁的 GameData。 */
export interface DamageData {
  skills: DamageSkillDef[];
  monsters: DamageMonster[];
}

/** 傷害試算的目標怪物（npc.is_monster = 1）。 */
export interface DamageMonster {
  id: number;
  name: string;
  level: number;
  extraDef: number;
  magicDef: number;
}

export interface EnhancementPath {
  maxLevel: number;
  /** 索引即 +N，0 為 {}；N 為該級 common + 所有 ≤N 的 bonus，不可再累加。 */
  levels: PanelBonus[];
}

export interface PassiveDef {
  id: number;
  /** 最高可用等級的名稱；各級名稱不同時（嫁衣神功一重～四重、進階劍修練）另見 levelNames。 */
  name: string;
  /** 索引即等級，0 為空字串；只有各級名稱不同時才有。顯示用 passiveName()。 */
  levelNames?: string[];
  group: "main" | "sub" | "common" | "guild" | "collection" | "achievement";
  /** magic.clan 的 CLASS_*；通用技能統一為 null，天外天為 CLASS_SKY。 */
  clan: string | null;
  maxLevel: number;
  /** 已啟用成就的獎勵等級總和；0 表示目前查無取得來源，不更改既有存檔。 */
  obtainableMax?: number;
  /** 索引即技能等級，0 為 0；缺少學習資料填 -1，不可用於「全滿」。 */
  learnLevels: number[];
  iconUrl: string | null;
  /** 索引即等級，0 為 {}；已正規化的總加成（排除 AFFECT_RATIO），不可再累加；Encumbrance 對應 weight。 */
  cumulative: PanelBonus[];
  /** 可生效的 typeName 清單，任一手符合即可；「任何武器」須列出全部武器類型，省略表示無條件。 */
  weaponReq?: string[];
  /** 省略時條件套用整個加成；如禁術修練可只限制 matk，mp 仍無條件生效。 */
  weaponReqStats?: StatKey[];
  note?: string;
}

/** 純 JSON 資料；門派係數、攻速與特殊技能估計規則由 src/configs/ 提供。 */
export interface GameData {
  itemsById: Record<number, SimItem>;
  enhancementsByPath: Record<number, EnhancementPath>;
  /** 包含收藏；經脈不列入，避免重複計算。 */
  passives: PassiveDef[];
  /** 經脈穴位 magic id，來自 magic_meridians；匯入時用來辨識經脈技能。 */
  meridianIds: number[];
  /** 副門派全部技能（含不影響面板、不在 passives 的）magic id → clan；匯入時用來判斷副門派。 */
  subSectSkills?: Record<number, SubSectClan>;
  /** 收藏值門檻，由小到大排序；舊資料未提供時不開放自動換算。 */
  collectionThresholds?: CollectionThreshold[];
  socketRecipes?: Record<number, SocketRecipe>;
  /** 裝備類別 → 可插配方 id。 */
  socketRecipeIdsByCategory?: Record<number, number[]>;
}

export interface CollectionThreshold {
  value: number;
  magicId: number;
  level: number;
}

export interface StatBreakdown {
  source:
    | "attribute"
    | "equipment"
    | "enhancement"
    | "equipManual"
    | "equipRandom"
    | "socket"
    | "passive"
    | "collection"
    | "hero"
    | "formation"
    | "manualOther"
    | "base";
  refId?: number | string;
  label: string;
  amount: number;
}

export interface StatValue {
  /** null 表示無法計算，不能當作 0。 */
  value: number | null;
  breakdown: StatBreakdown[];
  estimated: boolean;
  estimateReasons: string[];
}

export interface Issue {
  code: string;
  severity: "error" | "warning";
  message: string;
  refId?: number | string;
}

export interface PanelResult {
  attributes: Record<AttributeKey, StatValue>;
  stats: Record<PanelStatKey, StatValue>;
  points: {
    levelPoints: number;
    rebirthPoints: number;
    /** 從不含裝值 1 加到目前值的成本；起始值 1 的成本為 0。 */
    costs: Record<AttributeKey, number>;
    totalCost: number;
    remaining: number;
    /** 遊戲「外功+」等欄位：cost(不含裝值 + 1)。 */
    nextCost: Record<AttributeKey, number>;
  };
  issues: Issue[];
}

export interface RebirthInference {
  /** 資料不足時為 null；不合法的推算值保留並以 check 提示。 */
  total: number | null;
  status: "ok" | "check" | "incomplete";
  reasons: string[];
  estimated: boolean;
}

/** 遊戲 UI 視窗（ui_windows + ui_controls），座標為底圖原始 px。 */
export interface UiControl {
  ctrlId: number;
  class: "BASE" | "STATIC" | "BUTTON" | "PROGRESS" | "EDIT";
  title: string | null;
  field: string | null;
  comment: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string | null;
  iconUrl: string | null;
}

export interface UiWindowLayout {
  window: string;
  name: string;
  width: number;
  height: number;
  backgroundUrl: string;
  controls: UiControl[];
  /** ui_equip_slots 的權威位置，不由 controls.comment 推測。 */
  equipSlots?: UiEquipSlot[];
}

export interface UiEquipSlot {
  slot: EquipSlot;
  label: string;
  ctrlId: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
