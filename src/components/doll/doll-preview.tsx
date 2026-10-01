"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { DollFrame, DollPart, DollRule } from "@/lib/queries/doll";
import { cn } from "@/lib/utils";

/** 場景是 120×120 的原始像素空間，原點固定在 root（褲子／坐騎）的腳底錨點。 */
const SCENE = 120;
const ORIGIN_X = 60;
const ORIGIN_Y = 102;

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

  const selected: { rule: DollRule; frame: DollFrame; mirrored: boolean }[] = [];
  for (const rule of rules) {
    if (rule.dir !== dir) continue;
    const key = `${rule.slot}:${rule.mirrorOf ?? dir}`;
    const color = rule.slot === "head" ? hairColor : 0;
    const frame =
      frameBy.get(`${key}:${pose}:${color}`) ??
      frameBy.get(`${key}:${pose}:0`) ??
      frameBy.get(`${key}:${fallback}:${color}`) ??
      frameBy.get(`${key}:${fallback}:0`);
    if (!frame) continue;
    const mirrored = rule.mirrorOf != null;
    selected.push({ rule, frame, mirrored });
  }
  const horse = selected.find((layer) => layer.frame.slot === "horse");
  const root = horse ?? selected.find((layer) => layer.frame.slot === "foot");
  const body = selected.find((layer) => layer.frame.slot === "body");
  const point = (layer: typeof root, index: number | null): [number, number] => {
    const p = index === null ? null : layer?.frame.points?.[index];
    // points 是來源方向的原值；鏡像只在這裡決定 x 的符號，不再翻一次。
    return p ? [layer?.mirrored ? p[0] : -p[0], -p[1]] : [0, 0];
  };
  return selected
    .filter((layer) => !horse || layer.frame.slot !== "foot")
    .map(({ rule, frame, mirrored }) => {
      let [x, y] = [0, 0];
      if (rule.attachTo === "root") [x, y] = point(root, rule.attachPoint);
      if (rule.attachTo === "body") {
        const [rx, ry] = point(root, 0);
        const [bx, by] = point(body, rule.attachPoint);
        [x, y] = [rx + bx, ry + by];
      }
      const anchorX = mirrored ? frame.width - frame.anchorX : frame.anchorX;
      return {
        frame,
        mirrored,
        left: ORIGIN_X + x - anchorX,
        top: ORIGIN_Y + y - frame.anchorY,
        zIndex: rule.zOrder,
      };
    });
}

interface Props {
  frames: DollFrame[];
  rules: DollRule[];
  dir: number;
  /** 要畫哪些部位（frames 是一整包時用）；不給就全畫 */
  parts?: DollPart[];
  hairColor?: number;
  /**
   * 想要的倍率。不給的話讀 CSS 變數 `--doll-scale`（方便用 class 做 RWD），預設 4。
   * 場景放不進父層時會自動縮小：先找放得下的最大整數倍率，連 1x 都放不下才用小數。
   * 父層的可用高度取自它的 `max-height`（沒設就只看寬度）。
   */
  scale?: number;
  className?: string;
}

const ALL_DIRS = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * 畫布範圍：至少是 120×120 的場景，大型背飾、坐騎超出時往外撐。
 * 取 8 個方向的聯集，轉方向時角色才不會跳來跳去。
 */
function sceneBox(frames: DollFrame[], rules: DollRule[], parts?: DollPart[], hairColor = 0) {
  let [x0, y0, x1, y1] = [0, 0, SCENE, SCENE];
  for (const d of ALL_DIRS) {
    for (const l of buildDollLayers(frames, rules, d, parts, hairColor)) {
      x0 = Math.min(x0, l.left);
      y0 = Math.min(y0, l.top);
      x1 = Math.max(x1, l.left + l.frame.width);
      y1 = Math.max(y1, l.top + l.frame.height);
    }
  }
  return { x0, y0, w: x1 - x0, h: y1 - y0 };
}

/** 場景和父層邊緣至少留這麼多 px，避免貼邊 */
const FIT_PAD = 8;

/**
 * 算出放得進父層的倍率；伺服器端與第一次 render 回傳 null（照 CSS 變數畫），
 * 掛上後在 paint 前量一次，之後父層尺寸變了再重算。
 */
function useFitScale(
  ref: React.RefObject<HTMLDivElement | null>,
  w: number,
  h: number,
  scale?: number,
) {
  // undefined = 還沒量（伺服器端與 hydration 前）；null = 想要的倍率就放得下
  const [fit, setFit] = useState<number | null | undefined>(undefined);
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const measure = () => {
      const want = scale ?? (Number(getComputedStyle(el).getPropertyValue("--doll-scale")) || 4);
      const maxH = parseFloat(getComputedStyle(parent).maxHeight);
      const availW = parent.clientWidth - FIT_PAD * 2;
      const availH = Number.isFinite(maxH) ? maxH - FIT_PAD * 2 : Infinity;
      const room = Math.min(availW / w, availH / h);
      const next = room >= want ? want : room >= 1 ? Math.floor(room) : Math.max(room, 0.25);
      setFit(next === want ? null : next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [ref, w, h, scale]);
  return fit;
}

export function DollPreview({ frames, rules, dir, parts, hairColor = 0, scale, className }: Props) {
  const layers = buildDollLayers(frames, rules, dir, parts, hairColor);
  const box = sceneBox(frames, rules, parts, hairColor);
  const ref = useRef<HTMLDivElement>(null);
  const fit = useFitScale(ref, box.w, box.h, scale);
  // --doll-scale 是想要的倍率（class / prop），--doll-fit 是實際用的；不另外寫 inline --doll-scale，量測才讀得到 class 的值
  const k = "var(--doll-fit, var(--doll-scale, 4))";
  // 超出預設場景的大圖（大型坐騎）在量到父層之前先佔預設場景的大小、不顯示，
  // 避免 hydration 前以 4x 撐爆舞台再縮回來的跳動。一般角色照常直接畫。
  const oversized = box.w > SCENE * 1.5 || box.h > SCENE * 1.5;
  const pending = fit === undefined && oversized;

  return (
    <div
      ref={ref}
      role="img"
      aria-label="角色外觀預覽"
      className={cn("relative shrink-0", className)}
      style={
        {
          ...((fit ?? scale) != null ? { "--doll-fit": fit ?? scale } : null),
          width: `calc(${pending ? Math.min(box.w, SCENE) : box.w}px * ${k})`,
          height: `calc(${pending ? Math.min(box.h, SCENE) : box.h}px * ${k})`,
          ...(pending ? { visibility: "hidden", overflow: "hidden" } : null),
        } as CSSProperties
      }
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: box.w, height: box.h, transform: `scale(${k})` }}
      >
        {/* 腳下陰影 */}
        <div
          aria-hidden
          className="absolute rounded-[50%] opacity-30 dark:opacity-60"
          style={{
            left: ORIGIN_X - 22 - box.x0,
            top: ORIGIN_Y - box.y0,
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
