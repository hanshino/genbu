// 僅供 server 使用：把放置引擎需要的資料一次載成純 JSON（IdleData），引擎本身不碰 DB。
import { gunzipSync } from "node:zlib";
import { SECT_SKILL_CLANS } from "@/configs/stat-sim-damage";
import { IDLE_EXCLUDED_SKILL_TYPES, IDLE_SKILL_FUNC_DMG } from "@/configs/idle";
import { SECTS } from "@/configs/stat-sim";
import { getDb } from "@/lib/db";
import type { IdleData, IdleGender, IdleMonster, IdleSkill, IdleSkillLevel } from "@/lib/idle/types";
import { getStrips } from "@/lib/queries/skill-effect";
import { hitTicks, type StripSet, type TimelineFrame } from "@/lib/skill-effect";
import { STAT_KEYS, type PanelBonus, type SectId, type SimItem, type StatKey } from "@/lib/types/stat-sim";

const ITEM_ALIASES: Partial<Record<StatKey, string>> = {
  def: "extra_def",
  mdef: "magic_def",
  critical: "critical_hit",
};

export interface IdlePresetRow {
  id: number;
  sectId: number;
  gender: IdleGender;
  weaponItemId: number | null;
}

export function getIdlePreset(presetId: number): IdlePresetRow | null {
  if (!Number.isSafeInteger(presetId)) return null;
  const row = getDb()
    .prepare("SELECT id, sect_id AS sectId, gender, weapon_item_id AS weaponItemId FROM effect_presets WHERE id = ?")
    .get(presetId) as IdlePresetRow | undefined;
  return row && (row.gender === "m" || row.gender === "f") ? row : null;
}

function loadWeapon(itemId: number): SimItem {
  const row = getDb().prepare("SELECT * FROM items WHERE id = ?").get(itemId) as Record<string, unknown> | undefined;
  if (!row) throw new Error(`預設角色的武器 ${itemId} 不存在`);
  const stats: PanelBonus = {};
  for (const key of STAT_KEYS) {
    const value = row[ITEM_ALIASES[key] ?? key];
    if (typeof value === "number" && value !== 0) stats[key] = value;
  }
  const range = (min: unknown, max: unknown): [number, number] | undefined =>
    typeof max === "number" && max > 0 ? [typeof min === "number" ? min : 0, max] : undefined;
  const damage = range(row.damage_min, row.damage_max);
  const pdamage = range(row.pdamage_min, row.pdamage_max);
  return {
    id: itemId,
    name: String(row.name ?? ""),
    level: typeof row.base_lv === "number" ? row.base_lv : 0,
    typeName: typeof row.type_name === "string" ? row.type_name : null,
    slotHint: ["right", "left"],
    stats,
    strongPathId: null,
    ...(damage ? { damage } : {}),
    ...(pdamage ? { pdamage } : {}),
  };
}

function loadMonsters(ids: number[]): Record<number, IdleMonster> {
  const rows = getDb()
    .prepare(
      `SELECT id, name, level, hp, extra_def AS extraDef, magic_def AS magicDef, base_dodge AS baseDodge,
              drop_exp AS dropExp, drop_money_min AS dropMoneyMin, drop_money_max AS dropMoneyMax
       FROM monsters WHERE id IN (${ids.map(() => "?").join(",")})`,
    )
    .all(...ids) as IdleMonster[];
  return Object.fromEntries(
    rows.map((row) => [
      row.id,
      {
        ...row,
        name: row.name ?? "",
        level: row.level ?? 1,
        extraDef: row.extraDef ?? 0,
        magicDef: row.magicDef ?? 0,
        baseDodge: row.baseDodge ?? 0,
        dropExp: row.dropExp ?? 0,
        dropMoneyMin: row.dropMoneyMin ?? 0,
        dropMoneyMax: row.dropMoneyMax ?? 0,
      },
    ]),
  );
}

