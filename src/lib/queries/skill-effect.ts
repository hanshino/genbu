import { gunzipSync } from "node:zlib";
import { getDb } from "@/lib/db";
import {
  referencedSprites,
  spriteKey,
  type ActorStrip,
  type EffectBlend,
  type EffectCaster,
  type EffectGender,
  type EffectSprite,
  type EffectTarget,
  type SkillEffectBundle,
  type StripSet,
  type TimelineFrame,
} from "@/lib/skill-effect";

export interface SkillEffectAvailability {
  genders: EffectGender[];
  presetLabels: Partial<Record<EffectGender, string>>;
}

interface PresetRow {
  gender: EffectGender;
  presetId: number;
  label: string;
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

function isValidId(id: number): boolean {
  return Number.isSafeInteger(id) && id > 0;
}

// 技能有演出 = 最低等級那筆的 cast_effect 有時間軸，且該技能有指定施法者外觀。
function getTimelineEffect(baseMagicId: number): number | null {
  const row = getDb()
    .prepare(
      `SELECT m.cast_effect AS castEffect FROM magic m
       WHERE m.id = ? AND m.cast_effect IN (SELECT cast_effect FROM magic_effect_timelines)
       ORDER BY m.level LIMIT 1`,
    )
    .get(baseMagicId) as { castEffect: number } | undefined;
  return row?.castEffect ?? null;
}

function getPresets(baseMagicId: number): PresetRow[] {
  return getDb()
    .prepare(
      `SELECT mp.gender, mp.preset_id AS presetId, p.label
       FROM magic_effect_presets mp JOIN effect_presets p ON p.id = mp.preset_id
       WHERE mp.magic_id = ? ORDER BY mp.gender DESC`,
    )
    .all(baseMagicId) as PresetRow[];
}

export function getSkillEffectAvailability(baseMagicId: number): SkillEffectAvailability | null {
  if (!isValidId(baseMagicId) || getTimelineEffect(baseMagicId) === null) return null;
  const presets = getPresets(baseMagicId).filter((p) => p.gender === "m" || p.gender === "f");
  if (presets.length === 0) return null;
  return {
    genders: presets.map((p) => p.gender),
    presetLabels: Object.fromEntries(presets.map((p) => [p.gender, p.label])),
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

export function getSkillEffectBundle(baseMagicId: number): SkillEffectBundle | null {
  if (!isValidId(baseMagicId)) return null;
  const castEffect = getTimelineEffect(baseMagicId);
  if (castEffect === null) return null;
  const presets = getPresets(baseMagicId);
  const target = getTarget();
  if (presets.length === 0 || !target) return null;

  const timeline = getDb()
    .prepare("SELECT ticks, json, unknown_natives AS unknownNatives FROM magic_effect_timelines WHERE cast_effect = ?")
    .get(castEffect) as { ticks: number; json: Buffer; unknownNatives: string | null };
  const parsed = JSON.parse(gunzipSync(timeline.json).toString("utf8")) as {
    tick_ms: number;
    ticks: number;
    frames: TimelineFrame[];
  };

  const casters: Partial<Record<EffectGender, EffectCaster>> = {};
  for (const p of presets) {
    if (p.gender !== "m" && p.gender !== "f") continue;
    casters[p.gender] = { presetId: p.presetId, label: p.label, strips: getStrips("preset", p.presetId) };
  }

  return {
    magicId: baseMagicId,
    tickMs: parsed.tick_ms,
    ticks: timeline.ticks ?? parsed.ticks,
    frames: parsed.frames,
    unknownNatives: timeline.unknownNatives ? (JSON.parse(timeline.unknownNatives) as string[]) : null,
    sprites: getSprites(parsed.frames),
    casters,
    target,
  };
}
