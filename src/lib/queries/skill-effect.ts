import { gunzipSync } from "node:zlib";
import { getDb } from "@/lib/db";
import {
  referencedSprites,
  showsTarget,
  spriteKey,
  timelineKey,
  type ActorStrip,
  type EffectBlend,
  type EffectCaster,
  type EffectFidelity,
  type EffectGender,
  type EffectSprite,
  type EffectTarget,
  type EffectTimeline,
  type SkillEffectBundle,
  type StripSet,
  type TargetMode,
  type TimelineFrame,
} from "@/lib/skill-effect";

export interface SkillEffectAvailability {
  level: number;
  genders: EffectGender[];
  presets: Partial<
    Record<EffectGender, { label: string; targetMode: TargetMode; fidelity: EffectFidelity }>
  >;
}

interface PresetRow {
  gender: EffectGender;
  presetId: number;
  label: string;
  castEffect: number;
  variant: "target" | "self";
  targetMode: TargetMode;
  fidelity: EffectFidelity;
}

interface StripRow {
  action: string;
  url: string;
  width: number | null;
  height: number | null;
  cellW: number;
  cellH: number;
  frames: number;
  anchorX: number;
  anchorY: number;
  delays: string;
}

interface SpriteRow extends Omit<EffectSprite, "delays" | "blend"> {
  delays: string;
  blend: string;
}

const BLENDS: EffectBlend[] = ["add", "sub", "alpha", "normal"];

const TARGET_MODES: TargetMode[] = ["enemy", "ground", "self", "ally"];

// 技能有演出 = 該等級在 magic_effect_presets 有列（它的 (cast_effect, variant) 保證有時間軸）。
// 同一個 magic id 在不同等級可能是不同技能，所以一定要指定等級；沒指定就取有資料的最低等級。
function resolveLevel(magicId: number, level: number | null | undefined): number | null {
  if (level != null) {
    return Number.isSafeInteger(level) && level > 0 ? level : null;
  }
  const row = getDb()
    .prepare("SELECT MIN(level) AS level FROM magic_effect_presets WHERE magic_id = ?")
    .get(magicId) as { level: number | null };
  return row.level;
}

function getPresets(magicId: number, level: number): PresetRow[] {
  const rows = getDb()
    .prepare(
      `SELECT mp.gender, mp.preset_id AS presetId, p.label, mp.cast_effect AS castEffect,
              mp.variant, mp.target_mode AS targetMode, t.fidelity
       FROM magic_effect_presets mp
       JOIN effect_presets p ON p.id = mp.preset_id
       JOIN magic_effect_timelines t ON t.cast_effect = mp.cast_effect AND t.variant = mp.variant
       WHERE mp.magic_id = ? AND mp.level = ? ORDER BY mp.gender DESC`,
    )
    .all(magicId, level) as PresetRow[];
  return rows.filter(
    (r) => (r.gender === "m" || r.gender === "f") && TARGET_MODES.includes(r.targetMode),
  );
}

export function getSkillEffectAvailability(
  magicId: number,
  level?: number | null,
): SkillEffectAvailability | null {
  if (!Number.isSafeInteger(magicId) || magicId <= 0) return null;
  const lv = resolveLevel(magicId, level);
  if (lv === null) return null;
  const presets = getPresets(magicId, lv);
  if (presets.length === 0) return null;
  return {
    level: lv,
    genders: presets.map((p) => p.gender),
    presets: Object.fromEntries(
      presets.map((p) => [p.gender, { label: p.label, targetMode: p.targetMode, fidelity: p.fidelity }]),
    ),
  };
}

function toStrip(row: StripRow): ActorStrip {
  return {
    url: row.url,
    width: row.width,
    height: row.height,
    cellW: row.cellW,
    cellH: row.cellH,
    frames: row.frames,
    anchorX: row.anchorX,
    anchorY: row.anchorY,
    delays: JSON.parse(row.delays) as number[],
  };
}