interface SkillRow {
  id: number;
  level: number;
  name: string;
  skillType: number | null;
  funcDmg: number;
  p1: number | null;
  p2: number | null;
  p3: number | null;
  p4: number | null;
  funcHitP1: number | null;
  learnLevel: number;
  castEffect: number;
  variant: string;
  hitCount: number;
  ticks: number;
}

/** 該門派（且男 / 女演出資料齊全）的傷害技能，每個等級連同時間軸的命中 tick。 */
function loadSkills(sectId: SectId, gender: IdleGender): IdleSkill[] {
  const db = getDb();
  const clans = SECT_SKILL_CLANS[sectId] ?? [];
  if (clans.length === 0) return [];
  const rows = db
    .prepare(
      `SELECT m.id, m.level, m.name, m.skill_type AS skillType, m.func_dmg AS funcDmg,
              m.func_dmg_p1 AS p1, m.func_dmg_p2 AS p2, m.func_dmg_p3 AS p3, m.func_dmg_p4 AS p4,
              m.func_hit_p1 AS funcHitP1, l.char_level AS learnLevel,
              e.cast_effect AS castEffect, e.variant, e.hit_count AS hitCount, t.ticks
       FROM magic m
       JOIN magic_learn l ON l.magic_id = m.id AND l.level = m.level AND l.char_level IS NOT NULL
       JOIN magic_effect_presets e ON e.magic_id = m.id AND e.level = m.level AND e.gender = ?
                                  AND e.target_mode IN ('enemy', 'ground')
       JOIN magic_effect_timelines t ON t.cast_effect = e.cast_effect AND t.variant = e.variant
                                    AND t.hit_count = e.hit_count
       WHERE m.clan IN (${clans.map(() => "?").join(",")})
         AND m.func_dmg IN (${IDLE_SKILL_FUNC_DMG.map(() => "?").join(",")})
       ORDER BY m.id, m.level`,
    )
    .all(gender, ...clans, ...IDLE_SKILL_FUNC_DMG) as SkillRow[];

  const timelineStmt = db.prepare(
    "SELECT json FROM magic_effect_timelines WHERE cast_effect = ? AND variant = ? AND hit_count = ?",
  );
  const hitCache = new Map<string, number[]>();
  const hitsOf = (row: SkillRow): number[] => {
    const key = `${row.castEffect}:${row.variant}:${row.hitCount}`;
    let ticks = hitCache.get(key);
    if (!ticks) {
      const blob = timelineStmt.get(row.castEffect, row.variant, row.hitCount) as { json: Buffer };
      const parsed = JSON.parse(gunzipSync(blob.json).toString("utf8")) as { frames: TimelineFrame[] };
      ticks = hitTicks(parsed.frames);
      hitCache.set(key, ticks);
    }
    return ticks;
  };

  const skills = new Map<number, IdleSkill>();
  for (const row of rows) {
    if (row.skillType != null && IDLE_EXCLUDED_SKILL_TYPES.includes(row.skillType)) continue;
    const ticks = hitsOf(row);
    if (ticks.length === 0) continue;
    const skill = skills.get(row.id) ?? { id: row.id, name: row.name, skillType: row.skillType, levels: [] };
    const level: IdleSkillLevel = {
      level: row.level,
      learnLevel: row.learnLevel,
      funcDmg: row.funcDmg,
      p1: row.p1 ?? 0,
      p2: row.p2 ?? 0,
      p3: row.p3 ?? 0,
      p4: row.p4 ?? 0,
      funcHitP1: row.funcHitP1 ?? 0,
      hitTicks: ticks,
      castTicks: Math.max(1, row.ticks, ticks[ticks.length - 1]),
    };
    skill.name = row.name;
    skill.levels.push(level);
    skills.set(row.id, skill);
  }
  return [...skills.values()];
}

// tthol.sqlite 是唯讀的，同一個 (地圖, 預設角色) 的資料不會變，載一次就好（技能時間軸要解壓縮）。
const cache = new Map<string, IdleData | null>();

