import type { CSSProperties } from "react";
import type { DollFrame, DollPart, DollRule } from "@/lib/queries/doll";
import { cn } from "@/lib/utils";

/** 場景是 120×120 的原始像素空間，角色原點（脖子／腳底共用的掛點）固定在這裡。 */
const SCENE = 120;
const ORIGIN_X = 60;
const ORIGIN_Y = 70;

export interface DollLayer {
  frame: DollFrame;
  mirrored: boolean;
  left: number;
  top: number;
  zIndex: number;
}

/**
 * 依方向算出每一層的位置。規則全部來自 DB（doll_slot_rules），這裡不寫死偏移。
 * frames 可以是一整包圖；有給 parts 就只畫 parts 列出的部位，沒給就每個部位取第一組。
 * 缺圖的部位直接跳過。
 */
export function buildDollLayers(
  frames: DollFrame[],
  rules: DollRule[],
  dir: number,
  parts?: DollPart[],
): DollLayer[] {
  const wanted = parts && new Set(parts.map((p) => `${p.slot}:${p.sequence}`));
  const frameBy = new Map<string, DollFrame>();
  for (const f of frames) {
    if (wanted && !wanted.has(`${f.slot}:${f.sequence}`)) continue;
    const key = `${f.slot}:${f.dir}`;
    if (!frameBy.has(key)) frameBy.set(key, f);
  }

  const layers: DollLayer[] = [];
  for (const rule of rules) {
    if (rule.dir !== dir) continue;
    const frame = frameBy.get(`${rule.slot}:${rule.mirrorOf ?? dir}`);
    if (!frame) continue;
    const mirrored = rule.mirrorOf != null;
    const anchorX = mirrored ? frame.width - frame.anchorX : frame.anchorX;
    layers.push({
      frame,
      mirrored,
      left: ORIGIN_X - anchorX + rule.offsetX,
      top: ORIGIN_Y - frame.anchorY + rule.offsetY,
      zIndex: rule.zOrder,
    });
  }
  return layers;
}

interface Props {
  frames: DollFrame[];
  rules: DollRule[];
  dir: number;
  /** 要畫哪些部位（frames 是一整包時用）；不給就全畫 */
  parts?: DollPart[];
  /** 整數倍率。不給的話讀 CSS 變數 `--doll-scale`（方便用 class 做 RWD），預設 4。 */
  scale?: number;
  className?: string;
}

export function DollPreview({ frames, rules, dir, parts, scale, className }: Props) {
  const layers = buildDollLayers(frames, rules, dir, parts);
  const size = `calc(${SCENE}px * var(--doll-scale, 4))`;

  return (
    <div
      role="img"
      aria-label="角色外觀預覽"
      className={cn("relative shrink-0", className)}
      style={
        {
          ...(scale ? { "--doll-scale": scale } : null),
          width: size,
          height: size,
        } as CSSProperties
      }
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: SCENE, height: SCENE, transform: "scale(var(--doll-scale, 4))" }}
      >
        {/* 腳下陰影 */}
        <div
          aria-hidden
          className="absolute rounded-[50%] opacity-30 dark:opacity-60"
          style={{
            left: ORIGIN_X - 22,
            top: ORIGIN_Y + 33,
            width: 44,
            height: 10,
            background: "radial-gradient(ellipse at center, #000, transparent 70%)",
          }}
        />
        {layers.map(({ frame, mirrored, left, top, zIndex }) => (
          // eslint-disable-next-line @next/next/no-img-element -- 像素原圖 hotlink，不走 next/image 重新取樣
          <img
            key={`${frame.slot}:${frame.sequence}`}
            src={frame.url}
            alt=""
            width={frame.width}
            height={frame.height}
            draggable={false}
            className="absolute max-w-none select-none [image-rendering:pixelated]"
            style={{ left, top, zIndex, transform: mirrored ? "scaleX(-1)" : undefined }}
          />
        ))}
      </div>
    </div>
  );
}