function getStrips(kind: "preset" | "monster", actorId: number): StripSet {
  const rows = getDb()
    .prepare(
      `SELECT action, url, width, height, cell_w AS cellW, cell_h AS cellH, frames,
              anchor_x AS anchorX, anchor_y AS anchorY, delays
       FROM actor_strip_images WHERE kind = ? AND actor_id = ? AND dir = 1`,
    )
    .all(kind, actorId) as StripRow[];
  return Object.fromEntries(rows.map((row) => [row.action, toStrip(row)]));
}

function getSprites(frames: TimelineFrame[]): EffectSprite[] {
  const wanted = referencedSprites(frames);
  if (wanted.length === 0) return [];
  const seqs = [...new Set(wanted.map((w) => w.seq))];
  const rows = getDb()
    .prepare(
      `SELECT seq, state, url, width, height, cell_w AS cellW, cell_h AS cellH, frames,
              anchor_x AS anchorX, anchor_y AS anchorY, delays, blend
       FROM effect_sprite_images WHERE seq IN (${seqs.map(() => "?").join(",")})`,
    )
    .all(...seqs) as SpriteRow[];
  const keys = new Set(wanted.map((w) => spriteKey(w.seq, w.state)));
  return rows
    .filter((row) => keys.has(spriteKey(row.seq, row.state)))
    .map((row) => ({
      ...row,
      delays: JSON.parse(row.delays) as number[],
      blend: BLENDS.find((b) => b === row.blend) ?? "normal",
    }));
}

function getTarget(): EffectTarget | null {
  const row = getDb()
    .prepare(
      `SELECT t.npc_id AS npcId, t.pic, COALESCE(n.name, '') AS name
       FROM effect_default_target t LEFT JOIN npc n ON n.id = t.npc_id LIMIT 1`,
    )
    .get() as { npcId: number; pic: number; name: string } | undefined;
  if (!row) return null;
  return { npcId: row.npcId, name: row.name, strips: getStrips("monster", row.pic) };
}

function getTimeline(castEffect: number, variant: string): { timeline: EffectTimeline } | null {
  const row = getDb()
    .prepare(
      `SELECT ticks, json, fidelity, unknown_natives AS unknownNatives
       FROM magic_effect_timelines WHERE cast_effect = ? AND variant = ?`,
    )
    .get(castEffect, variant) as
    | { ticks: number; json: Buffer; fidelity: EffectFidelity; unknownNatives: string | null }
    | undefined;
  if (!row) return null;
  const parsed = JSON.parse(gunzipSync(row.json).toString("utf8")) as {
    tick_ms: number;
    ticks: number;
    frames: TimelineFrame[];
  };
  return {
    timeline: {
      variant: variant === "self" ? "self" : "target",
      tickMs: parsed.tick_ms,
      ticks: row.ticks ?? parsed.ticks,
      frames: parsed.frames,
      fidelity: row.fidelity,
      unknownNatives: row.unknownNatives ? (JSON.parse(row.unknownNatives) as string[]) : null,
    },
  };
}

export function getSkillEffectBundle(magicId: number, level?: number | null): SkillEffectBundle | null {
  if (!Number.isSafeInteger(magicId) || magicId <= 0) return null;
  const lv = resolveLevel(magicId, level);
  if (lv === null) return null;
  const presets = getPresets(magicId, lv);
  if (presets.length === 0) return null;

  const timelines: Record<string, EffectTimeline> = {};
  const casters: Partial<Record<EffectGender, EffectCaster>> = {};
  for (const p of presets) {
    const key = timelineKey(p.castEffect, p.variant);
    if (!timelines[key]) {
      const found = getTimeline(p.castEffect, p.variant);
      if (!found) continue;
      timelines[key] = found.timeline;
    }
    casters[p.gender] = {
      presetId: p.presetId,
      label: p.label,
      strips: getStrips("preset", p.presetId),
      targetMode: p.targetMode,
      timelineKey: key,
    };
  }
  if (Object.keys(casters).length === 0) return null;

  const needsTarget = Object.values(casters).some((c) => showsTarget(c.targetMode));
  const allFrames = Object.values(timelines).flatMap((t) => t.frames);
  return {
    magicId,
    level: lv,
    timelines,
    sprites: getSprites(allFrames),
    casters,
    target: needsTarget ? getTarget() : null,
  };
}
