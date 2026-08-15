import { getDb } from "@/lib/db";
import { itemAttributeNames } from "@/lib/constants/i18n";
import { MAX_COMPOUND_PLAYER_LEVEL } from "@/lib/constants/compound";
import type {
  Compound,
  CompoundGroup,
  CompoundMaterialItem,
  CompoundModProb,
  CompoundRow,
  EquipmentSlotKind,
} from "@/lib/types/compound";
import { EQUIPMENT_SLOT_LABELS } from "@/lib/types/compound";

const COMPOUND_COLS = `id, type, name, level, "group", money,
  material_core_id, material_core_amount, material_items,
  fail_item_id, fail_item_amount,
  mod_count_min, mod_count_max, mod_prob, equip_crash, help`;

export function parseMaterialItems(raw: string | null): CompoundMaterialItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is { id: number; amount: number | null } =>
        typeof e === "object" && e !== null && typeof (e as { id: unknown }).id === "number",
      )
      .map((e) => ({ id: e.id, amount: e.amount ?? null }));
  } catch {
    return [];
  }
}

export function parseModProb(raw: string | null): CompoundModProb[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is CompoundModProb =>
        typeof e === "object" && e !== null && typeof (e as { type: unknown }).type === "string",
      )
      .map((e) => ({
        type: e.type,
        min: e.min ?? null,
        max: e.max ?? null,
        prob: e.prob ?? null,
      }));
  } catch {
    return [];
  }
}

export function rowToCompound(row: CompoundRow): Compound {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    level: row.level,
    group: row.group,
    money: row.money,
    materialCoreId: row.material_core_id,
    materialCoreAmount: row.material_core_amount,
    materialItems: parseMaterialItems(row.material_items),
    failItemId: row.fail_item_id,
    failItemAmount: row.fail_item_amount,
    modCountMin: row.mod_count_min,
    modCountMax: row.mod_count_max,
    modProb: parseModProb(row.mod_prob),
    equipCrash: Boolean(row.equip_crash),
    help: row.help,
  };
}

export function getCompoundGroups(): CompoundGroup[] {
  const db = getDb();
  return db
    .prepare(`SELECT id, name FROM compound_groups ORDER BY id`)
    .all() as CompoundGroup[];
}

export function getCompoundGroupById(id: number): CompoundGroup | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT id, name FROM compound_groups WHERE id = ?`)
    .get(id) as CompoundGroup | undefined;
  return row ?? null;
}

export function getCompoundById(id: number): Compound | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT ${COMPOUND_COLS} FROM compounds WHERE id = ?`)
    .get(id) as CompoundRow | undefined;
  return row ? rowToCompound(row) : null;
}

export function getCompoundsByGroup(groupId: number): Compound[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT ${COMPOUND_COLS} FROM compounds WHERE "group" = ? ORDER BY id`)
    .all(groupId) as CompoundRow[];
  return rows.map(rowToCompound);
}

export function getCompoundsByType(type: string): Compound[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT ${COMPOUND_COLS} FROM compounds WHERE type = ? ORDER BY id`)
    .all(type) as CompoundRow[];
  return rows.map(rowToCompound);
}

