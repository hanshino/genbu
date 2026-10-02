// 僅供 server 使用，與其他 queries 一樣透過 readonly db.ts 存取 SQLite。
import { getDb } from "@/lib/db";
import { HELP_PASSIVES, WEAPON_TYPE_NAMES } from "@/configs/stat-sim-passives";
import {
  BONUS_TO_ATTR_KEY, getEquipmentSlotForType, mergeBonus, parseMaterialItems, parseModProb,
  type CompoundOutput,
} from "@/lib/queries/compound";
import { labelToKey } from "@/lib/scoring/attribute-alias";
import { getItemIconMap } from "@/lib/queries/images";
import {
  EQUIP_SLOTS, STAT_KEYS, SUB_SECT_CLANS,
  type EquipSlot, type GameData, type PanelBonus, type PassiveDef,
  type SimItem, type StatKey, type UiControl, type UiEquipSlot, type UiWindowLayout, type ValueRange,
} from "@/lib/types/stat-sim";

const ITEM_ALIASES: Partial<Record<StatKey, string>> = {
  def: "extra_def", mdef: "magic_def", critical: "critical_hit",
};
const ITEM_STATS = Object.fromEntries(
  STAT_KEYS.map((key) => [key, ITEM_ALIASES[key] ?? key]),
) as Record<StatKey, string>;

const EQUIP_SLOT_CODES: Record<string, EquipSlot> = {
  CAP: "cap", BODY: "body", FOOT: "foot", WING: "wing", HORSE: "horse",
  HAND_R: "right", HAND_L: "left",
  ORNAMENT_1: "ornament1", ORNAMENT_2: "ornament2", ORNAMENT_3: "ornament3",
};
const SLOT_HINTS: Record<string, EquipSlot[]> = {
  ...Object.fromEntries(Object.entries(EQUIP_SLOT_CODES).map(([code, slot]) => [code, [slot]])),
  "HAND_L,HAND_R": ["right", "left"], HANDS: ["right", "left"],
};

const EQUIPMENT_TYPES = [...WEAPON_TYPE_NAMES, "HELMET", "ARMOR", "BOOT", "WING", "HORSE", "ORNAMENT"];
const TYPE_HINTS: Record<string, EquipSlot[]> = {
  HELMET: ["cap"], ARMOR: ["body"], BOOT: ["foot"], WING: ["wing"], HORSE: ["horse"],
  ORNAMENT: ["ornament1", "ornament2", "ornament3"],
  ...Object.fromEntries(WEAPON_TYPE_NAMES.map((type) => [type, ["right", "left"]])),
};

const MAGIC_STATS: Record<string, StatKey> = {
  HPMAX: "hp", MPMAX: "mp", Atk: "atk", MAtk: "matk", ExtraDef: "def", MagicDef: "mdef",
  Hit: "hit", Dodge: "dodge", Critical: "critical", Encumbrance: "weight",
  Str: "str", Pow: "pow", Vit: "vit", Agi: "agi", Dex: "dex", Wis: "wis",
};

// magic_stats 中不屬於面板的 stat 不映射成 0，而是跳過並寫進 PassiveDef.note。
// 目前非經脈只剩 id=4 的 FireAttack；CLASS_CHILD 保留為 main（不冒充通用技能）。
// 經脈另有 HP/MP（當前值）、回復、元素、抗性等，整個技能由下方 SQL 排除。
const NON_MERIDIAN = `id NOT IN (
  SELECT magic_id FROM magic_learn WHERE is_meridian = 1
  UNION SELECT magic_id FROM magic_meridians
)`;

interface PathRow { id: number; list: string }
interface FormulaRow { id: number; bonus_type: string; bonus_value: string | number | null }
interface PathEntry { level: number; common: number; bonus?: number }

function parsePath(row: PathRow): { max: number; data: PathEntry[] } {
  let parsed: unknown;
  try { parsed = JSON.parse(row.list); }
  catch { throw new Error(`強化路徑 ${row.id}：list 不是合法 JSON`); }
  if (typeof parsed !== "object" || parsed === null || !("max" in parsed) || !("data" in parsed) ||
      !Number.isInteger(parsed.max) || (parsed.max as number) < 1 || !Array.isArray(parsed.data)) {
    throw new Error(`強化路徑 ${row.id}：list 結構無效`);
  }
  const max = parsed.max as number;
  const data: PathEntry[] = [];
  for (const entry of parsed.data) {
    if (typeof entry !== "object" || entry === null ||
        !Number.isInteger(entry.level) || entry.level < 1 || entry.level > max ||
        !Number.isInteger(entry.common) || entry.common <= 0 ||
        (entry.bonus != null && (!Number.isInteger(entry.bonus) || entry.bonus <= 0))) {
      throw new Error(`強化路徑 ${row.id}：等級或配方參照無效`);
    }
    data.push({ level: entry.level, common: entry.common, bonus: entry.bonus ?? undefined });
  }
  data.sort((a, b) => a.level - b.level);
  if (data.length !== max || data.some((entry, i) => entry.level !== i + 1)) {
    throw new Error(`強化路徑 ${row.id}：等級缺漏或重複`);
  }
  return { max, data };
}

