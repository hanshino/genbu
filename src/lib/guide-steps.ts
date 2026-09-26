import type { EntityImage } from "@/lib/queries/images";
import type { StageMapImage } from "@/lib/queries/maps";

// Dungeon guide step data contract (frozen A0). MDX authors only write StepInput;
// everything in StepData comes from the DB server-side.

/** Composite-image pixel bbox [x0, y0, x1, y1], top-left origin, Y down. */
export type Crop = [x0: number, y0: number, x1: number, y1: number];

export interface Point {
  x: number;
  y: number;
}

/** 抗性對應為推論；缺值或超出已知規則時不宣稱可施加。 */
export function formatStatusResistance(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value > 100) return "待確認";
  return value === 100 ? "不可" : "可";
}

export interface StepGroupInput {
  ids: number[];
  /** Short label used instead of an ID, e.g. "高防禦" / "西北". */
  tag?: string;
  as?: "pin" | "dot" | "area";
  /** false = table only, no map markers. */
  map?: boolean;
}

export interface StepMarkInput {
  id: number;
  as: "npc" | "ok" | "device" | "room";
  label?: string;
  tbd?: boolean;
}

export interface StepInput {
  stage: number;
  crop?: Crop;
  groups?: StepGroupInput[];
  marks?: StepMarkInput[];
}

export interface StepRow {
  id: number;
  name: string;
  level: number;
  hp: number;
  def: number;
  mdef: number;
  dodge: number | null;
  weakenRes: number | null;
  bleedRes: number | null;
  image: EntityImage | null;
  /** Number of identical-stat ids merged into this row. */
  count: number;
}

export interface StepGroup {
  key: string;
  tag: string | null;
  /** 1-based index into --marker-N palette. */
  color: number;
  as: "pin" | "dot" | "area";
  map: boolean;
  rows: StepRow[];
  points: Point[];
}

export interface StepMark {
  key: string;
  id: number;
  name: string;
  label: string | null;
  as: StepMarkInput["as"];
  tbd: boolean;
  image: EntityImage | null;
  points: Point[];
}

export interface StepData {
  stageId: number;
  stageName: string;
  image: StageMapImage | null;
  crop: Crop | null;
  groups: StepGroup[];
  marks: StepMark[];
  hit: { dodge: number; names: string[] } | null;
  /** Requested ids with no DB record / no in-crop point. */
  missing: number[];
}

// ─────────────────────────────────────────────────────────────────────────
// 純函式（無 DB 依賴）：座標換算、資料組裝。可安全被 "use client" 檔案 import。
// getStepData（真的打 DB）刻意放在 src/lib/guide-steps.server.ts，避免
// client bundle 意外把 better-sqlite3 也拉進去（"use client" 檔案只 import
// 這個檔案的 pure fn，不會 import guide-steps.server.ts）。
// ─────────────────────────────────────────────────────────────────────────

/**
 * 裁切區塊相對容器的比例，用來算「只看本區塊」畫面的 CSS：容器 aspect-ratio
 * 用 crop 的寬高比，圖片本身用 width/left/top 三個百分比頂出裁切位置。
 * oracle（見 plan）：img 6040×2800、crop [150,380,1400,1380] →
 * aspect 1250/1000、width 483.2%、left −12%、top −38%。
 *
 * img 吃 StageMapImage 的 imgWidth/imgHeight（而非泛用 width/height）：
 * @designer 現有的 step-map.tsx 直接把 data.image（StageMapImage）傳進來，
 * 對齊實際呼叫端比對齊計畫文件裡的示意型別更重要。
 */
export function cropFrame(
  img: { imgWidth: number; imgHeight: number },
  crop: Crop,
): { aspect: number; width: number; left: number; top: number } {
  const [x0, y0, x1, y1] = crop;
  const w = x1 - x0;
  const h = y1 - y0;
  return {
    aspect: w / h,
    width: (img.imgWidth / w) * 100,
    left: (-x0 / w) * 100,
    top: (-y0 / h) * 100,
  };
}

/** 合成圖像素座標 → 百分比。crop=null 時相對整張圖；有 crop 時相對裁切區塊。 */
export function toPercent(
  p: Point,
  img: { imgWidth: number; imgHeight: number },
  crop: Crop | null,
): { left: number; top: number } {
  if (!crop) {
    return { left: (p.x / img.imgWidth) * 100, top: (p.y / img.imgHeight) * 100 };
  }
  const [x0, y0, x1, y1] = crop;
  const w = x1 - x0;
  const h = y1 - y0;
  return { left: ((p.x - x0) / w) * 100, top: ((p.y - y0) / h) * 100 };
}

/** 裁切區塊在完整地圖上的框（百分比 bbox），給「查看完整地圖」時畫「本區塊」用。 */
export function fullFrameBox(
  img: { imgWidth: number; imgHeight: number },
  crop: Crop,
): { left: number; top: number; width: number; height: number } {
  const [x0, y0, x1, y1] = crop;
  const w = x1 - x0;
  const h = y1 - y0;
  return {
    left: (x0 / img.imgWidth) * 100,
    top: (y0 / img.imgHeight) * 100,
    width: (w / img.imgWidth) * 100,
    height: (h / img.imgHeight) * 100,
  };
}