/** 找出哪些 compound 會把指定 itemId 當主材料消耗（用於「這個道具能煉化什麼」）。 */
export function getCompoundsByCoreMaterial(itemId: number): Compound[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT ${COMPOUND_COLS} FROM compounds WHERE material_core_id = ? ORDER BY id`)
    .all(itemId) as CompoundRow[];
  return rows.map(rowToCompound);
}

/**
 * 把 INI 的 ITEM_BONUS_* 常數對應到 items 欄位 key（i18n.ts 的 itemAttributeNames key）。
 * 譯名以 i18n.ts 為唯一來源，避免多處不同步。
 * 注意：EARTH_DEF → tree（木抗，非土抗）、LIGHTNING_DEF → thunder、MP → mp（真氣）。
 */
const BONUS_TO_ATTR_KEY: Record<string, string> = {
  ITEM_BONUS_DEF: "def",
  ITEM_BONUS_MDEF: "mdef",
  ITEM_BONUS_ATK: "atk",
  ITEM_BONUS_MATK: "matk",
  ITEM_BONUS_HP: "hp",
  ITEM_BONUS_MP: "mp",
  ITEM_BONUS_DODGE: "dodge",
  ITEM_BONUS_HIT: "hit",
  ITEM_BONUS_CRITICAL: "critical",
  ITEM_BONUS_UNCANNYDODGE: "uncanny_dodge",
  ITEM_BONUS_STR: "str",
  ITEM_BONUS_VIT: "vit",
  ITEM_BONUS_DEX: "dex",
  ITEM_BONUS_AGI: "agi",
  ITEM_BONUS_POW: "pow",
  ITEM_BONUS_WIS: "wis",
  ITEM_BONUS_FIRE_DEF: "fire",
  ITEM_BONUS_WATER_DEF: "water",
  ITEM_BONUS_EARTH_DEF: "tree",
  ITEM_BONUS_LIGHTNING_DEF: "thunder",
};

export function bonusLabel(bonusType: string): string | undefined {
  if (bonusType === "ITEM_BONUS_CREATEITEM") return "產出";
  const attrKey = BONUS_TO_ATTR_KEY[bonusType];
  return attrKey ? itemAttributeNames[attrKey] : undefined;
}

/**
 * 裝備強化可用的 20 種 ITEM_BONUS_* 清單（宣告順序即 UI 選單順序）。
 * 不含 ITEM_BONUS_CREATEITEM——那是飾品還原的產出型條目，不是裝備加成。
 */
export const ENHANCEMENT_BONUS_TYPES: readonly string[] = Object.keys(BONUS_TO_ATTR_KEY);

/**
 * 產出條目的種類：決定 UI 怎麼渲染數值欄。
 * - "item"  ：產出物品（label = 物品名、itemId 有值；min/max = 數量範圍）
 * - "bonus" ：裝備加成屬性（label = 屬性中文、itemId = null；min/max = 加值範圍 +N）
 * - "raw"   ：未識別 type，照字串顯示
 */
export type CompoundOutputKind = "item" | "bonus" | "raw";

export interface CompoundOutput {
  /** 原始 type：ITEM_BONUS_* 或 item id 字串 */
  rawType: string;
  kind: CompoundOutputKind;
  /** 顯示用：物品名 / 屬性中文 / 原始 type */
  label: string;
  /** kind === "item" 時的物品 id；否則 null */
  itemId: number | null;
  /** kind 決定語意：item → 數量；bonus → 加值大小 */
  min: number | null;
  max: number | null;
  /** 百萬分制 (1,000,000 = 100%) */
  prob: number;
}

export interface CompoundMaterial {
  id: number;
  name: string;
  amount: number | null;
}

export interface CompoundUse {
  id: number;
  name: string | null;
  type: string;
  groupName: string | null;
  level: number | null;
  money: number | null;
  /** 主材料（id, 名稱, 數量） */
  coreMaterial: CompoundMaterial | null;
  sideMaterials: CompoundMaterial[];
  failItem: CompoundMaterial | null;
  outputs: CompoundOutput[];
  modCountMin: number | null;
  modCountMax: number | null;
  equipCrash: boolean;
  help: string | null;
}

type EnrichedCompoundRow = CompoundRow & {
  group_id: number | null;
  group_name: string | null;
  fail_item_name: string | null;
  core_name: string | null;
};

const ENRICHED_COMPOUND_SELECT = `c.id, c.type, c.name, c.level, c."group" AS group_id, c.money,
        c.material_core_id, c.material_core_amount, c.material_items,
        c.fail_item_id, c.fail_item_amount,
        c.mod_count_min, c.mod_count_max, c.mod_prob,
        c.equip_crash, c.help,
        g.name AS group_name,
        fi.name AS fail_item_name,
        ci.name AS core_name`;

const ENRICHED_COMPOUND_FROM = `compounds c
       LEFT JOIN compound_groups g ON g.id = c."group"
       LEFT JOIN items fi ON fi.id = c.fail_item_id
       LEFT JOIN items ci ON ci.id = c.material_core_id`;

function isSlotKind(id: number): id is EquipmentSlotKind {
  return id >= 1 && id <= 5;
}

function enrichCompoundRows(rows: EnrichedCompoundRow[]): CompoundUse[] {
  if (rows.length === 0) return [];

  const db = getDb();
  // 收集所有需要回查名稱的 item id：副材料、數字型 mod_prob.type、CREATEITEM 的 min(=產出物品 id)
  const idsToLookup = new Set<number>();
  const parsedRows = rows.map((r) => {
    const sides = parseMaterialItems(r.material_items);
    const probs = parseModProb(r.mod_prob);
    const isEquipment = r.type === "ITEM_COMPOUND_EQUIPMENT";
    for (const s of sides) {
      // ITEM_COMPOUND_EQUIPMENT 的 sideMaterial id ∈ {1..5} 是裝備槽代碼（武器/帽/衣/鞋/飾品），不是 item id
      if (isEquipment && isSlotKind(s.id)) continue;
      idsToLookup.add(s.id);
    }
    for (const p of probs) {
      const n = Number(p.type);
      if (Number.isInteger(n) && n > 0) idsToLookup.add(n);
      if (p.type === "ITEM_BONUS_CREATEITEM" && p.min != null && p.min > 0) {
        idsToLookup.add(p.min);
      }
    }
    return { row: r, sides, probs, isEquipment };
  });

  const nameById = new Map<number, string>();
  if (idsToLookup.size > 0) {
    const placeholders = Array.from({ length: idsToLookup.size }, () => "?").join(",");
    const items = db
      .prepare(`SELECT id, name FROM items WHERE id IN (${placeholders})`)
      .all(...idsToLookup) as Array<{ id: number; name: string }>;
    for (const it of items) nameById.set(it.id, it.name);
  }

  return parsedRows.map(({ row, sides, probs, isEquipment }) => {
    const sideMaterials: CompoundMaterial[] = sides.map((s) => {
      if (isEquipment && isSlotKind(s.id)) {
        return { id: s.id, name: EQUIPMENT_SLOT_LABELS[s.id], amount: s.amount };
      }
      return {
        id: s.id,
        name: nameById.get(s.id) ?? `#${s.id}`,
        amount: s.amount,
      };
    });

    const failItem: CompoundMaterial | null =
      row.fail_item_id != null
        ? {
            id: row.fail_item_id,
            name: row.fail_item_name ?? nameById.get(row.fail_item_id) ?? `#${row.fail_item_id}`,
            amount: row.fail_item_amount,
          }
        : null;

    const outputs: CompoundOutput[] = probs
      .filter((p) => p.type !== "0" && (p.prob ?? 0) > 0)
      .map((p): CompoundOutput => {
        const numeric = Number(p.type);
        const isItemId = Number.isInteger(numeric) && numeric > 0;

        if (isItemId) {
          return {
            rawType: p.type,
            kind: "item",
            label: nameById.get(numeric) ?? `#${numeric}`,
            itemId: numeric,
            min: p.min,
            max: p.max,
            prob: p.prob ?? 0,
          };
        }

        // ITEM_BONUS_CREATEITEM: min/max 是產出物品 id（不是數量）
        if (p.type === "ITEM_BONUS_CREATEITEM" && p.min != null && p.min > 0) {
          return {
            rawType: p.type,
            kind: "item",
            label: nameById.get(p.min) ?? `#${p.min}`,
            itemId: p.min,
            min: 1,
            max: 1,
            prob: p.prob ?? 0,
          };
        }

        const label = bonusLabel(p.type);
        return {
          rawType: p.type,
          kind: label ? "bonus" : "raw",
          label: label ?? p.type,
          itemId: null,
          min: p.min,
          max: p.max,
          prob: p.prob ?? 0,
        };
      })
      .sort((a, b) => b.prob - a.prob);

    const coreMaterial: CompoundMaterial | null =
      row.material_core_id != null
        ? {
            id: row.material_core_id,
            name: row.core_name ?? nameById.get(row.material_core_id) ?? `#${row.material_core_id}`,
            amount: row.material_core_amount,
          }
        : null;

    return {
      id: row.id,
      type: row.type,
      name: row.name,
      groupName: row.group_name,
      level: row.level,
      money: row.money,
      coreMaterial,
      sideMaterials,
      failItem,
      outputs,
      modCountMin: row.mod_count_min,
      modCountMax: row.mod_count_max,
      equipCrash: Boolean(row.equip_crash),
      help: row.help,
    };
  });
}