/** 找不到預設角色或地圖沒有怪物回傳 null。 */
export function loadIdleData(stageId: number, presetId: number): IdleData | null {
  const key = `${stageId}:${presetId}`;
  if (cache.has(key)) return cache.get(key)!;
  const data = buildIdleData(stageId, presetId);
  cache.set(key, data);
  return data;
}

function buildIdleData(stageId: number, presetId: number): IdleData | null {
  const preset = getIdlePreset(presetId);
  if (!preset) return null;
  const db = getDb();
  const spawnRows = db
    .prepare(
      `SELECT npc_id AS monsterId, COUNT(*) AS weight FROM monster_spawns
       WHERE stage_kind = 'stage' AND stage_id = ? AND npc_id IS NOT NULL
       GROUP BY npc_id ORDER BY npc_id`,
    )
    .all(stageId) as { monsterId: number; weight: number }[];
  const monsters = spawnRows.length ? loadMonsters(spawnRows.map((row) => row.monsterId)) : {};
  const spawns = spawnRows.filter((row) => monsters[row.monsterId]);
  if (spawns.length === 0) return null;

  const levelExp: number[] = [0];
  for (const row of db.prepare("SELECT level, exp FROM char_levels ORDER BY level").all() as {
    level: number;
    exp: number;
  }[]) {
    levelExp[row.level] = row.exp;
  }

  // sect_id 不在 SECTS（入門弟子 1、無名島 16…）的預設角色算不出面板，不載技能；開局由 presetProblem 擋下。
  const sectId = preset.sectId as SectId;
  return {
    presetId,
    sectId,
    gender: preset.gender,
    stageId,
    weapon: preset.weaponItemId == null ? null : loadWeapon(preset.weaponItemId),
    monsters,
    spawns,
    levelExp,
    skills: SECTS[sectId] ? loadSkills(sectId, preset.gender) : [],
  };
}

// ---------------------------------------------------------------------------
// 畫面用的靜態資料：標籤、地圖、動作圖。與引擎無關，只給 /idle 的場景用。
// ---------------------------------------------------------------------------

export interface IdleSceneAssets {
  presetLabel: string;
  stageName: string;
  /** 玩家預設角色的全部動作圖（dir = 1）。 */
  casterStrips: StripSet;
  /** monster id → 動作圖（npc.pic 對到 actor_strip_images 的 monster）。 */
  monsterStrips: Record<number, StripSet>;
  map: { url: string; width: number; height: number } | null;
}

const sceneCache = new Map<string, IdleSceneAssets>();

export function loadIdleSceneAssets(data: IdleData): IdleSceneAssets {
  const key = `${data.stageId}:${data.presetId}`;
  const cached = sceneCache.get(key);
  if (cached) return cached;
  const db = getDb();
  const label = db.prepare("SELECT label FROM effect_presets WHERE id = ?").get(data.presetId) as
    | { label: string }
    | undefined;
  const stage = db.prepare("SELECT name FROM stages WHERE kind = 'stage' AND id = ?").get(data.stageId) as
    | { name: string | null }
    | undefined;
  const map = db
    .prepare("SELECT url, img_width AS width, img_height AS height FROM map_images WHERE stage_kind = 'stage' AND stage_id = ?")
    .get(data.stageId) as { url: string; width: number; height: number } | undefined;
  const monsterStrips: Record<number, StripSet> = {};
  for (const id of Object.keys(data.monsters).map(Number)) {
    const npc = db.prepare("SELECT pic FROM npc WHERE id = ?").get(id) as { pic: number | null } | undefined;
    monsterStrips[id] = npc?.pic != null ? getStrips("monster", npc.pic) : {};
  }
  const assets: IdleSceneAssets = {
    presetLabel: label?.label ?? "",
    stageName: stage?.name ?? "",
    casterStrips: getStrips("preset", data.presetId),
    monsterStrips,
    map: map ?? null,
  };
  sceneCache.set(key, assets);
  return assets;
}
