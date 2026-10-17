import { SEARCH_TICKS } from "@/configs/idle";
import {
  drawActor,
  drawTimelineObjects,
  requestImage,
  type View,
} from "@/components/skills/skill-effect-canvas";
import {
  CASTER_ID,
  casterPose,
  loopPose,
  targetPose,
  type EffectSprite,
  type EffectTimeline,
  type Pose,
  type StripSet,
} from "@/lib/skill-effect";
import type { IdleData, IdleState } from "@/lib/idle/types";
import {
  POPUP_TICKS,
  attackFrameIndex,
  currentMonsterId,
  peekEncounter,
  searchesCompleted,
  type SceneFx,
} from "@/lib/idle/view";

// ---------------------------------------------------------------------------
// 場景座標：邏輯舞台高 stageH（桌面 420、手機 330），畫布依容器高度等比縮放；
// 技能演出的世界座標沿用 1.6 倍（與技能演出頁相同），怪物站在施法者右邊 200 世界單位。
// ---------------------------------------------------------------------------

const WORLD_SCALE = 1.6;
const TARGET_GAP = 200 * WORLD_SCALE;
const GROUND_RATIO = 0.8;
/** 找怪最後這段時間怪物從右邊走進來。 */
const SLIDE_TICKS = 80;
/** 背景捲動速度（地圖像素 / tick）；刻意比角色走路慢，當作遠景。 */
const SCROLL_PER_TICK = 0.9;

/**
 * 背景是預先裁好的一塊空曠沙地（地圖像素 1000x280，來自 stage 147 整張地圖的 (6010, 3010)），
 * 由 scripts/crop-idle-backdrop.mjs 產生，約 14 KB。整張地圖是 8800x8400 的 5 MB 圖，不再下載。
 * 該區下緣與右緣是海，所以只取左上這塊純沙地，捲到哪裡都不會出現海面。
 */
export const BACKDROP_URL = "/idle/backdrop-stage147.webp";
export const BACKDROP_SIZE = { w: 1000, h: 280 } as const;

/** 手機的場景（約 220 px 高）用較矮的邏輯舞台，角色才不會縮得太小。 */
export function stageHeightFor(cssHeight: number): number {
  return cssHeight <= 260 ? 330 : 420;
}

// ---------------------------------------------------------------------------
// 背景：載一次，之後每幀直接畫；載好前先用沙地底色。
// ---------------------------------------------------------------------------

let backdrop: HTMLImageElement | null = null;
let backdropRequest: Promise<void> | null = null;

export function loadBackdrop(url: string = BACKDROP_URL): Promise<void> {
  if (backdrop) return Promise.resolve();
  backdropRequest ??= new Promise<void>((resolve) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => {
      backdrop = im;
      resolve();
    };
    im.onerror = () => {
      // 下次再試；先用沙地底色。
      backdropRequest = null;
      resolve();
    };
    im.src = url;
  });
  return backdropRequest;
}

export function hasBackdrop(): boolean {
  return backdrop !== null;
}

/** 預載一組動作圖，載好就呼叫 onLoad。 */
export function preloadStrips(sets: StripSet[], onLoad: () => void): void {
  for (const set of sets) for (const strip of Object.values(set)) requestImage(strip.url, onLoad);
}

// ---------------------------------------------------------------------------

export interface SceneInput {
  state: IdleState;
  data: IdleData;
  fx: SceneFx;
  /** 場景時間（ticks）。 */
  clock: number;
  casterStrips: StripSet;
  monsterStrips: Record<number, StripSet>;
  /** 目前施放的技能時間軸；普攻或還沒載好為 null。 */
  timeline: EffectTimeline | null;
  sprites: Map<string, EffectSprite>;
  reducedMotion: boolean;
}