/** 給定 groupId，回傳該群組內全部配方（enriched，已附 group/材料/產出名稱）。 */
export function getCompoundsByGroupEnriched(groupId: number): CompoundUse[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT ${ENRICHED_COMPOUND_SELECT}
       FROM ${ENRICHED_COMPOUND_FROM}
       WHERE c."group" = ?
       ORDER BY c.level NULLS LAST, c.id`,
    )
    .all(groupId) as EnrichedCompoundRow[];
  return enrichCompoundRows(rows);
}

export interface CompoundGroupStats {
  id: number;
  name: string | null;
  count: number;
  /** 配方 type 分佈，e.g. {ITEM_COMPOUND_EQUIPMENT: 182, ITEM_COMPOUND_ITEM: 5} */
  typeBreakdown: Record<string, number>;
  /** 配方 level 範圍（最小、最大）；無 level 的配方不計入。 */
  minLevel: number | null;
  maxLevel: number | null;
}

/**
 * 列出所有 compound_groups 並附上每個 group 的概覽 stats。
 * 用於配方目錄頁 (`/compounds`)。
 */
export function getAllCompoundGroupsWithStats(): CompoundGroupStats[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT g.id, g.name,
              c.type AS ctype,
              COUNT(c.id) AS cnt,
              MIN(CASE WHEN c.level <= ${MAX_COMPOUND_PLAYER_LEVEL} THEN c.level END) AS lmin,
              MAX(CASE WHEN c.level <= ${MAX_COMPOUND_PLAYER_LEVEL} THEN c.level END) AS lmax
       FROM compound_groups g
       LEFT JOIN compounds c ON c."group" = g.id
       GROUP BY g.id, g.name, c.type
       ORDER BY g.id`,
    )
    .all() as Array<{
      id: number;
      name: string | null;
      ctype: string | null;
      cnt: number;
      lmin: number | null;
      lmax: number | null;
    }>;

  const byId = new Map<number, CompoundGroupStats>();
  for (const r of rows) {
    let stats = byId.get(r.id);
    if (!stats) {
      stats = {
        id: r.id,
        name: r.name,
        count: 0,
        typeBreakdown: {},
        minLevel: null,
        maxLevel: null,
      };
      byId.set(r.id, stats);
    }
    if (r.ctype != null && r.cnt > 0) {
      stats.typeBreakdown[r.ctype] = (stats.typeBreakdown[r.ctype] ?? 0) + r.cnt;
      stats.count += r.cnt;
      if (r.lmin != null) {
        stats.minLevel =
          stats.minLevel == null ? r.lmin : Math.min(stats.minLevel, r.lmin);
      }
      if (r.lmax != null) {
        stats.maxLevel =
          stats.maxLevel == null ? r.lmax : Math.max(stats.maxLevel, r.lmax);
      }
    }
  }
  return [...byId.values()];
}

