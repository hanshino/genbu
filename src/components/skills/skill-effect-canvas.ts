import {
  CASTER_ID,
  DAMAGE_NUMBER_TICKS,
  casterPose,
  clonePose,
  effectFrameIndex,
  spriteKey,
  targetPose,
  type ActorStrip,
  type EffectBlend,
  type EffectSprite,
  type EffectTimeline,
  type Pose,
  type StripSet,
  type TimelineObject,
} from "@/lib/skill-effect";

// 舞台是固定的 960x540 畫布；世界座標 (0,0,0) 對到 (X0, GROUND)，S 是放大倍率。
export const STAGE_W = 960;
export const STAGE_H = 540;
const S = 1.6;
const GROUND = 430;
const X0 = 480 - 100 * S;
const CASTER_X = 0;
const TARGET_X = 200;

/** 世界座標 (0,0,0) 對到畫布 (x0, ground)，s 是放大倍率。技能演出頁用 DEFAULT_VIEW；放置掛機的場景自己決定。 */
export interface View {
  x0: number;
  ground: number;
  s: number;
}

export const DEFAULT_VIEW: View = { x0: X0, ground: GROUND, s: S };

const BLEND_OPS: Record<EffectBlend, GlobalCompositeOperation> = {
  add: "lighter",
  sub: "multiply",
  alpha: "source-over",
  normal: "source-over",
};

const imageCache = new Map<string, HTMLImageElement>();

function isReady(im: HTMLImageElement | undefined): im is HTMLImageElement {
  return im !== undefined && im.complete && im.naturalWidth > 0;
}

/** 已載入完成的圖片（沒載好回傳 undefined）。 */
export function readyImage(url: string): HTMLImageElement | undefined {
  const im = imageCache.get(url);
  return isReady(im) ? im : undefined;
}

/** 取得（必要時開始載入）圖片；載入完成時呼叫 onLoad。同一個網址只會載一次。 */
export function requestImage(url: string, onLoad: () => void): void {
  let im = imageCache.get(url);
  if (!im) {
    im = new Image();
    im.src = url;
    imageCache.set(url, im);
  }
  if (im.complete && im.naturalWidth > 0) return;
  im.addEventListener("load", onLoad, { once: true });
}

export interface SceneInput {
  timeline: EffectTimeline;
  /** indexSprites(bundle.sprites) */
  sprites: Map<string, EffectSprite>;
  casterStrips: StripSet;
  /** 不畫怪物（自己 / 隊友）時為 null，也不畫受擊與傷害數字。 */
  targetStrips: StripSet | null;
  hits: number[];
  tick: number;
  kill: boolean;
}

/** x/y/z 是腳本座標；alpha 與 lift 讓分身能照自己的位置與透明度畫。 */
export function drawActor(
  ctx: CanvasRenderingContext2D,
  strips: StripSet,
  pose: Pose | null,
  x: number,
  mirror: boolean,
  lift = 0,
  alpha = 1,
  view: View = DEFAULT_VIEW,
) {
  if (!pose || alpha <= 0) return;
  const strip: ActorStrip | undefined = strips[pose.action];
  const im = strip && imageCache.get(strip.url);
  if (!strip || !isReady(im)) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(view.x0 + x * view.s, view.ground - lift * view.s);
  ctx.scale(mirror ? -view.s : view.s, view.s);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(im, pose.index * strip.cellW, 0, strip.cellW, strip.cellH, -strip.anchorX, -strip.anchorY, strip.cellW, strip.cellH);
  ctx.restore();
}

export function drawEffect(
  ctx: CanvasRenderingContext2D,
  o: TimelineObject,
  sprites: Map<string, EffectSprite>,
  view: View = DEFAULT_VIEW,
) {
  const [, seq, action, frame, x, y, z, sx, sy, mixer] = o;
  if (seq == null) return;
  const sprite = sprites.get(spriteKey(seq, String(action)));
  const im = sprite && imageCache.get(sprite.url);
  if (!sprite || !isReady(im)) return;
  const f = effectFrameIndex(frame, sprite);
  ctx.save();
  ctx.globalCompositeOperation = BLEND_OPS[sprite.blend];
  ctx.globalAlpha = Math.max(0, Math.min(1, mixer / 32));
  ctx.translate(view.x0 + x * view.s, view.ground - (y + z) * view.s);
  ctx.scale((sx || 1) * view.s, (sy || 1) * view.s);
  ctx.drawImage(im, f * sprite.cellW, 0, sprite.cellW, sprite.cellH, -sprite.anchorX, -sprite.anchorY, sprite.cellW, sprite.cellH);
  ctx.restore();
}

