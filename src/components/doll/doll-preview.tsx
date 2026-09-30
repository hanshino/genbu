import type { CSSProperties } from "react";
import type { DollFrame, DollPart, DollRide, DollRule } from "@/lib/queries/doll";
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
 *
 * 姿勢跟遊戲一樣：只要有畫到武器（右手或左手），全身都改用備戰（prepare）圖，
 * 沒有武器就用站立（wait）圖；某一層缺那個姿勢時退回另一個。
 */
export function buildDollLayers(
  frames: DollFrame[],
  rules: DollRule[],
  dir: number,
  parts?: DollPart[],
  rides?: DollRide[],
  hairColor = 0,
): DollLayer[] {
  const wanted = parts && new Set(parts.map((p) => `${p.slot}:${p.sequence}`));
  const frameBy = new Map<string, DollFrame>();
  let armed = false;
  for (const f of frames) {
    if (wanted && !wanted.has(`${f.slot}:${f.sequence}`)) continue;
    if (f.color !== 0 && (f.slot !== "head" || f.color !== hairColor)) continue;
    const key = `${f.slot}:${f.dir}:${f.action}:${f.color}`;
    if (!frameBy.has(key)) frameBy.set(key, f);
    if (f.slot === "right" || f.slot === "left") armed = true;
  }
  const [pose, fallback] = armed ? ["prepare", "wait"] : ["wait", "prepare"];

  const layers: DollLayer[] = [];
  for (const rule of rules) {
    if (rule.dir !== dir) continue;
    const key = `${rule.slot}:${rule.mirrorOf ?? dir}`;
    const color = rule.slot === "head" ? hairColor : 0;
    const frame = frameBy.get(`${key}:${pose}:${color}`)
      ?? frameBy.get(`${key}:${pose}:0`)
      ?? frameBy.get(`${key}:${fallback}:${color}`)
      ?? frameBy.get(`${key}:${fallback}:0`);
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
  const horse = layers.find((layer) => layer.frame.slot === "horse");
  const ride = horse && rides?.find((row) => row.sequence === horse.frame.sequence && row.dir === dir);
  if (ride) {
    for (const layer of layers) {
      if (layer.frame.slot === "horse") continue;
      layer.left += ride.dx;
      layer.top += ride.dy;
    }
  }
  return layers;
}

interface Props {
  frames: DollFrame[];
  rules: DollRule[];
  dir: number;
  /** 要畫哪些部位（frames 是一整包時用）；不給就全畫 */
  parts?: DollPart[];
  rides?: DollRide[];
  hairColor?: number;
  /** 整數倍率。不給的話讀 CSS 變數 `--doll-scale`（方便用 class 做 RWD），預設 4。 */
  scale?: number;
  className?: string;
}

const ALL_DIRS = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * 畫布範圍：至少是 120×120 的場景，大型背飾、坐騎超出時往外撐。
 * 取 8 個方向的聯集，轉方向時角色才不會跳來跳去。
 */
function sceneBox(frames: DollFrame[], rules: DollRule[], parts?: DollPart[], rides?: DollRide[], hairColor = 0) {
  let [x0, y0, x1, y1] = [0, 0, SCENE, SCENE];
  for (const d of ALL_DIRS) {
    for (const l of buildDollLayers(frames, rules, d, parts, rides, hairColor)) {
      x0 = Math.min(x0, l.left);
      y0 = Math.min(y0, l.top);
      x1 = Math.max(x1, l.left + l.frame.width);
      y1 = Math.max(y1, l.top + l.frame.height);
    }
  }
  return { x0, y0, w: x1 - x0, h: y1 - y0 };
}

export function DollPreview({ frames, rules, dir, parts, rides, hairColor = 0, scale, className }: Props) {
  const layers = buildDollLayers(frames, rules, dir, parts, rides, hairColor);
  const box = sceneBox(frames, rules, parts, rides, hairColor);

  return (
    <div
      role="img"
      aria-label="角色外觀預覽"
      className={cn("relative shrink-0", className)}
      style={
        {
          ...(scale ? { "--doll-scale": scale } : null),
          width: `calc(${box.w}px * var(--doll-scale, 4))`,
          height: `calc(${box.h}px * var(--doll-scale, 4))`,
        } as CSSProperties
      }
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: box.w, height: box.h, transform: "scale(var(--doll-scale, 4))" }}
      >
        {/* 腳下陰影 */}
        <div
          aria-hidden
          className="absolute rounded-[50%] opacity-30 dark:opacity-60"
          style={{
            left: ORIGIN_X - 22 - box.x0,
            top: ORIGIN_Y + 33 - box.y0,
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
            style={{
              left: left - box.x0,
              top: top - box.y0,
              zIndex,
              transform: mirrored ? "scaleX(-1)" : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}
