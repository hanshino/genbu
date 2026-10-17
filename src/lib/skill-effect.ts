// 技能演出的純邏輯（不碰 DOM、不碰 DB），伺服器與瀏覽器共用。
// 時間單位一律是 tick；一個 tick 幾毫秒由 bundle.tickMs 或使用者選的速度決定。

export type EffectGender = "m" | "f";

export interface ActorStrip {
  url: string;
  width: number | null;
  height: number | null;
  cellW: number;
  cellH: number;
  frames: number;
  anchorX: number;
  anchorY: number;
  /** 每一格停留的 tick 數。 */
  delays: number[];
}

/** 動作名（小寫）→ 動畫條。 */
export type StripSet = Record<string, ActorStrip>;

export type EffectBlend = "add" | "sub" | "alpha" | "normal";

export interface EffectSprite {
  seq: number;
  state: string;
  url: string;
  width: number | null;
  height: number | null;
  cellW: number;
  cellH: number;
  frames: number;
  anchorX: number;
  anchorY: number;
  delays: number[];
  blend: EffectBlend;
}

/** [id, seq, action, frame, x, y, z, sx, sy, mixer, delay, dir]；id 1 = 施法者、2 = 目標，seq 為 null。 */
export type TimelineObject = [
  number,
  number | null,
  string,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number | null,
  number,
];

export interface TimelineFrame {
  t: number;
  o: TimelineObject[];
  e?: { type: string }[];
}

export interface EffectCaster {
  presetId: number;
  label: string;
  strips: StripSet;
}

export interface EffectTarget {
  npcId: number;
  name: string;
  strips: StripSet;
}

export interface SkillEffectBundle {
  magicId: number;
  tickMs: number;
  ticks: number;
  frames: TimelineFrame[];
  unknownNatives: string[] | null;
  sprites: EffectSprite[];
  casters: Partial<Record<EffectGender, EffectCaster>>;
  target: EffectTarget;
}

export interface Pose {
  /** strips 內的動作名。 */
  action: string;
  /** 動畫條上的格索引。 */
  index: number;
}

export const CASTER_ID = 1;
/** 播放長度 = 腳本 tick 數 + 收尾這麼多 tick（讓受擊、倒地、傷害數字演完）。 */
export const TAIL_TICKS = 30;
export const DAMAGE_NUMBER_TICKS = 45;

export function totalTicks(ticks: number): number {
  return ticks + TAIL_TICKS;
}

export const SPEED_OPTIONS = [
  { key: "tick", label: "1/60 秒", ms: null },
  { key: "slow", label: "1/30 秒（慢放）", ms: 33.3 },
  { key: "step", label: "0.1 秒（逐格）", ms: 100 },
] as const;

export type SpeedKey = (typeof SPEED_OPTIONS)[number]["key"];

export function msPerTick(speed: SpeedKey, tickMs: number): number {
  const opt = SPEED_OPTIONS.find((o) => o.key === speed);
  return opt?.ms ?? tickMs;
}

function sum(values: number[]): number {
  return values.reduce((s, n) => s + n, 0);
}

/**
 * 動畫條在「動作開始後第 ticksIn 個 tick」停在第幾格；播完回傳 -1。
 * override 非 0 時，每一格都改用這個 tick 數（腳本指定的 delay）。
 */
export function stripFrameIndex(delays: number[], ticksIn: number, override?: number | null): number {
  let t = ticksIn;
  for (let i = 0; i < delays.length; i++) {
    const n = override || delays[i];
    if (t < n) return i;
    t -= n;
  }
  return -1;
}

/** 腳本中所有「命中」tick（遞增、去重）。 */
export function hitTicks(frames: TimelineFrame[]): number[] {
  const out: number[] = [];
  for (const f of frames) {
    if (f.e?.some((e) => e.type === "hit") && !out.includes(f.t)) out.push(f.t);
  }
  return out.sort((a, b) => a - b);
}

/** 待機循環：用全域 tick 對整段動畫取餘數。 */
function loopPose(strips: StripSet, action: string, tick: number): Pose | null {
  const strip = strips[action];
  if (!strip) return null;
  const total = sum(strip.delays);
  if (total <= 0) return { action, index: 0 };
  const index = stripFrameIndex(strip.delays, tick % total);
  return { action, index: Math.max(0, index) };
}

/**
 * 施法者此刻的姿勢。entry 是時間軸當前格裡 id = 1 的物件（腳本已結束時傳 undefined）。
 * 動作名對不到、是 wait、或動作已播完，都回到 prepare 循環（沒有 prepare 時退而用 wait）。
 */
export function casterPose(
  entry: TimelineObject | undefined,
  strips: StripSet,
  tick: number,
): Pose | null {
  if (entry) {
    const action = entry[2].toLowerCase();
    const strip = action !== "wait" ? strips[action] : undefined;
    if (strip) {
      const index = stripFrameIndex(strip.delays, entry[3], entry[10]);
      if (index >= 0) return { action, index };
    }
  }
  return loopPose(strips, "prepare", tick) ?? loopPose(strips, "wait", tick);
}

/**
 * 目標此刻的姿勢：平時 wait 循環；每次命中後播 hurt；
 * kill = true 時，最後一次命中的 hurt 播完接 death 並停在最後一格。
 */
export function targetPose(tick: number, hits: number[], strips: StripSet, kill: boolean): Pose | null {
  const idle = () => loopPose(strips, "wait", tick);
  let last = -1;
  for (const h of hits) if (h <= tick) last = h;
  if (last < 0) return idle();

  const hurt = strips.hurt;
  if (!hurt) return idle();
  const sinceHit = tick - last;
  const hurtLen = sum(hurt.delays);

  if (kill && last === hits[hits.length - 1] && sinceHit >= hurtLen && strips.death) {
    const death = strips.death;
    // 最後一格通常是很大的停留值（999），只要走到它就停住。
    const hold = sum(death.delays.slice(0, -1));
    const index = stripFrameIndex(death.delays, Math.min(sinceHit - hurtLen, hold));
    return { action: "death", index: index < 0 ? Math.max(0, death.frames - 1) : index };
  }

  const index = stripFrameIndex(hurt.delays, sinceHit);
  return index >= 0 ? { action: "hurt", index } : idle();
}

export function spriteKey(seq: number, state: string): string {
  return `${seq}:${state.toLowerCase()}`;
}

export function indexSprites(sprites: EffectSprite[]): Map<string, EffectSprite> {
  return new Map(sprites.map((s) => [spriteKey(s.seq, s.state), s]));
}

/** 特效目前該畫哪一格（超出就停在最後一格）。 */
export function effectFrameIndex(frame: number, sprite: Pick<EffectSprite, "delays" | "frames">): number {
  const count = sprite.delays.length || sprite.frames;
  return Math.max(0, Math.min(frame, count - 1));
}

/** 時間軸裡實際會用到的 (seq, state) 組合（state 轉小寫、去重）。 */
export function referencedSprites(frames: TimelineFrame[]): { seq: number; state: string }[] {
  const seen = new Map<string, { seq: number; state: string }>();
  for (const f of frames) {
    for (const o of f.o) {
      if (o[1] == null) continue;
      const key = spriteKey(o[1], String(o[2]));
      if (!seen.has(key)) seen.set(key, { seq: o[1], state: String(o[2]).toLowerCase() });
    }
  }
  return [...seen.values()];
}