function drawBackdrop(ctx: CanvasRenderingContext2D, withTarget: boolean) {
  // 加算混合的特效需要暗底，所以舞台不跟網站主題走。
  const bg = ctx.createLinearGradient(0, 0, 0, STAGE_H);
  bg.addColorStop(0, "#0b0e16");
  bg.addColorStop(0.7, "#151b28");
  bg.addColorStop(0.71, "#1f2a24");
  bg.addColorStop(1, "#0f1512");
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  ctx.fillStyle = "rgba(0,0,0,.35)";
  for (const x of withTarget ? [CASTER_X, TARGET_X] : [CASTER_X]) {
    ctx.beginPath();
    ctx.ellipse(X0 + x * S, GROUND, 34 * S, 9 * S, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

const DAMAGE_ROW_HEIGHT = 28;
const DAMAGE_POP_TICKS = 6;
const DAMAGE_FADE_TICKS = 20;

// 佔位用的傷害數字：每次命中各佔一排、由下往上疊，最後一擊之後一起淡出。
function drawDamageNumbers(ctx: CanvasRenderingContext2D, hits: number[], tick: number) {
  if (hits.length === 0) return;
  const end = hits[hits.length - 1] + DAMAGE_NUMBER_TICKS;
  if (tick > end) return;
  const fade = Math.min(1, (end - tick) / DAMAGE_FADE_TICKS);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.font = '900 26px "Noto Serif TC", "Microsoft JhengHei", serif';
  ctx.textAlign = "center";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#2a0b05";
  ctx.fillStyle = "#ffcf5a";
  // 最多 10 段：段數多時壓縮排距，讓最上面一排不超出畫布。
  const baseY = GROUND - 120 * S;
  const rowHeight = Math.min(DAMAGE_ROW_HEIGHT, (baseY - 40) / Math.max(1, hits.length - 1));
  hits.forEach((h, row) => {
    const dt = tick - h;
    if (dt < 0) return;
    const pop = Math.min(dt, DAMAGE_POP_TICKS) / DAMAGE_POP_TICKS;
    ctx.globalAlpha = pop * fade;
    const y = baseY - row * rowHeight - pop * 8;
    ctx.strokeText("1234", X0 + TARGET_X * S, y);
    ctx.fillText("1234", X0 + TARGET_X * S, y);
  });
  ctx.restore();
}

/** 特效與分身依腳本順序畫（分身是帶 cloneOf 的角色物件，淡入淡出靠 mixer）。 */
export function drawTimelineObjects(
  ctx: CanvasRenderingContext2D,
  objects: TimelineObject[],
  sprites: Map<string, EffectSprite>,
  casterStrips: StripSet,
  targetStrips: StripSet | null,
  tick: number,
  view: View = DEFAULT_VIEW,
) {
  for (const o of objects) {
    if (o[1] != null) {
      drawEffect(ctx, o, sprites, view);
    } else if (o[12] != null) {
      const clone = clonePose(o, casterStrips, targetStrips, tick);
      if (!clone) continue;
      const alpha = Math.max(0, Math.min(1, o[9] / 32));
      const mirror = clone.source === "target";
      drawActor(ctx, mirror ? (targetStrips as StripSet) : casterStrips, clone.pose, o[4], mirror, o[5] + o[6], alpha, view);
    }
  }
}

export function drawScene(ctx: CanvasRenderingContext2D, scene: SceneInput) {
  const { timeline, sprites, casterStrips, targetStrips, hits, tick, kill } = scene;
  drawBackdrop(ctx, targetStrips !== null);

  const entry = tick < timeline.frames.length ? timeline.frames[tick] : undefined;
  const casterEntry = entry?.o.find((o) => o[0] === CASTER_ID && o[12] == null);

  drawActor(ctx, casterStrips, casterPose(casterEntry, casterStrips, tick), CASTER_X, false);
  if (targetStrips) {
    drawActor(ctx, targetStrips, targetPose(tick, hits, targetStrips, kill), TARGET_X, true);
  }
  if (entry) drawTimelineObjects(ctx, entry.o, sprites, casterStrips, targetStrips, tick);
  if (targetStrips) drawDamageNumbers(ctx, hits, tick);
}
