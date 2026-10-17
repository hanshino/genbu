import {
  CASTER_ID,
  DAMAGE_NUMBER_TICKS,
  casterPose,
  effectFrameIndex,
  spriteKey,
  targetPose,
  type ActorStrip,
  type EffectBlend,
  type EffectSprite,
  type Pose,
  type SkillEffectBundle,
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
  bundle: SkillEffectBundle;
  /** indexSprites(bundle.sprites) */
  sprites: Map<string, EffectSprite>;
  casterStrips: StripSet;
  hits: number[];
  tick: number;
  kill: boolean;
}

function drawActor(
  ctx: CanvasRenderingContext2D,
  strips: StripSet,
  pose: Pose | null,
  x: number,
  mirror: boolean,
) {
  if (!pose) return;
  const strip: ActorStrip | undefined = strips[pose.action];
  const im = strip && imageCache.get(strip.url);
  if (!strip || !isReady(im)) return;
  ctx.save();
  ctx.translate(X0 + x * S, GROUND);
  ctx.scale(mirror ? -S : S, S);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(im, pose.index * strip.cellW, 0, strip.cellW, strip.cellH, -strip.anchorX, -strip.anchorY, strip.cellW, strip.cellH);
  ctx.restore();
}

function drawEffect(
  ctx: CanvasRenderingContext2D,
  o: TimelineObject,
  sprites: Map<string, EffectSprite>,
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
  ctx.translate(X0 + x * S, GROUND - (y + z) * S);
  ctx.scale((sx || 1) * S, (sy || 1) * S);
  ctx.drawImage(im, f * sprite.cellW, 0, sprite.cellW, sprite.cellH, -sprite.anchorX, -sprite.anchorY, sprite.cellW, sprite.cellH);
  ctx.restore();
}

function drawBackdrop(ctx: CanvasRenderingContext2D) {
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
  for (const x of [CASTER_X, TARGET_X]) {
    ctx.beginPath();
    ctx.ellipse(X0 + x * S, GROUND, 34 * S, 9 * S, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 佔位用的傷害數字：命中後往上飄、淡出。
function drawDamageNumbers(ctx: CanvasRenderingContext2D, hits: number[], tick: number) {
  for (const h of hits) {
    const dt = tick - h;
    if (dt < 0 || dt > DAMAGE_NUMBER_TICKS) continue;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1 - Math.max(0, dt - 25) / 20;
    ctx.font = '900 30px "Noto Serif TC", "Microsoft JhengHei", serif';
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#2a0b05";
    ctx.fillStyle = "#ffcf5a";
    const y = GROUND - 120 * S - Math.min(dt, 25) * 2;
    ctx.strokeText("1234", X0 + TARGET_X * S, y);
    ctx.fillText("1234", X0 + TARGET_X * S, y);
    ctx.restore();
  }
}

export function drawScene(ctx: CanvasRenderingContext2D, scene: SceneInput) {
  const { bundle, sprites, casterStrips, hits, tick, kill } = scene;
  drawBackdrop(ctx);

  const inScript = tick < bundle.frames.length;
  const entry = inScript ? bundle.frames[tick] : undefined;
  const casterEntry = entry?.o.find((o) => o[0] === CASTER_ID);

  drawActor(ctx, casterStrips, casterPose(casterEntry, casterStrips, tick), CASTER_X, false);
  drawActor(ctx, bundle.target.strips, targetPose(tick, hits, bundle.target.strips, kill), TARGET_X, true);
  if (entry) {
    for (const o of entry.o) if (o[1] != null) drawEffect(ctx, o, sprites);
  }
  drawDamageNumbers(ctx, hits, tick);
}
