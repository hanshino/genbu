// 僅供 server 使用，與其他 queries 一樣透過 readonly db.ts 存取 SQLite。
import { getDb } from "@/lib/db";
import { HELP_PASSIVES, WEAPON_TYPE_NAMES } from "@/configs/stat-sim-passives";
import { BONUS_TO_ATTR_KEY } from "@/lib/queries/compound";
import { getItemIconMap } from "@/lib/queries/images";
import {
  STAT_KEYS, SUB_SECT_CLANS,
  type EquipSlot, type GameData, type PanelBonus, type PassiveDef,
  type SimItem, type StatKey, type UiControl, type UiWindowLayout,
} from "@/lib/types/stat-sim";

const ITEM_ALIASES: Partial<Record<StatKey, string>> = {
  def: "extra_def", mdef: "magic_def", critical: "critical_hit",
};
const ITEM_STATS = Object.fromEntries(
  STAT_KEYS.map((key) => [key, ITEM_ALIASES[key] ?? key]),
) as Record<StatKey, string>;

const SLOT_HINTS: Record<string, EquipSlot[]> = {
  CAP: ["cap"], BODY: ["body"], FOOT: ["foot"], WING: ["wing"], HORSE: ["horse"],
  HAND_R: ["right"], HAND_L: ["left"], "HAND_L,HAND_R": ["right", "left"],
  HANDS: ["right", "left"],
  ORNAMENT_1: ["ornament1", "ornament2", "ornament3"],
  ORNAMENT_2: ["ornament1", "ornament2", "ornament3"],
  ORNAMENT_3: ["ornament1", "ornament2", "ornament3"],
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

/** 一次載入 client 引擎所需的純 JSON；圖片與技能均為批次查詢，沒有逐道具查 DB。 */
export function getStatSimData(): GameData {
  const db = getDb();
  const items = db.prepare(`
    SELECT id, name, base_lv AS level, type_name AS typeName, equip_slot,
           strong_equipment AS strongPathId,
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
    };
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
    WHERE ${NON_MERIDIAN} AND (
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

  const passives: PassiveDef[] = [];
  for (const row of metadata.values()) {
    const help = HELP_PASSIVES[row.id];
    if (help && help.cumulative.length !== row.level + 1) {
      throw new Error(`技能 ${row.id}：help 手抄表與 DB 最高等級不同`);
    }
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
      : row.clan === "CLASS_GUILD" ? "guild"
      : (SUB_SECT_CLANS as readonly string[]).includes(row.clan ?? "") ? "sub"
      : row.clan === null ? "common" : "main";
    const notes = [help?.note,
      unknown.size ? `未計入不支援的 magic_stats：${[...unknown].join("、")}` : undefined,
      row.clan === "CLASS_CHILD" ? "入門弟子技能，不屬於 v1 支援的主門派；保留原 clan，不列為通用。" : undefined,
    ].filter(Boolean);
    passives.push({
      id: row.id, name: row.name, clan: row.clan, group, maxLevel: row.level,
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
  return { itemsById, enhancementsByPath, passives };
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
  return { attribute, equipment };
}