/**
 * 給定一個 itemId，回傳「以此物品為主材料」的所有煉化配方。
 * 用於「這個道具能煉化什麼」的反查（item detail 頁的「煉化用途」段落）。
 */
export function getCompoundUsesForItem(itemId: number): CompoundUse[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT ${ENRICHED_COMPOUND_SELECT}
       FROM ${ENRICHED_COMPOUND_FROM}
       WHERE c.material_core_id = ?
       ORDER BY g.id NULLS LAST, c.id`,
    )
    .all(itemId) as EnrichedCompoundRow[];
  return enrichCompoundRows(rows);
}

/**
 * 將 items.type_name（英文列舉）對應到 ITEM_COMPOUND_EQUIPMENT 的裝備槽代碼。
 * 注意：盾在資料層歸屬於 ARMOR slot（group 80「衣、盾強化」），雖然視覺分類常被歸為武器。
 * 不在此 map 內的 type（座騎/背飾/寵物飾/外裝等）皆無對應強化配方。
 * ORNAMENT：舊的左飾/中飾/右飾已於 items 表併為單一 type_code，故合併對應單一飾品 slot。
 */
const EQUIPMENT_SLOT_BY_TYPE: Record<string, EquipmentSlotKind> = {
  // 武器類
  BLADE: 1,
  SWORD: 1,
  STING: 1,
  BOXING: 1,
  PUNCHER: 1,
  STAFF: 1,
  CLAW: 1,
  GREAT_SWORD: 1,
  WHISK: 1,
  BOW: 1,
  ROD: 1,
  HAMMER: 1,
  HIDDEN_WEAPON: 1,
  // 帽
  HELMET: 2,
  // 衣（含盾）
  ARMOR: 3,
  SHIELD: 3,
  // 鞋
  BOOT: 4,
  // 飾品
  ORNAMENT: 5,
};

export function getEquipmentSlotForType(itemType: string | null): EquipmentSlotKind | null {
  if (!itemType) return null;
  return EQUIPMENT_SLOT_BY_TYPE[itemType] ?? null;
}

/**
 * 給定裝備的 items.type，回傳「可在此裝備上施加的所有真元/魂石強化配方」。
 * 規則：ITEM_COMPOUND_EQUIPMENT 配方的 material_items[0].id 是裝備槽代碼（1-5），與 items.type 對應。
 * 同槽位裝備皆通用（沒有等級鎖、沒有單品白名單）。
 */
export function getEquipmentEnhancementsForItemType(itemType: string | null): CompoundUse[] {
  const slot = getEquipmentSlotForType(itemType);
  if (slot == null) return [];
  const db = getDb();
  // EQUIPMENT 配方的 material_items 永遠是單一槽代碼 — 用精確字串比對最簡單可靠
  const slotJson = `[{"id":${slot},"amount":1}]`;
  const rows = db
    .prepare(
      `SELECT ${ENRICHED_COMPOUND_SELECT}
       FROM ${ENRICHED_COMPOUND_FROM}
       WHERE c.type = 'ITEM_COMPOUND_EQUIPMENT' AND c.material_items = ?
       ORDER BY g.id NULLS LAST, c.level, c.id`,
    )
    .all(slotJson) as EnrichedCompoundRow[];
  return enrichCompoundRows(rows);
}

/**
 * 給定一個 itemId，回傳「會煉化產出此物品」的所有配方。
 * 涵蓋兩種出口：
 *   1. mod_prob.type = "<itemId>"          （數字型 type，直接產出該 item）
 *   2. mod_prob.type = ITEM_BONUS_CREATEITEM 且 min === itemId （飾品還原型 recipe）
 * 用於「這個道具怎麼來」的反查（item detail 頁的「煉化來源」段落）。
 */
export function getCompoundSourcesForItem(itemId: number): CompoundUse[] {
  const db = getDb();
  // LIKE 預過濾：欄位是固定 JSON 結構，所以這兩個 pattern 不會誤判（單純為了減少 row 數）
  const numericPattern = `%"type":"${itemId}",%`;
  const createItemPattern = `%"type":"ITEM_BONUS_CREATEITEM","min":${itemId},"max":${itemId},%`;
  const rows = db
    .prepare(
      `SELECT ${ENRICHED_COMPOUND_SELECT}
       FROM ${ENRICHED_COMPOUND_FROM}
       WHERE c.mod_prob LIKE ? OR c.mod_prob LIKE ?
       ORDER BY g.id NULLS LAST, c.id`,
    )
    .all(numericPattern, createItemPattern) as EnrichedCompoundRow[];

  // 還是要二次驗證：parse mod_prob 後確認真的有 output 對應 itemId（避免極端 LIKE 誤判）
  return enrichCompoundRows(rows).filter((u) =>
    u.outputs.some((o) => o.itemId === itemId),
  );
}

// ─── 屬性導向強化查詢（/tools/enhance） ──────────────────────────────────────

/** 強化配方家族。`all` 只用於查詢條件，不會出現在結果上。 */
export type EnhancementFamily = "all" | "yuan" | "pearl" | "stone" | "other";

export type EnhancementSort = "bonus" | "probability" | "materials";

export interface EnhancementSearch {
  bonusType: string;
  family: EnhancementFamily;
  /** null = 全部槽位 */
  slot: EquipmentSlotKind | null;
}

/**
 * 同一配方對同一屬性的多個級距合併後的結果。
 * 例：吉魂珠強化(10742) 的 ATK 是 +10~15/15~20/20~25/25~30 四段，
 * 合併後為 +10~30、機率 700,000（70%）、segments 4。
 * 只讀 outputs[0] 會得到「+10~15、25%」這種錯誤答案。
 */
export interface MergedBonus {
  rawType: string;
  label: string;
  /** 所有級距的最小加值 */
  min: number;
  /** 所有級距的最大加值 */
  max: number;
  /** 各級距機率總和，百萬分制（1,000,000 = 100%），clamp 於上限 */
  prob: number;
  /** 級距數，供 UI 標示「分 N 段」 */
  segments: number;
}

export interface EnhancementResult {
  use: CompoundUse;
  target: MergedBonus;
  family: Exclude<EnhancementFamily, "all">;
  /** material_core_amount ÷ 合併機率；無法計算時為 null（不得當成 0） */
  expectedMaterials: number | null;
}

/** 百萬分制機率上限。合併後理論上不會超過，超出視為資料異常並取上限（不 throw）。 */
const PROB_SCALE = 1_000_000;

/**
 * 依配方名稱關鍵字判定家族。
 *
 * 不可用 `group` range：104 筆魂珠與 180 筆「其他」都混在真元的 group 70–110 內，
 * 用 group 二分會誤標 284 筆。
 *
 * 判定順序不可調換：「魂石」與「魂珠」都含「魂」，必須先比完整詞。
 */
export function enhancementFamily(name: string | null): Exclude<EnhancementFamily, "all"> {
  const n = name ?? "";
  if (n.includes("魂石")) return "stone";
  if (n.includes("魂珠")) return "pearl";
  if (n.includes("真元")) return "yuan";
  return "other";
}

/**
 * 把同一配方中屬於 `rawType` 的所有級距合併成單一結果。
 * 沒有任何有效級距時回傳 null。
 */
export function mergeBonus(outputs: CompoundOutput[], rawType: string): MergedBonus | null {
  const segs = outputs.filter(
    (o) =>
      o.kind === "bonus" &&
      o.rawType === rawType &&
      o.prob > 0 &&
      Number.isFinite(o.min) &&
      Number.isFinite(o.max),
  );
  if (segs.length === 0) return null;

  const totalProb = segs.reduce((sum, s) => sum + s.prob, 0);
  return {
    rawType,
    label: segs[0].label,
    min: Math.min(...segs.map((s) => s.min as number)),
    max: Math.max(...segs.map((s) => s.max as number)),
    // 現行資料 0 筆超出上限，clamp 只是防止日後資料異常導致期望顆數 < 1
    prob: Math.min(totalProb, PROB_SCALE),
    segments: segs.length,
  };
}

/**
 * 期望消耗材料顆數 = material_core_amount ÷ 合併後機率。
 * `material_core_amount` 目前 1,026 筆全為 1，但仍讀欄位而非寫死，避免日後資料變動時默默算錯。
 */
function expectedMaterialCount(amount: number | null | undefined, prob: number): number | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  if (!(prob > 0)) return null;
  return amount / (prob / PROB_SCALE);
}

/**
 * 依「想要的屬性」反查所有能提供該屬性的裝備強化配方。
 *
 * 與 `getEquipmentEnhancementsForItemType()` 方向相反（那是 itemType → slot → 配方），
 * 故另開 sibling query 而非逐槽呼叫。
 *
 * family 來自配方 name，無法下推 SQL，於 TS 端過濾（資料量固定 1,026 筆）。
 */
export function getEnhancementsByBonus(search: EnhancementSearch): EnhancementResult[] {
  const db = getDb();
  // LIKE 只是預過濾，減少送進 JSON.parse 的 row 數；正確性由下方 mergeBonus 二次驗證。
  const likePattern = `%"type":"${search.bonusType}",%`;
  const conditions = [`c.type = 'ITEM_COMPOUND_EQUIPMENT'`, `c.mod_prob LIKE ?`];
  const args: Array<string> = [likePattern];
  if (search.slot != null) {
    // EQUIPMENT 配方的 material_items 永遠是單一槽代碼，與 getEquipmentEnhancementsForItemType 同一比對方式
    conditions.push(`c.material_items = ?`);
    args.push(`[{"id":${search.slot},"amount":1}]`);
  }

  const rows = db
    .prepare(
      `SELECT ${ENRICHED_COMPOUND_SELECT}
       FROM ${ENRICHED_COMPOUND_FROM}
       WHERE ${conditions.join(" AND ")}
       ORDER BY c.id`,
    )
    .all(...args) as EnrichedCompoundRow[];

  const results: EnhancementResult[] = [];
  for (const use of enrichCompoundRows(rows)) {
    const target = mergeBonus(use.outputs, search.bonusType);
    if (!target) continue;
    const family = enhancementFamily(use.name);
    if (search.family !== "all" && family !== search.family) continue;
    results.push({
      use,
      target,
      family,
      expectedMaterials: expectedMaterialCount(use.coreMaterial?.amount, target.prob),
    });
  }
  return results;
}

/** null 排最後；兩者皆 null 視為同分。 */
function compareNullableAsc(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

/**
 * 三種排序皆只讀「合併後的目標屬性」，不得讀 outputs[0]。
 * 每條鏈都以 id 收尾確保可重現。
 */
export function sortEnhancements(
  results: EnhancementResult[],
  sort: EnhancementSort,
): EnhancementResult[] {
  const chains: Record<EnhancementSort, Array<(r: EnhancementResult) => number | null>> = {
    // 玩家先問「哪顆加最多」；max 同分時比保底 min，避免大範圍配方被誤認為穩定高值
    bonus: [(r) => -r.target.max, (r) => -r.target.min, (r) => -r.target.prob, (r) => r.expectedMaterials],
    probability: [(r) => -r.target.prob, (r) => -r.target.max, (r) => -r.target.min, (r) => r.expectedMaterials],
    materials: [(r) => r.expectedMaterials, (r) => -r.target.prob, (r) => -r.target.max, (r) => -r.target.min],
  };
  const keys = chains[sort];
  return [...results].sort((a, b) => {
    for (const key of keys) {
      const d = compareNullableAsc(key(a), key(b));
      if (d !== 0) return d;
    }
    return a.use.id - b.use.id;
  });
}

export const DEFAULT_ENHANCEMENT_SEARCH: EnhancementSearch & { sort: EnhancementSort } = {
  bonusType: "ITEM_BONUS_ATK",
  family: "all",
  slot: null,
  sort: "bonus",
};

const ENHANCEMENT_FAMILIES: readonly EnhancementFamily[] = [
  "all",
  "yuan",
  "pearl",
  "stone",
  "other",
];
const ENHANCEMENT_SORTS: readonly EnhancementSort[] = ["bonus", "probability", "materials"];

export type EnhancementSearchParams = Record<string, string | string[] | undefined>;

export type ParsedEnhancementSearch =
  | { ok: true; search: EnhancementSearch; sort: EnhancementSort }
  | { ok: false; errors: string[] };

/**
 * GET query string 的 trust boundary。
 * 缺值或空字串取預設；任一值無效即整體失敗，呼叫端不得執行任何 DB query。
 * 不做大小寫修正、模糊比對或未知值靜默 fallback。
 */
export function parseEnhancementSearchParams(
  params: EnhancementSearchParams,
): ParsedEnhancementSearch {
  const errors: string[] = [];

  // 重複參數形成的 array 一律拒絕，不取第一個值
  const single = (key: string, label: string): string | undefined => {
    const raw = params[key];
    if (raw === undefined) return undefined;
    if (Array.isArray(raw)) {
      errors.push(`${label}參數重複，請只提供一個值。`);
      return undefined;
    }
    return raw.trim() === "" ? undefined : raw;
  };

  const rawAttribute = single("attribute", "屬性");
  const rawFamily = single("family", "家族");
  const rawSlot = single("slot", "槽位");
  const rawSort = single("sort", "排序");

  let bonusType = DEFAULT_ENHANCEMENT_SEARCH.bonusType;
  if (rawAttribute !== undefined) {
    if (ENHANCEMENT_BONUS_TYPES.includes(rawAttribute)) bonusType = rawAttribute;
    else errors.push(`屬性「${rawAttribute}」不是可查詢的強化屬性。`);
  }

  let family = DEFAULT_ENHANCEMENT_SEARCH.family;
  if (rawFamily !== undefined) {
    if ((ENHANCEMENT_FAMILIES as string[]).includes(rawFamily)) {
      family = rawFamily as EnhancementFamily;
    } else {
      errors.push(`家族「${rawFamily}」不是合法選項。`);
    }
  }

  let slot = DEFAULT_ENHANCEMENT_SEARCH.slot;
  if (rawSlot !== undefined && rawSlot !== "all") {
    // 只接受 1–5 的單一數字；擋掉 "01"、"1.0"、"0"、"6"、" 1"、非數字
    if (/^[1-5]$/.test(rawSlot)) slot = Number(rawSlot) as EquipmentSlotKind;
    else errors.push(`槽位「${rawSlot}」不是合法選項。`);
  }

  let sort = DEFAULT_ENHANCEMENT_SEARCH.sort;
  if (rawSort !== undefined) {
    if ((ENHANCEMENT_SORTS as string[]).includes(rawSort)) sort = rawSort as EnhancementSort;
    else errors.push(`排序「${rawSort}」不是合法選項。`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, search: { bonusType, family, slot }, sort };
}