function formulaBonus(formula: FormulaRow | undefined, id: number): PanelBonus {
  if (!formula) throw new Error(`查無強化配方 ${id}`);
  const key = BONUS_TO_ATTR_KEY[formula.bonus_type];
  if (!key) throw new Error(`強化配方 ${id}：未知 bonus_type ${formula.bonus_type}`);
  const raw = formula.bonus_value;
  const value = raw == null || (typeof raw === "string" && raw.trim() === "") ? NaN : Number(raw);
  if (!Number.isFinite(value)) throw new Error(`強化配方 ${id}：bonus_value 無效`);
  // StatKey 不含四抗：fire / water / tree / thunder。已知元素強化明確略過；
  // 2026-10-02 實際引用的路徑沒有這四類，日後遇到仍不會混進面板 StatKey。
  if (["fire", "water", "tree", "thunder"].includes(key)) return {};
  if (!(STAT_KEYS as readonly string[]).includes(key)) {
    throw new Error(`強化配方 ${id}：未支援的屬性 ${key}`);
  }
  return value === 0 ? {} : { [key]: value };
}

function addBonus(target: PanelBonus, bonus: PanelBonus) {
  for (const key of STAT_KEYS) {
    if (bonus[key] !== undefined) target[key] = (target[key] ?? 0) + bonus[key]!;
  }
}

/** 整數閉區間取聯集；保留不連續區段，不把洞補成合法值。 */
export function mergeRanges(ranges: ValueRange[]): ValueRange[] {
  const merged: ValueRange[] = [];
  for (const [min, max] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && min <= last[1] + 1) last[1] = Math.max(last[1], max);
    else merged.push([min, max]);
  }
  return merged;
}

function isStatKey(key: string | null | undefined): key is StatKey {
  return (STAT_KEYS as readonly (string | null | undefined)[]).includes(key);
}

