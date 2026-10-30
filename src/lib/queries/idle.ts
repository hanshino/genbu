// 僅供 server 使用：把放置引擎需要的資料一次載成純 JSON（IdleData），引擎本身不碰 DB。
import { gunzipSync } from "node:zlib";
import { SECT_SKILL_CLANS } from "@/configs/stat-sim-damage";
import {
  IDLE_EXCLUDED_SKILL_TYPES,
  IDLE_SKILL_FUNC_DMG,
  NOVICE_PRESET_IDS,
  NOVICE_SECT_ID,
  NOVICE_WEAPON_ID,
} from "@/configs/idle";
import { SECTS } from "@/configs/stat-sim";
import { getDb } from "@/lib/db";
import type {
  IdleData,
  IdleGender,
  IdleSectId,
  IdleMonster,
  IdleSkill,
  IdleSkillLevel,
} from "@/lib/idle/types";
import {
  CREATE_WINDOW,
  type ButtonIcons,
  type ButtonState,
  type CreateControl,
  type CreateWindowData,
} from "@/lib/idle/create-layout";
import { getStatSimWindows } from "@/lib/queries/stat-sim";
import { getStrips } from "@/lib/queries/skill-effect";
import { hitTicks, type StripSet, type TimelineFrame } from "@/lib/skill-effect";
import {
  STAT_KEYS,
  type PanelBonus,
  type SectId,
  type SimItem,
  type StatKey,
  type UiWindowLayout,
} from "@/lib/types/stat-sim";

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
        // 練功點都是一般怪，名稱前的 ▲／● 在掛機畫面只是雜訊。
        name: (row.name ?? "").replace(/^[▲●]/, ""),
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

/**
 * 找不到預設角色或地圖沒有怪物回傳 null。
 * weaponItemId 覆蓋預設角色的武器（空手外觀的預設角色沒有武器，武器由存檔指定）；入門弟子固定拿新手用青銅刀。
 */
export function loadIdleData(stageId: number, presetId: number, weaponItemId?: number | null): IdleData | null {
  const key = `${stageId}:${presetId}:${weaponItemId ?? ""}`;
  if (cache.has(key)) return cache.get(key)!;
  const data = buildIdleData(stageId, presetId, weaponItemId ?? null);
  cache.set(key, data);
  return data;
}

function buildIdleData(stageId: number, presetId: number, weaponItemId: number | null): IdleData | null {
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

  // 入門弟子 1 沒有可學的傷害招式（只用普攻），武器換成起始的新手用青銅刀。
  // 其他不在 SECTS 的門派（無名島 16…）算不出面板，不載技能；開局由 presetProblem 擋下。
  const sectId = preset.sectId as IdleSectId;
  const novice = sectId === NOVICE_SECT_ID;
  const weaponId = novice ? NOVICE_WEAPON_ID : (weaponItemId ?? preset.weaponItemId);
  return {
    presetId,
    sectId,
    gender: preset.gender,
    stageId,
    weapon: weaponId == null ? null : loadWeapon(weaponId),
    monsters,
    spawns,
    levelExp,
    skills: !novice && SECTS[sectId as SectId] ? loadSkills(sectId as SectId, preset.gender) : [],
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
  /** 角色分頁用的遊戲「基本屬性」視窗（與屬性模擬器同一份版面）。 */
  attributeWindow: UiWindowLayout;
}

const sceneCache = new Map<string, IdleSceneAssets>();

export function loadIdleSceneAssets(data: IdleData): IdleSceneAssets {
  const key = `${data.stageId}:${data.presetId}`;
  const cached = sceneCache.get(key);
  if (cached) return cached;
  const db = getDb();
  const label = db.prepare("SELECT label FROM effect_presets WHERE id = ?").get(data.presetId) as
    { label: string } | undefined;
  const stage = db
    .prepare("SELECT name FROM stages WHERE kind = 'stage' AND id = ?")
    .get(data.stageId) as { name: string | null } | undefined;
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
    attributeWindow: getStatSimWindows().attribute,
  };
  sceneCache.set(key, assets);
  return assets;
}

// ---------------------------------------------------------------------------
// 建立角色畫面：原作「創造角色」視窗（NewCreate-1）的底圖、控制項與按鈕圖，加上入門弟子・刀（男 / 女）的動作圖。
// ---------------------------------------------------------------------------

export interface IdleCreateAssets {
  window: CreateWindowData;
  /** 紙娃娃用：入門弟子・刀 102（男）/ 103（女）的動作圖（dir = 1）。 */
  strips: Record<IdleGender, StripSet>;
}

let createCache: IdleCreateAssets | undefined;

export function loadCreateAssets(): IdleCreateAssets {
  if (createCache) return createCache;
  const db = getDb();
  const win = db
    .prepare('SELECT width, height, icon_id AS iconId FROM ui_windows WHERE "window" = ?')
    .get(CREATE_WINDOW) as { width: number; height: number; iconId: number } | undefined;
  if (!win) throw new Error(`查無視窗 ${CREATE_WINDOW}`);
  const icons = new Map<number, ButtonIcons>();
  for (const row of db
    .prepare('SELECT icon_id AS iconId, state, url FROM ui_images WHERE "window" = ? AND frame = 0')
    .all(CREATE_WINDOW) as { iconId: number; state: string; url: string }[]) {
    icons.set(row.iconId, { ...icons.get(row.iconId), [row.state as ButtonState]: row.url });
  }
  const backgroundUrl = icons.get(win.iconId)?.normal;
  if (!backgroundUrl) throw new Error(`視窗 ${CREATE_WINDOW} 缺少底圖 ${win.iconId}`);
  const controls = (
    db
      .prepare(
        `SELECT ctrl_id AS id, class AS kind, x, y, width, height, title, icon_id AS iconId
         FROM ui_controls WHERE "window" = ? ORDER BY ctrl_id`,
      )
      .all(CREATE_WINDOW) as (Omit<CreateControl, "icons"> & { iconId: number | null })[]
  ).map(({ iconId, ...control }): CreateControl => ({
    ...control,
    title: control.title || null,
    icons: iconId == null ? null : (icons.get(iconId) ?? null),
  }));
  createCache = {
    window: { width: win.width, height: win.height, backgroundUrl, controls },
    strips: { m: getStrips("preset", NOVICE_PRESET_IDS.m), f: getStrips("preset", NOVICE_PRESET_IDS.f) },
  };
  return createCache;
}