function drawSandFallback(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#d9c79a");
  g.addColorStop(1, "#bfa76f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** 背景：把裁切塊左右鏡射接起來，捲到邊界也看不出接縫。 */
function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, scroll: number) {
  if (!backdrop) {
    drawSandFallback(ctx, w, h);
    return;
  }
  const s = WORLD_SCALE;
  const bandH = Math.min(BACKDROP_SIZE.h, h / s);
  const srcY = (BACKDROP_SIZE.h - bandH) * 0.5;
  const period = BACKDROP_SIZE.w * 2;
  const p = ((scroll % period) + period) % period;
  for (let i = Math.floor(p / BACKDROP_SIZE.w); i < Math.floor(p / BACKDROP_SIZE.w) + 3; i++) {
    const left = (i * BACKDROP_SIZE.w - p) * s;
    if (left > w) break;
    ctx.save();
    if (i % 2 === 0) {
      ctx.translate(left, 0);
    } else {
      ctx.translate(left + BACKDROP_SIZE.w * s, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(backdrop, 0, srcY, BACKDROP_SIZE.w, bandH, 0, 0, BACKDROP_SIZE.w * s, bandH * s);
    ctx.restore();
  }
  // 壓一層暗，讓傷害數字與血條在亮沙地上也讀得到；場景不跟網站主題走。
  ctx.fillStyle = "rgba(20,14,6,.18)";
  ctx.fillRect(0, 0, w, h);
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, alpha = 0.28) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx * WORLD_SCALE, 9 * WORLD_SCALE, 0, 0, Math.PI * 2);
  ctx.fill();
}

const easeOut = (q: number) => 1 - (1 - q) * (1 - q);

function casterPoseFor(input: SceneInput): { pose: Pose | null; timelineEntry: number | null } {
  const { state, casterStrips: strips, clock, timeline, reducedMotion } = input;
  const phase = state.phase;
  const rest = loopPose(strips, "prepare", clock) ?? loopPose(strips, "wait", clock);
  if (phase.kind === "searching") {
    const walk = reducedMotion ? null : loopPose(strips, "walk", clock);
    return { pose: walk ?? rest, timelineEntry: null };
  }
  if (phase.kind !== "casting") return { pose: rest, timelineEntry: null };
  if (phase.skillId != null) {
    if (!timeline) return { pose: rest, timelineEntry: null };
    const entry = phase.elapsed < timeline.frames.length ? phase.elapsed : null;
    const casterEntry = entry != null ? timeline.frames[entry].o.find((o) => o[0] === CASTER_ID && o[12] == null) : undefined;
    return { pose: casterPose(casterEntry, strips, clock), timelineEntry: entry };
  }
  const attack = strips.attack1;
  if (!attack) return { pose: rest, timelineEntry: null };
  // 普攻：命中那一格對齊這次揮擊預先抽好的命中時刻；攻速高、週期比動畫短時整段加快。
  const hitAt = phase.pending[0]?.at ?? phase.castTicks;
  const index = attackFrameIndex(attack.delays, phase.elapsed, hitAt);
  return { pose: index >= 0 ? { action: "attack1", index } : rest, timelineEntry: null };
}

interface MonsterView {
  id: number;
  x: number;
  alpha: number;
  pose: Pose | null;
  hp: number | null;
}

/** 目前場上有沒有怪、在哪、什麼姿勢。 */
function monsterView(input: SceneInput, x0: number, width: number): MonsterView | null {
  const { state, data, fx, clock, monsterStrips, reducedMotion } = input;
  const phase = state.phase;
  const home = x0 + TARGET_GAP;
  if (phase.kind === "searching") {
    const spent = SEARCH_TICKS - phase.remaining;
    if (fx.monsterId != null && fx.goneAt != null && clock < fx.goneAt) {
      // 剛擊倒的屍體：留在原地、隨背景往後退，最後淡出。
      const strips = monsterStrips[fx.monsterId];
      const drift = reducedMotion ? 0 : spent * SCROLL_PER_TICK * WORLD_SCALE;
      return {
        id: fx.monsterId,
        x: home - drift,
        alpha: Math.min(1, (fx.goneAt - clock) / 20),
        pose: strips ? targetPose(clock, fx.hurts, strips, fx.killAt != null) : null,
        hp: null,
      };
    }
    const slideStart = SEARCH_TICKS - SLIDE_TICKS;
    if (spent < slideStart) return null;
    const id = peekEncounter(state, data);
    if (id == null) return null;
    const strips = monsterStrips[id] ?? {};
    const q = Math.min(1, (spent - slideStart) / SLIDE_TICKS);
    const arrived = q >= 1 || reducedMotion;
    return {
      id,
      x: arrived ? home : width + 90 + (home - width - 90) * easeOut(q),
      alpha: 1,
      pose: arrived ? loopPose(strips, "wait", clock) : loopPose(strips, "walk", clock),
      // 找怪中還沒有開打：不畫名字與血條（遇怪事件之後才有）。
      hp: null,
    };
  }
  const id = currentMonsterId(state, fx);
  if (id == null) return null;
  const strips = monsterStrips[id];
  if (!strips) return null;
  return {
    id,
    x: home,
    alpha: 1,
    pose: targetPose(clock, fx.hurts, strips, fx.killAt != null),
    hp: phase.kind === "blocked" ? (data.monsters[id]?.hp ?? null) : phase.hp,
  };
}

const FONT = '"Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif';
const DAMAGE_FONT = '900 26px "Noto Serif TC", "Microsoft JhengHei", serif';

function drawPopups(ctx: CanvasRenderingContext2D, fx: SceneFx, clock: number, x: number, baseY: number) {
  const alive = fx.popups.filter((p) => p.at <= clock && clock - p.at <= POPUP_TICKS + 25);
  if (alive.length === 0) return;
  const lastAt = alive[alive.length - 1].at;
  const fade = Math.min(1, (lastAt + POPUP_TICKS - clock) / 20);
  const rowHeight = Math.min(28, (baseY - 24) / Math.max(1, alive.length - 1));
  ctx.save();
  ctx.textAlign = "center";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  alive.forEach((p, row) => {
    const pop = Math.min(clock - p.at, 6) / 6;
    ctx.globalAlpha = Math.max(0, pop * fade);
    const y = baseY - row * rowHeight - pop * 8;
    let text: string;
    if (p.kind === "miss") {
      ctx.font = `700 20px ${FONT}`;
      ctx.strokeStyle = "#1c1917";
      ctx.fillStyle = "#e7e5e4";
      text = "未命中";
    } else {
      ctx.font = p.kind === "crit" ? '900 32px "Noto Serif TC", "Microsoft JhengHei", serif' : DAMAGE_FONT;
      ctx.strokeStyle = "#2a0b05";
      ctx.fillStyle = p.kind === "crit" ? "#ff8a4d" : "#ffcf5a";
      text = String(p.damage);
    }
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  });
  ctx.restore();
}

function drawHpBar(
  ctx: CanvasRenderingContext2D,
  name: string,
  level: number,
  hp: number,
  maxHp: number,
  cx: number,
  top: number,
  px: number,
) {
  const w = 132 / px;
  const h = 6 / px;
  const x = cx - w / 2;
  ctx.save();
  ctx.font = `500 ${12 / px}px ${FONT}`;
  ctx.fillStyle = "#fafaf9";
  ctx.shadowColor = "rgba(0,0,0,.85)";
  ctx.shadowBlur = 3 / px;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillText(`${name} Lv${level}`, x, top - 5 / px);
  ctx.textAlign = "right";
  ctx.fillText(`${hp} / ${maxHp}`, x + w, top - 5 / px);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(0,0,0,.5)";
  ctx.beginPath();
  ctx.roundRect(x, top, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.roundRect(x, top, Math.max(h, (w * hp) / Math.max(1, maxHp)), h, h / 2);
  if (hp > 0) ctx.fill();
  ctx.restore();
}

/** 畫一幀。cssW / cssH 是畫布的顯示尺寸（px），dpr 是裝置像素比。 */
export function drawIdleScene(ctx: CanvasRenderingContext2D, input: SceneInput, cssW: number, cssH: number, dpr: number) {
  const stageH = stageHeightFor(cssH);
  const k = cssH / stageH;
  const width = cssW / k;
  const ground = stageH * GROUND_RATIO;
  const x0 = Math.max(110, width / 2 - TARGET_GAP / 2);
  const px = k; // 1 邏輯單位 = k css px；畫螢幕固定大小的文字時用它換算

  ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = false;

  const scroll = input.reducedMotion ? 0 : searchesCompleted(input.state) * SEARCH_TICKS * SCROLL_PER_TICK;
  drawBackground(ctx, width, stageH, scroll);

  const monster = monsterView(input, x0, width);
  const casterView: View = { x0, ground, s: WORLD_SCALE };

  shadow(ctx, x0, ground, 34);
  if (monster) {
    ctx.save();
    ctx.globalAlpha = monster.alpha;
    shadow(ctx, monster.x, ground, 30);
    ctx.restore();
  }

  const { pose, timelineEntry } = casterPoseFor(input);
  drawActor(ctx, input.casterStrips, pose, 0, false, 0, 1, casterView);

  const monsterStrips = monster ? (input.monsterStrips[monster.id] ?? null) : null;
  if (monster && monsterStrips) {
    drawActor(ctx, monsterStrips, monster.pose, 0, true, 0, monster.alpha, { x0: monster.x, ground, s: WORLD_SCALE });
  }
  if (timelineEntry != null && input.timeline) {
    drawTimelineObjects(
      ctx,
      input.timeline.frames[timelineEntry].o,
      input.sprites,
      input.casterStrips,
      monsterStrips,
      input.clock,
      casterView,
    );
  }

  if (monster && monsterStrips) {
    // 血條固定在最高的姿勢（受擊、走路、待機）上方，受擊時才不會被怪物蓋住。
    const tallest = Math.max(60, ...["wait", "walk", "hurt"].map((a) => monsterStrips[a]?.anchorY ?? 0));
    const top = ground - tallest * WORLD_SCALE - 26;
    if (monster.hp != null && monster.hp > 0) {
      const info = input.data.monsters[monster.id];
      if (info) drawHpBar(ctx, info.name, info.level, monster.hp, info.hp, monster.x, top, px);
    }
    drawPopups(ctx, input.fx, input.clock, monster.x, top - 22);
  }
}