/** 一次載入 client 引擎所需的純 JSON；圖片與技能均為批次查詢，沒有逐道具查 DB。 */
export function getStatSimData(): GameData {
  const db = getDb();
  const items = db.prepare(`
    SELECT id, name, base_lv AS level, type_name AS typeName, equip_slot,
           strong_equipment AS strongPathId, compound_number AS socketCount,
           ${STAT_KEYS.map((key) => `${ITEM_STATS[key]} AS ${key}`).join(", ")}
    FROM items WHERE type_name IN (${EQUIPMENT_TYPES.map(() => "?").join(",")})
      AND (equip_slot IN (${Object.keys(SLOT_HINTS).map(() => "?").join(",")})
           OR equip_slot IS NULL OR equip_slot = '')
    ORDER BY id
  `).all(...EQUIPMENT_TYPES, ...Object.keys(SLOT_HINTS)) as Array<
    Omit<SimItem, "stats" | "slotHint"> & { equip_slot: string | null } & Record<StatKey, number | null>
  >;
  // EXTRA_* 是外装、HEAD 是角色頭、type_name=null 是內建紙娃娃，均非這 10 格配裝。
  const icons = getItemIconMap(items.map((item) => item.id));
  const itemsById: GameData["itemsById"] = {};
  const pathIds = new Set<number>();
  for (const row of items) {
    const stats: PanelBonus = {};
    for (const key of STAT_KEYS) {
      const value = row[key];
      if (value != null && value !== 0) stats[key] = value;
    }
    const strongPathId = row.strongPathId && row.strongPathId > 0 ? row.strongPathId : null;
    if (strongPathId !== null) pathIds.add(strongPathId);
    itemsById[row.id] = {
      id: row.id, name: row.name, level: row.level ?? 0, typeName: row.typeName,
      slotHint: SLOT_HINTS[row.equip_slot ?? ""] ?? TYPE_HINTS[row.typeName ?? ""] ?? null,
      iconUrl: icons.get(row.id)?.url ?? null, stats, strongPathId,
      // ponytail: 0 槽省略 optional 欄位，避免每件無槽裝備增加 payload。
      ...(row.socketCount ? {
        socketCount: row.socketCount, socketCategory: getEquipmentSlotForType(row.typeName),
      } : {}),
    };
  }

  for (const row of db.prepare("SELECT id, attribute, min, max FROM item_rand ORDER BY id, attribute, min, max")
    .all() as Array<{ id: string; attribute: string; min: number; max: number }>) {
    const item = itemsById[Number(row.id)];
    const stat = labelToKey(row.attribute);
    if (!item || !isStatKey(stat) || (row.min === 0 && row.max === 0) ||
        !Number.isSafeInteger(row.min) || !Number.isSafeInteger(row.max) || row.min > row.max) continue;
    const options = item.randomOptions ??= [];
    let option = options.find((option) => option.attribute === row.attribute);
    if (!option) {
      option = { attribute: row.attribute, stat, ranges: [] };
      options.push(option);
    }
    option.ranges.push([row.min, row.max]);
  }
  for (const item of Object.values(itemsById)) {
    for (const option of item.randomOptions ?? []) option.ranges = mergeRanges(option.ranges);
  }

  // 只覆蓋已入選的裝備；BONUS 等道具的 comp_count 有不同語意，不可當插槽。
  for (const row of db.prepare(`SELECT item_id, mod_count_min, mod_count_max,
    comp_count_min, comp_count_max FROM item_rand_counts`).all() as Array<{
      item_id: number; mod_count_min: number; mod_count_max: number;
      comp_count_min: number; comp_count_max: number;
    }>) {
    const item = itemsById[row.item_id];
    if (!item) continue;
    item.socketCount = row.comp_count_max;
    item.socketMin = row.comp_count_min;
    item.socketCategory = row.comp_count_max > 0 ? getEquipmentSlotForType(item.typeName) : null;
    if (item.randomOptions?.length) {
      item.randomCount = [row.mod_count_min, Math.min(row.mod_count_max, item.randomOptions.length)];
    }
  }

  const socketRecipes: NonNullable<GameData["socketRecipes"]> = {};
  const socketRecipeIdsByCategory: NonNullable<GameData["socketRecipeIdsByCategory"]> = {};
  for (const row of db.prepare(`SELECT id, name, material_items, mod_prob FROM compounds
    WHERE type = 'ITEM_COMPOUND_EQUIPMENT' ORDER BY id`).all() as Array<{
      id: number; name: string | null; material_items: string | null; mod_prob: string | null;
    }>) {
    const categories = [...new Set(parseMaterialItems(row.material_items).map(({ id }) => id)
      .filter((id) => Number.isInteger(id) && id >= 1 && id <= 5))];
    if (!categories.length) continue;
    const outputs: CompoundOutput[] = parseModProb(row.mod_prob).filter((p) =>
      isStatKey(BONUS_TO_ATTR_KEY[p.type]) && (p.prob ?? 0) > 0 &&
      Number.isSafeInteger(p.min) && Number.isSafeInteger(p.max) && p.min! <= p.max!,
    ).map((p) => ({
      rawType: p.type, kind: "bonus", label: p.type, itemId: null,
      min: p.min, max: p.max, prob: p.prob!,
    }));
    const effects = [...new Set(outputs.map((o) => o.rawType))].flatMap((type) => {
      const merged = mergeBonus(outputs, type);
      if (!merged) return [];
      // mergeBonus 的 min/max 是外包區間；實際可選值還要取聯集，不能填平缺口。
      return [{ stat: BONUS_TO_ATTR_KEY[type] as StatKey, ranges: mergeRanges(outputs
        .filter((o) => o.rawType === type).map((o): ValueRange => [o.min!, o.max!])) }];
    });
    if (!effects.length) continue;
    socketRecipes[row.id] = { id: row.id, name: row.name ?? `配方 ${row.id}`, effects };
    for (const category of categories) (socketRecipeIdsByCategory[category] ??= []).push(row.id);
  }

  const formulas = new Map((db.prepare("SELECT id, bonus_type, bonus_value FROM strong_formula")
    .all() as FormulaRow[]).map((row) => [row.id, row]));
  const enhancementsByPath: GameData["enhancementsByPath"] = {};
  for (const row of db.prepare("SELECT id, list FROM strong_equipment ORDER BY id").all() as PathRow[]) {
    if (!pathIds.has(row.id)) continue;
    const path = parsePath(row);
    const levels: PanelBonus[] = [{}];
    const bonuses: PanelBonus = {};
    for (const entry of path.data) {
      if (entry.bonus !== undefined) addBonus(bonuses, formulaBonus(formulas.get(entry.bonus), entry.bonus));
      const total = { ...bonuses };
      addBonus(total, formulaBonus(formulas.get(entry.common), entry.common));
      levels.push(total);
    }
    enhancementsByPath[row.id] = { maxLevel: path.max, levels };
  }
  for (const id of pathIds) {
    if (!enhancementsByPath[id]) throw new Error(`道具引用了不存在的強化路徑 ${id}`);
  }

  const helpIds = Object.keys(HELP_PASSIVES).map(Number);
  const skillRows = db.prepare(`
    SELECT id, name, NULLIF(clan, '') AS clan, level FROM magic
    WHERE id != 1150 AND ${NON_MERIDIAN} AND (
      id IN (SELECT magic_id FROM magic_stats WHERE flag IS NULL OR flag != 'AFFECT_RATIO')
      OR id IN (${helpIds.map(() => "?").join(",")})
    ) ORDER BY id, level
  `).all(...helpIds) as Array<{ id: number; name: string; clan: string | null; level: number }>;
  // 最後一筆即 max-level 的 name/clan，不用 GROUP BY 的任意列。
  const metadata = new Map(skillRows.map((row) => [row.id, row]));
  const learns = new Map((db.prepare("SELECT magic_id, level, char_level FROM magic_learn")
    .all() as Array<{ magic_id: number; level: number; char_level: number | null }>)
    .map((row) => [`${row.magic_id}:${row.level}`, row.char_level]));
  const skillIcons = new Map((db.prepare("SELECT magic_id, level, url FROM magic_images ORDER BY magic_id, level")
    .all() as Array<{ magic_id: number; level: number; url: string }>)
    .map((row) => [row.magic_id, row.url]));
  const bySkill = new Map<number, Array<{ level: number; stat: string; value: number }>>();
  for (const row of db.prepare(`
    SELECT magic_id, level, stat, value FROM magic_stats
    WHERE (flag IS NULL OR flag != 'AFFECT_RATIO')
      AND magic_id NOT IN (SELECT magic_id FROM magic_learn WHERE is_meridian = 1
                          UNION SELECT magic_id FROM magic_meridians)
    ORDER BY magic_id, level, stat
  `).all() as Array<{ magic_id: number; level: number; stat: string; value: number }>) {
    const rows = bySkill.get(row.magic_id) ?? [];
    rows.push(row);
    bySkill.set(row.magic_id, rows);
  }

  // enabled 為整數旗標（1 = 啟用）；不把停用或 NULL 的成就算進取得上限。
  const obtainable = new Map((db.prepare(`
    SELECT reward_id, SUM(reward_amount) AS total FROM achievements
    WHERE enabled = 1 AND reward_kind = 'skill' GROUP BY reward_id
  `).all() as Array<{ reward_id: number; total: number }>).map((row) => [row.reward_id, row.total]));
  const passives: PassiveDef[] = [];
  for (const row of metadata.values()) {
    const help = HELP_PASSIVES[row.id];
    // 手抄表可比 DB 短：遊戲實際上限較低（如嫁衣神功 DB 寫 10、遊戲只到 4）。
    if (help && help.cumulative.length > row.level + 1) {
      throw new Error(`技能 ${row.id}：help 手抄表超過 DB 最高等級`);
    }
    if (help) row.level = help.cumulative.length - 1;
    const cumulative: PanelBonus[] = help ? help.cumulative.map((bonus) => ({ ...bonus })) : [{}];
    const unknown = new Set<string>();
    if (!help) {
      const deltas: PanelBonus[] = Array.from({ length: row.level + 1 }, () => ({}));
      for (const stat of bySkill.get(row.id) ?? []) {
        const key = MAGIC_STATS[stat.stat];
        if (!key) { unknown.add(stat.stat); continue; }
        if (!deltas[stat.level]) throw new Error(`技能 ${row.id}：magic_stats 等級 ${stat.level} 越界`);
        addBonus(deltas[stat.level], { [key]: stat.value });
      }
      for (let level = 1; level <= row.level; level++) {
        const total = { ...cumulative[level - 1] };
        addBonus(total, deltas[level]);
        cumulative.push(total);
      }
    }
    const group: PassiveDef["group"] = row.id >= 1151 && row.id <= 1159 ? "collection"
      : row.id >= 1181 && row.id <= 1202 ? "achievement"
      : row.clan === "CLASS_GUILD" ? "guild"
      : (SUB_SECT_CLANS as readonly string[]).includes(row.clan ?? "") ? "sub"
      : row.clan === null ? "common" : "main";
    const notes = [help?.note,
      unknown.size ? `未計入不支援的 magic_stats：${[...unknown].join("、")}` : undefined,
      row.clan === "CLASS_CHILD" ? "入門弟子技能，不屬於 v1 支援的主門派；保留原 clan，不列為通用。" : undefined,
    ].filter(Boolean);
    passives.push({
      id: row.id, name: row.name, clan: row.clan, group, maxLevel: row.level,
      ...(group === "achievement" ? { obtainableMax: obtainable.get(row.id) ?? 0 } : {}),
      learnLevels: [0, ...Array.from({ length: row.level }, (_, i) => learns.get(`${row.id}:${i + 1}`) ?? -1)],
      iconUrl: skillIcons.get(row.id) ?? null, cumulative,
      ...(help?.weaponReq ? { weaponReq: [...help.weaponReq] } : {}),
      ...(help?.weaponReqStats ? { weaponReqStats: [...help.weaponReqStats] } : {}),
      ...(notes.length ? { note: notes.join(" ") } : {}),
    });
  }
  for (const id of helpIds) {
    if (!metadata.has(id)) throw new Error(`查無 help 被動技能 ${id}，或該技能已被改成經脈`);
  }
  const collectionThresholds = db.prepare(`
    SELECT value, magic_id AS magicId, level FROM collect_book_bonuses ORDER BY value, magic_id, level
  `).all() as NonNullable<GameData["collectionThresholds"]>;
  const meridianIds = (db.prepare("SELECT DISTINCT magic_id FROM magic_meridians ORDER BY magic_id")
    .all() as Array<{ magic_id: number }>).map((row) => row.magic_id);
  return { itemsById, enhancementsByPath, passives, meridianIds, collectionThresholds, socketRecipes, socketRecipeIdsByCategory };
}