/** 點是否落在裁切框內（含邊界）。crop=null 視為不限制，一律回 true。 */
export function inCrop(p: Point, crop: Crop | null): boolean {
  if (!crop) return true;
  const [x0, y0, x1, y1] = crop;
  return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
}

function dedupePoints(points: Point[]): Point[] {
  const seen = new Set<string>();
  const out: Point[] = [];
  for (const p of points) {
    const key = `${p.x}:${p.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function pointsInCrop(raw: Point[] | undefined, crop: Crop | null): Point[] {
  const pts = raw ?? [];
  return crop ? pts.filter((p) => inCrop(p, crop)) : pts;
}

/** buildStepData 的單一 npc 戰鬥數值輸入；由呼叫端（getStepData）合併查詢結果組成。 */
export interface StepStatInput {
  id: number;
  name: string;
  level: number;
  hp: number;
  def: number;
  mdef: number;
  dodge: number | null;
  weakenRes: number | null;
  bleedRes: number | null;
  image: EntityImage | null;
}

export interface BuildStepDataInput {
  stageId: number;
  stageName: string;
  image: StageMapImage | null;
  crop: Crop | null;
  groups: StepGroupInput[];
  marks: StepMarkInput[];
  /** npc id → 戰鬥數值＋頭像；查無資料的 id 不會出現在這個 Map。 */
  stats: Map<number, StepStatInput>;
  /** npc id → 合成圖像素座標（未套用 crop 過濾，buildStepData 內部會過濾）。 */
  points: Map<number, Point[]>;
}

/**
 * 純函式版的資料組裝：把 DB 查詢結果（stats/points）依 StepInput 的 groups/marks
 * 組成 StepData。不打 DB，方便測試；getStepData（server）負責查資料後呼叫這裡。
 *
 * - 只保留落在 crop 內的座標（crop=null 時不限制）。
 * - 同一組內，name/level/hp/def/mdef/dodge/weakenRes/bleedRes 完全相同的 id 合併成一列（count 累加）；
 *   不同（例如 ▲精英 vs 一般）各自成列，依 ids 出現順序排列。
 * - color = 這個 group 在輸入陣列中的順序（1-based）。
 * - hit = 所有 group rows 中最大的 dodge（忽略 null），names 為並列最大值的怪物名（去重）。
 * - missing：查無 DB 記錄，或（需要畫在地圖上時）套用 crop 後沒有任何座標點的 id。
 *   group 的 map 預設 true（未設為 false 才需要座標）；mark 只有非 tbd 才需要座標。
 */
export function buildStepData(input: BuildStepDataInput): StepData {
  const { stageId, stageName, image, crop, groups, marks, stats, points } = input;
  const missing = new Set<number>();

  const outGroups: StepGroup[] = groups.map((g, i) => {
    const mapEnabled = g.map ?? true;
    const buckets = new Map<string, StepRow>();
    const groupPoints: Point[] = [];

    for (const id of g.ids) {
      const stat = stats.get(id);
      const idPoints = pointsInCrop(points.get(id), crop);
      if (!stat) {
        missing.add(id);
        continue;
      }
      if (mapEnabled && idPoints.length === 0) {
        missing.add(id);
      }
      groupPoints.push(...idPoints);

      const bucketKey = JSON.stringify([
        stat.name,
        stat.level,
        stat.hp,
        stat.def,
        stat.mdef,
        stat.dodge,
        stat.weakenRes,
        stat.bleedRes,
      ]);
      const existing = buckets.get(bucketKey);
      if (existing) {
        existing.count += 1;
      } else {
        buckets.set(bucketKey, {
          id: stat.id,
          name: stat.name,
          level: stat.level,
          hp: stat.hp,
          def: stat.def,
          mdef: stat.mdef,
          dodge: stat.dodge,
          weakenRes: stat.weakenRes,
          bleedRes: stat.bleedRes,
          image: stat.image,
          count: 1,
        });
      }
    }

    return {
      key: `g${i + 1}`,
      tag: g.tag ?? null,
      color: i + 1,
      as: g.as ?? "pin",
      map: mapEnabled,
      rows: [...buckets.values()],
      points: dedupePoints(groupPoints),
    };
  });

  const outMarks: StepMark[] = marks.map((m, i) => {
    const stat = stats.get(m.id);
    const tbd = m.tbd ?? false;
    const idPoints = pointsInCrop(points.get(m.id), crop);
    if (!stat) {
      missing.add(m.id);
    } else if (!tbd && idPoints.length === 0) {
      missing.add(m.id);
    }
    return {
      key: `m${i + 1}`,
      id: m.id,
      name: stat?.name ?? "",
      label: m.label ?? null,
      as: m.as,
      tbd,
      image: stat?.image ?? null,
      points: dedupePoints(idPoints),
    };
  });

  const allRows = outGroups.flatMap((g) => g.rows);
  const dodgeValues = allRows
    .map((r) => r.dodge)
    .filter((d): d is number => d != null);
  const hit =
    dodgeValues.length > 0
      ? (() => {
          const max = Math.max(...dodgeValues);
          const names = [...new Set(allRows.filter((r) => r.dodge === max).map((r) => r.name))];
          return { dodge: max, names };
        })()
      : null;

  return {
    stageId,
    stageName,
    image,
    crop,
    groups: outGroups,
    marks: outMarks,
    hit,
    missing: [...missing],
  };
}