/** 保留原始 control 座標/field，不以有錯字的 comment 推斷數值用途。 */
export function getStatSimWindows(): { attribute: UiWindowLayout; equipment: UiWindowLayout } {
  const db = getDb();
  const windows = db.prepare(`
    SELECT "window", name, width, height, icon_id FROM ui_windows
    WHERE "window" IN ('Attribute', 'accoutrements_A')
  `).all() as Array<Omit<UiWindowLayout, "backgroundUrl" | "controls"> & { icon_id: number }>;
  const images = new Map((db.prepare(`
    SELECT "window", icon_id, url FROM ui_images
    WHERE "window" IN ('Attribute', 'accoutrements_A') AND state = 'normal' AND frame = 0
  `).all() as Array<{ window: string; icon_id: number; url: string }>)
    .map((row) => [`${row.window}:${row.icon_id}`, row.url]));
  const controls = db.prepare(`
    SELECT "window", ctrl_id AS ctrlId, class, title, field, comment,
           x, y, width, height, color, icon_id FROM ui_controls
    WHERE "window" IN ('Attribute', 'accoutrements_A') ORDER BY "window", ctrl_id
  `).all() as Array<Omit<UiControl, "iconUrl"> & { window: string; icon_id: number | null }>;
  const byWindow = new Map<string, UiWindowLayout>();
  for (const row of windows) {
    const backgroundUrl = images.get(`${row.window}:${row.icon_id}`);
    if (!backgroundUrl) throw new Error(`視窗 ${row.window} 缺少底圖 ${row.icon_id}`);
    byWindow.set(row.window, {
      window: row.window, name: row.name, width: row.width, height: row.height, backgroundUrl,
      controls: controls.filter((control) => control.window === row.window)
        .map(({ window, icon_id, ...control }) => ({
          ...control, iconUrl: icon_id === null ? null : images.get(`${window}:${icon_id}`) ?? null,
        })),
    });
  }
  const attribute = byWindow.get("Attribute");
  const equipment = byWindow.get("accoutrements_A");
  if (!attribute || !equipment) throw new Error("查無屬性或裝備視窗資料");
  const slots = db.prepare(`
    SELECT equip_slot, label, ctrl_id AS ctrlId, x, y, width, height
    FROM ui_equip_slots WHERE "window" = 'accoutrements_A' ORDER BY ctrl_id
  `).all() as Array<Omit<UiEquipSlot, "slot"> & { equip_slot: string }>;
  equipment.equipSlots = slots.map(({ equip_slot, ...row }) => {
    const slot = EQUIP_SLOT_CODES[equip_slot];
    if (!slot) throw new Error(`未知裝備欄代碼：${equip_slot}`);
    return { ...row, slot };
  });
  if (slots.length !== EQUIP_SLOTS.length ||
      new Set(equipment.equipSlots.map((row) => row.slot)).size !== EQUIP_SLOTS.length) {
    throw new Error("ui_equip_slots 缺少或重複裝備欄位");
  }
  return { attribute, equipment };
}
