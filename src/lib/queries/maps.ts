import { getDb } from "@/lib/db";
import type { StageKind } from "@/lib/types/stage";
import type { StageMonsterSpawn } from "@/lib/types/monster-spawn";
import type { Point } from "@/lib/guide-steps";
import { getNpcImageMap, type EntityImage } from "./images";

export interface StageMapImage {
  url: string;
  imgWidth: number;
  imgHeight: number;
  tilesW: number;
  tilesH: number;
  tilePx: number;
}

// ── 可行走遮罩（map_walkability）────────────────────────────────────────

const WALK_TILE = 40;

/**
 * 遮罩中包含 (x,y) 像素的八鄰接連通區，回傳格 index（row*width+col）。
 * 與 scripts/inspect-walkability.py 同規則：row 0 在圖上方、不翻轉 Y、斜向也算相連。
 * 起點格擋住時改找周圍一格內的可走格；都沒有回 null。
 */
export function walkRegion(
  mask: string,
  width: number,
  height: number,
  x: number,
  y: number,
): number[] | null {
  const col = Math.floor(x / WALK_TILE);
  const row = Math.floor(y / WALK_TILE);
  const open = (r: number, c: number) =>
    r >= 0 && r < height && c >= 0 && c < width && mask[r * width + c] === "1";
  let start = -1;
  for (const [dr, dc] of [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]) {
    if (open(row + dr, col + dc)) {
      start = (row + dr) * width + col + dc;
      break;
    }
  }
  if (start < 0) return null;
  const seen = new Set([start]);
  const cells = [start];
  for (let i = 0; i < cells.length; i++) {
    const r = Math.floor(cells[i] / width);
    const c = cells[i] % width;
    for (let rr = r - 1; rr <= r + 1; rr++) {
      for (let cc = c - 1; cc <= c + 1; cc++) {
        const k = rr * width + cc;
        if (open(rr, cc) && !seen.has(k)) {
          seen.add(k);
          cells.push(k);
        }
      }
    }
  }
  return cells;
}

/**
 * 格子聯集的外框 → SVG path（合成圖像素）。每格四邊中，鄰格不在集合裡的邊才是外框；
 * 邊一律順時針，串成封閉環（洞會自然變成反向環），用 fill-rule="evenodd" 填色。
 */
export function regionPath(cells: number[], width: number): string {
  const set = new Set(cells);
  const W = width + 1; // 頂點格
  const next = new Map<number, number[]>();
  const edge = (a: number, b: number) => (next.get(a) ?? next.set(a, []).get(a)!).push(b);
  for (const k of cells) {
    const r = Math.floor(k / width);
    const c = k % width;
    const tl = r * W + c;
    const tr = tl + 1;
    const bl = tl + W;
    const br = bl + 1;
    if (r === 0 || !set.has(k - width)) edge(tl, tr);
    if (c === width - 1 || !set.has(k + 1)) edge(tr, br);
    if (!set.has(k + width)) edge(br, bl);
    if (c === 0 || !set.has(k - 1)) edge(bl, tl);
  }
  const loops: string[] = [];
  // 斜角相接的頂點有兩條出邊，所以同一起點要一直繞到出邊用完。
  for (const [first, firstOut] of next)
    while (firstOut.length) {
      const pts = [first];
      let p = first;
      for (;;) {
        const out = next.get(p)!;
        const n = out.pop()!;
        if (n === first) break;
        pts.push(n);
        p = n;
      }
      // 去掉直線中間點，路徑短一半以上
      const xy = pts.map((v) => [(v % W) * WALK_TILE, Math.floor(v / W) * WALK_TILE]);
      const keep = xy.filter((q, i) => {
        const a = xy[(i - 1 + xy.length) % xy.length];
        const b = xy[(i + 1) % xy.length];
        return !((a[0] === q[0] && q[0] === b[0]) || (a[1] === q[1] && q[1] === b[1]));
      });
      loops.push(`M${keep.map((q) => q.join(" ")).join(" ")}Z`);
    }
  return loops.join("");
}

export interface WalkRegion {
  path: string;
  /** 格 index（row*width+col）。 */
  cells: number[];
  width: number;
}

/** 點所在的格（或周圍一格，同 walkRegion 起點的容錯）是否屬於這條通道。 */
export function regionHas(region: WalkRegion, p: Point): boolean {
  const col = Math.floor(p.x / WALK_TILE);
  const row = Math.floor(p.y / WALK_TILE);
  const cells = new Set(region.cells);
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const c = col + dc;
      if (c >= 0 && c < region.width && cells.has((row + dr) * region.width + c)) return true;
    }
  }
  return false;
}

const PATH_DIRS: Array<[number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

const NEAREST_ORDER: Array<[number, number]> = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/** 點附近（含自己所在格，同 walkRegion 起點的容錯順序）最近的一個開放格；查無回 null。 */
function nearestCell(cells: Set<number>, width: number, p: Point): number | null {
  const col = Math.floor(p.x / WALK_TILE);
  const row = Math.floor(p.y / WALK_TILE);
  for (const [dr, dc] of NEAREST_ORDER) {
    const c = col + dc;
    if (c < 0 || c >= width) continue;
    const idx = (row + dr) * width + c;
    if (cells.has(idx)) return idx;
  }
  return null;
}

/**
 * 每個開放格到最近阻擋格（含網格邊界，邊界一律視同阻擋）的 8 鄰接（chebyshev）
 * 距離，用多源 BFS 做距離轉換：blocked／邊界格當種子（距離 0），往內展開。
 * 高度用 cells 裡出現過的最大 row + 1 推算（不需要額外傳入 grid 實際高度——
 * 真正的格陣如果更高，多出來的列本來就不在 cells 裡，等同也是阻擋）。
 * 給 Dijkstra 當「貼牆懲罰」依據，避免路徑貼著牆角走（視覺上穿過牆邊裝飾物）。
 */
function computeClearance(cells: Set<number>, width: number): Map<number, number> {
  let maxRow = 0;
  for (const idx of cells) {
    const r = Math.floor(idx / width);
    if (r > maxRow) maxRow = r;
  }
  const height = maxRow + 1;
  const PW = width + 2; // 四周各墊一層當邊界種子
  const PH = height + 2;
  const dist = new Int32Array(PW * PH).fill(-1);
  const queue: number[] = [];
  for (let pr = 0; pr < PH; pr++) {
    for (let pc = 0; pc < PW; pc++) {
      const r = pr - 1;
      const c = pc - 1;
      const isPadding = r < 0 || r >= height || c < 0 || c >= width;
      if (isPadding || !cells.has(r * width + c)) {
        const pidx = pr * PW + pc;
        dist[pidx] = 0;
        queue.push(pidx);
      }
    }
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    const pr = Math.floor(cur / PW);
    const pc = cur % PW;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = pr + dr;
        const nc = pc + dc;
        if (nr < 0 || nr >= PH || nc < 0 || nc >= PW) continue;
        const nidx = nr * PW + nc;
        if (dist[nidx] !== -1) continue;
        dist[nidx] = dist[cur] + 1;
        queue.push(nidx);
      }
    }
  }
  const clearance = new Map<number, number>();
  for (const idx of cells) {
    const r = Math.floor(idx / width);
    const c = idx % width;
    clearance.set(idx, dist[(r + 1) * PW + (c + 1)]);
  }
  return clearance;
}

// ponytail: clearance>=3（5 格寬走廊的正中央）不罰；1～2 格（貼牆）強烈懲罰，
// 逼 Dijkstra 寧可繞路也要離牆遠一點。純數字調過，沒有理論依據，視覺觀察不夠
// 再調整這三個常數即可，不用動演算法本身。
function clearancePenalty(clearance: number): number {
  if (clearance >= 3) return 0;
  if (clearance === 2) return 2;
  return 6; // clearance <= 1
}

type HeapItem = [cost: number, cellIdx: number];

/** 標準二元 min-heap：push/pop 皆 O(log n)，只在 dijkstraCellPath 內部用。 */
function heapPush(heap: HeapItem[], item: HeapItem): void {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (heap[parent][0] <= heap[i][0]) break;
    [heap[parent], heap[i]] = [heap[i], heap[parent]];
    i = parent;
  }
}

function heapPop(heap: HeapItem[]): HeapItem | undefined {
  if (heap.length === 0) return undefined;
  const top = heap[0];
  const last = heap.pop()!;
  if (heap.length > 0) {
    heap[0] = last;
    let i = 0;
    const n = heap.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let smallest = i;
      if (l < n && heap[l][0] < heap[smallest][0]) smallest = l;
      if (r < n && heap[r][0] < heap[smallest][0]) smallest = r;
      if (smallest === i) break;
      [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
      i = smallest;
    }
  }
  return top;
}

/**
 * Dijkstra 最短路徑（格 index 陣列）：邊成本＝幾何長度（正交 1／斜向 √2）
 * ×(1+貼牆懲罰)，懲罰取兩端格 clearance 較小值（見 clearancePenalty）。
 * 斜向移動時兩個正交鄰格都要開放才准走，不切牆角（同舊版 BFS 規則）。
 */
function dijkstraCellPath(
  cells: Set<number>,
  width: number,
  clearance: Map<number, number>,
  start: number,
  goal: number,
): number[] | null {
  if (start === goal) return [start];
  const dist = new Map<number, number>([[start, 0]]);
  const prev = new Map<number, number>();
  const visited = new Set<number>();
  const heap: HeapItem[] = [];
  heapPush(heap, [0, start]);
  for (let item = heapPop(heap); item; item = heapPop(heap)) {
    const [cost, cur] = item;
    if (visited.has(cur)) continue;
    visited.add(cur);
    if (cur === goal) break;
    if (cost > (dist.get(cur) ?? Infinity)) continue;
    const r = Math.floor(cur / width);
    const c = cur % width;
    for (const [dr, dc] of PATH_DIRS) {
      const cc = c + dc;
      if (cc < 0 || cc >= width) continue;
      const rr = r + dr;
      const k = rr * width + cc;
      if (!cells.has(k) || visited.has(k)) continue;
      if (dr !== 0 && dc !== 0 && (!cells.has(r * width + cc) || !cells.has(rr * width + c))) continue;
      const stepLen = dr !== 0 && dc !== 0 ? Math.SQRT2 : 1;
      const penalty = clearancePenalty(Math.min(clearance.get(cur) ?? 0, clearance.get(k) ?? 0));
      const next = cost + stepLen * (1 + penalty);
      if (next < (dist.get(k) ?? Infinity)) {
        dist.set(k, next);
        prev.set(k, cur);
        heapPush(heap, [next, k]);
      }
    }
  }
  if (!dist.has(goal)) return null;
  const path = [goal];
  for (let cur = goal; cur !== start; ) {
    const p = prev.get(cur);
    if (p === undefined) return null; // 理論上不會發生（dist 有值就一定有 prev），防禦性 guard
    cur = p;
    path.push(cur);
  }
  return path.reverse();
}

function cellCenter(idx: number, width: number): Point {
  return {
    x: (idx % width) * WALK_TILE + WALK_TILE / 2,
    y: Math.floor(idx / width) * WALK_TILE + WALK_TILE / 2,
  };
}

/**
 * 走訪 a→b 幾何上實際經過的每一格（正確版 supercover：用精確的網格交點，
 * 不是固定步數取樣——取樣法對長線段會跳過夾在兩個取樣點之間的薄牆角，見
 * commit 說明的迴歸案例）。恰好穿過格線交點（四格共用的角）時，視同對角
 * corner-cut：連帶檢查兩個相鄰格，和 dijkstraCellPath 的「斜向移動兩個
 * 正交鄰格都要開放」規則一致。visit 回 false 時立刻停止並回傳 false。
 */
function traverseCells(a: Point, b: Point, visit: (col: number, row: number) => boolean): boolean {
  let col = Math.floor(a.x / WALK_TILE);
  let row = Math.floor(a.y / WALK_TILE);
  const endCol = Math.floor(b.x / WALK_TILE);
  const endRow = Math.floor(b.y / WALK_TILE);
  if (!visit(col, row)) return false;
  if (col === endCol && row === endRow) return true;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const stepCol = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepRow = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const tDeltaX = dx !== 0 ? Math.abs(WALK_TILE / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(WALK_TILE / dy) : Infinity;
  let tMaxX = dx !== 0 ? ((stepCol > 0 ? col + 1 : col) * WALK_TILE - a.x) / dx : Infinity;
  let tMaxY = dy !== 0 ? ((stepRow > 0 ? row + 1 : row) * WALK_TILE - a.y) / dy : Infinity;

  const EPS = 1e-9;
  // 安全上限：正常路徑跨越的格線數遠低於此，只防浮點誤差造成的無窮迴圈。
  for (let guard = 0; guard < 100_000; guard++) {
    if (Math.abs(tMaxX - tMaxY) < EPS) {
      // 恰好同時跨兩條格線＝穿過四格共用的角，比照斜向移動不切角規則。
      if (!visit(col + stepCol, row)) return false;
      if (!visit(col, row + stepRow)) return false;
      col += stepCol;
      row += stepRow;
      tMaxX += tDeltaX;
      tMaxY += tDeltaY;
    } else if (tMaxX < tMaxY) {
      col += stepCol;
      tMaxX += tDeltaX;
    } else {
      row += stepRow;
      tMaxY += tDeltaY;
    }
    if (!visit(col, row)) return false;
    if (col === endCol && row === endRow) return true;
  }
  return true; // 理論上到不了這裡；guard 只是防禦性上限
}

/**
 * a→b 是否全程在可行走格內，且每一格的 clearance 都 >= minClearance
 * （用 traverseCells 精確走訪，不是固定步數取樣）。minClearance 是
 * string-pulling「不能抄近路抄到比原本 Dijkstra 路徑更貼牆」的門檻，由
 * 呼叫端算好傳入。
 */
function hasLineOfSight(
  cells: Set<number>,
  width: number,
  clearance: Map<number, number>,
  minClearance: number,
  a: Point,
  b: Point,
): boolean {
  return traverseCells(a, b, (col, row) => {
    if (col < 0 || col >= width || row < 0) return false;
    const idx = row * width + col;
    if (!cells.has(idx)) return false;
    return (clearance.get(idx) ?? 0) >= minClearance;
  });
}

/**
 * 貪婪 string-pulling：從頭盡量跳到看得到的最遠點，折線頂點數降到最少。
 * pointCells[k] 是 points[k] 對應的格 index（給 clearance 查詢用；頭尾兩點
 * 對應起訖格本身，即使起訖點貼著牆也不擋——因為門檻取「原路徑沿途最小值」，
 * 起訖格本身的低 clearance 早就算進這個最小值裡，等於自動豁免）。
 * desiredClearance：理想門檻（通常 3，走廊正中央），實際門檻＝
 * min(desiredClearance, i..j 之間 Dijkstra 路徑原有的最小 clearance)——
 * 保證抄近路不會比原路徑更貼牆，但也不會比原路徑更嚴格。
 */
function pullString(
  points: Point[],
  pointCells: number[],
  cells: Set<number>,
  width: number,
  clearance: Map<number, number>,
  desiredClearance: number,
): Point[] {
  if (points.length <= 2) return points;
  const out: Point[] = [points[0]];
  let i = 0;
  while (i < points.length - 1) {
    let j = points.length - 1;
    for (; j > i + 1; j--) {
      let minAlong = Infinity;
      for (let k = i; k <= j; k++) minAlong = Math.min(minAlong, clearance.get(pointCells[k]) ?? 0);
      const threshold = Math.min(desiredClearance, minAlong);
      if (hasLineOfSight(cells, width, clearance, threshold, points[i], points[j])) break;
    }
    out.push(points[j]);
    i = j;
  }
  return out;
}

// ponytail: clearance>=3（5 格寬走廊的正中央）不罰，string-pulling 也以此為
// 理想門檻；純數字調過，視覺觀察不夠再調整（連同 clearancePenalty）即可。
const DESIRED_CLEARANCE = 3;

/**
 * 純函式版最短可行走路徑：cells＝開放格 index 陣列（同 walkRegion 回傳格式，
 * row*width+col）、width＝格陣寬度。a/b 是合成圖像素座標，回傳折線的頭尾固定
 * 是 a 與 b 本身（不會被吸到格子中心）。起訖點附近（1 格內）找不到開放格、
 * 或兩點不連通時回 null，呼叫端（getWalkPath）退回直線。
 *
 * 貼牆懲罰（clearancePenalty）讓 Dijkstra 偏好走廊正中央，避免路徑視覺上
 * 貼著牆邊裝飾物（雕像、柱子、橋面）看起來像穿牆；string-pulling 化簡時
 * 同樣不允許抄近路抄到比 Dijkstra 已接受的路徑更貼牆（見 pullString）。
 */
export function walkPath(cells: number[], width: number, a: Point, b: Point): Point[] | null {
  const set = new Set(cells);
  const start = nearestCell(set, width, a);
  const goal = nearestCell(set, width, b);
  if (start == null || goal == null) return null;
  const clearance = computeClearance(set, width);
  const cellPath = dijkstraCellPath(set, width, clearance, start, goal);
  if (!cellPath) return null;
  const waypoints = [a, ...cellPath.map((idx) => cellCenter(idx, width)), b];
  const waypointCells = [start, ...cellPath, goal];
  return pullString(waypoints, waypointCells, set, width, clearance, DESIRED_CLEARANCE);
}

/**
 * 兩點間的可行走路徑（合成圖像素座標折線，含頭尾）；查無可行走資料、或兩點
 * 不連通時回 null，呼叫端（getRoutes）退回直線。包住 getWalkRegion（會打
 * DB，有快取）＋walkPath（純運算）。
 */
export function getWalkPath(kind: StageKind, id: number, a: Point, b: Point): Point[] | null {
  const region = getWalkRegion(kind, id, a);
  if (!region || !regionHas(region, b)) return null;
  return walkPath(region.cells, region.width, a, b);
}

// ponytail: 行程內永久快取；資料唯讀、key 只有攻略寫死的幾個起點，不會長大。
const walkCache = new Map<string, WalkRegion | null>();

/** 包含起點的可行走連通區；沒有 map_walkability 表／該場景列、或起點附近不可走時回 null。 */
export function getWalkRegion(kind: StageKind, id: number, at: Point): WalkRegion | null {
  const key = `${kind}:${id}:${Math.floor(at.x / WALK_TILE)}:${Math.floor(at.y / WALK_TILE)}`;
  if (walkCache.has(key)) return walkCache.get(key)!;
  let row: { width: number; height: number; mask: string } | undefined;
  try {
    row = getDb()
      .prepare(
        `SELECT width, height, walk_mask AS mask FROM map_walkability WHERE stage_kind = ? AND stage_id = ?`,
      )
      .get(kind, id) as typeof row;
  } catch {
    row = undefined; // 舊版 DB 沒有這張表
  }
  const cells =
    row && row.mask.length === row.width * row.height
      ? walkRegion(row.mask, row.width, row.height, at.x, at.y)
      : null;
  const out = cells && row ? { path: regionPath(cells, row.width), cells, width: row.width } : null;
  walkCache.set(key, out);
  return out;
}

/** 單張地圖背景圖；無圖回 null。 */
export function getStageMapImage(kind: StageKind, id: number): StageMapImage | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT url,
              img_width   AS imgWidth,
              img_height  AS imgHeight,
              map_w_tiles AS tilesW,
              map_h_tiles AS tilesH,
              tile_px     AS tilePx
       FROM map_images
       WHERE stage_kind = ? AND stage_id = ?`,
    )
    .get(kind, id) as StageMapImage | undefined;
  return row ?? null;
}

export interface NpcPlacement {
  placementId: number;
  npcId: number;
  name: string | null;
  /**
   * 合成圖上的像素座標（左上原點、Y 向下），可直接除以 map_images 的
   * img_width/img_height 得到百分比位置。
   *
   * 注意：不要用 map_placements.tile_x/tile_y 來定位 —— tile_y 帶了一次
   * Y 翻轉（tile_y = map_h_tiles − round(raw_y/40)），會把室內房間上下鏡像
   * 到錯位。raw_x/raw_y 才與合成圖線性對齊（已用疊圖驗證）。
   */
  rawX: number;
  rawY: number;
  image: EntityImage | null;
}

/**
 * 該 stage 的 NPC placement（category='npc' 且 in_bounds=1），每個座標一筆。
 * 名字 join npc 表；頭像用批次 getNpcImageMap 補（無 N+1）。
 */
export function getNpcPlacementsForStage(kind: StageKind, id: number): NpcPlacement[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.id AS placementId,
              p.npc_id AS npcId,
              n.name    AS name,
              p.raw_x   AS rawX,
              p.raw_y   AS rawY
       FROM map_placements p
       LEFT JOIN npc n ON n.id = p.npc_id
       WHERE p.stage_kind = ?
         AND p.stage_id = ?
         AND p.category = 'npc'
         AND p.in_bounds = 1
       ORDER BY p.id`,
    )
    .all(kind, id) as Array<{
    placementId: number;
    npcId: number;
    name: string | null;
    rawX: number;
    rawY: number;
  }>;

  if (rows.length === 0) return [];

  const imageMap = getNpcImageMap(rows.map((r) => r.npcId));
  return rows.map((r) => ({ ...r, image: imageMap.get(r.npcId) ?? null }));
}

export interface MonsterSpawnPosition {
  npcId: number;
  /** monster_spawns.x/y：合成圖像素座標（左上原點），與 map_placements.raw_x/raw_y 對齊。 */
  x: number | null;
  y: number | null;
}

// 舊版執行期資料庫可能還沒跑過 monster_spawns 的 spawn-position 遷移（沒有這張表，
// 或表在但缺 x/y 欄位）。用 capability check（而非比對錯誤訊息字串）判斷是否可查，
// 避免 fragile 的 error-message matching，同時讓其他非預期錯誤照樣往外丟。
// 用 WeakMap 而非單一模組變數快取：測試會用不同 in-memory db 模擬新舊 schema，
// 若快取跨 db 實例共用會把舊結果誤套到新 db 上。
const spawnXYSupportCache = new WeakMap<ReturnType<typeof getDb>, boolean>();

function hasSpawnXYSupport(db: ReturnType<typeof getDb>): boolean {
  let support = spawnXYSupportCache.get(db);
  if (support === undefined) {
    const columns = db.pragma("table_info(monster_spawns)") as Array<{ name: string }>;
    const names = new Set(columns.map((c) => c.name));
    // 表不存在時 table_info 回傳空陣列，names 自然不含 x/y，兩種舊 schema 都會落在這裡。
    support = names.has("x") && names.has("y");
    spawnXYSupportCache.set(db, support);
  }
  return support;
}

/**
 * 該 stage 全部 monster_spawns 的原始像素座標（依 id 遞增，決定性順序）。
 * stage208 全 38 筆已逐筆核對與 map_placements（category='spawn'）的
 * record_idx/npc_id/raw_x/raw_y 一致；其餘 stage 未逐一驗證，僅信任 schema 一致。
 * 舊 schema 缺 spawn 表或 x/y 欄位時回空陣列；其餘 SQL 錯誤照常拋出。
 */
export function getMonsterSpawnPositions(kind: StageKind, id: number): MonsterSpawnPosition[] {
  const db = getDb();
  if (!hasSpawnXYSupport(db)) return [];

  return db
    .prepare(
      `SELECT npc_id AS npcId, x, y
       FROM monster_spawns
       WHERE stage_kind = ? AND stage_id = ?
       ORDER BY id`,
    )
    .all(kind, id) as MonsterSpawnPosition[];
}

/**
 * 給迷宮攻略步驟用：某 stage 內指定 npc id 們的合成圖像素座標，
 * 合併 monster_spawns(x,y) 與 map_placements(raw_x,raw_y, category IN ('npc','spawn'), in_bounds=1)
 * 兩個來源（同一隻 npc 常常兩邊都有紀錄，取聯集後依 (x,y) 去重）。
 *
 * 注意：這裡跟 getNpcPlacementsForStage 一樣，只用 raw_x/raw_y，絕不用 tile_y
 * （tile_y 帶了一次 Y 翻轉，會把室內房間上下鏡像到錯位，見 commit 0329979）。
 *
 * 回傳 Map<npcId, Point[]>；查無座標的 id 不會出現在 Map 裡（呼叫端可用 has() 判斷）。
 */
export function getNpcPositionsForStage(
  kind: StageKind,
  stageId: number,
  ids: number[],
): Map<number, Point[]> {
  const result = new Map<number, Point[]>();
  if (ids.length === 0) return result;

  const db = getDb();
  const uniqueIds = [...new Set(ids)];
  const placeholders = uniqueIds.map(() => "?").join(",");

  const push = (npcId: number, x: unknown, y: unknown) => {
    if (typeof x !== "number" || typeof y !== "number") return;
    const list = result.get(npcId);
    if (list) list.push({ x, y });
    else result.set(npcId, [{ x, y }]);
  };

  const placementRows = db
    .prepare(
      `SELECT npc_id AS npcId, raw_x AS x, raw_y AS y
       FROM map_placements
       WHERE stage_kind = ?
         AND stage_id = ?
         AND category IN ('npc', 'spawn')
         AND in_bounds = 1
         AND npc_id IN (${placeholders})`,
    )
    .all(kind, stageId, ...uniqueIds) as Array<{ npcId: number; x: number; y: number }>;
  for (const r of placementRows) push(r.npcId, r.x, r.y);

  if (hasSpawnXYSupport(db)) {
    const spawnRows = db
      .prepare(
        `SELECT npc_id AS npcId, x, y
         FROM monster_spawns
         WHERE stage_kind = ? AND stage_id = ? AND npc_id IN (${placeholders})`,
      )
      .all(kind, stageId, ...uniqueIds) as Array<{
      npcId: number;
      x: number | null;
      y: number | null;
    }>;
    for (const r of spawnRows) push(r.npcId, r.x, r.y);
  }

  for (const [npcId, pts] of result) {
    const seen = new Set<string>();
    const deduped: Point[] = [];
    for (const p of pts) {
      const key = `${p.x}:${p.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(p);
    }
    result.set(npcId, deduped);
  }

  return result;
}

export interface StageMonsterMarker extends StageMonsterSpawn {
  /** hp 顯著高於其他物種（判準見 buildMonsterMarkers 註解）；純顯示啟發式，非官方 boss 標記。 */
  highHp: boolean;
  /** candidate hp / 其他物種 hp 中位數；無法比較時為 null（不代表 0 倍）。 */
  hpRatio: number | null;
  points: { left: number; top: number }[];
}

function isFinitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** 標準算術中位數；偶數筆取中間兩筆的平均。輸入須已由呼叫端排序。 */
function median(sortedAsc: number[]): number {
  const mid = Math.floor(sortedAsc.length / 2);
  if (sortedAsc.length % 2 === 1) return sortedAsc[mid];
  return (sortedAsc[mid - 1] + sortedAsc[mid]) / 2;
}

function hasValidImageDims(image: StageMapImage | null): image is StageMapImage {
  return (
    image != null &&
    Number.isFinite(image.imgWidth) &&
    Number.isFinite(image.imgHeight) &&
    image.imgWidth > 0 &&
    image.imgHeight > 0
  );
}

function pointsForPositions(
  positions: MonsterSpawnPosition[],
  image: StageMapImage,
): { left: number; top: number }[] {
  const seen = new Set<string>();
  const points: { left: number; top: number }[] = [];
  for (const p of positions) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue; // 含 null（typeof null !== "number"）
    const x = p.x as number;
    const y = p.y as number;
    if (x < 0 || y < 0) continue;
    if (x >= image.imgWidth || y >= image.imgHeight) continue;
    const dedupeKey = `${x}:${y}`;
    if (seen.has(dedupeKey)) continue; // 同物種完全重複的座標點只留一個
    seen.add(dedupeKey);
    points.push({ left: (x / image.imgWidth) * 100, top: (y / image.imgHeight) * 100 });
  }
  return points;
}

/**
 * 合併「怪物清單」與「原始刷怪座標」成地圖標記，並標出 HP 異常突出的物種。
 *
 * points：無圖（image=null）或圖片尺寸不合法一律 []；有圖時只保留落在圖片範圍內
 * （0 <= x < width、0 <= y < height）的 finite 座標，並依 (x,y) 去重。points 為 []
 * 不影響 highHp/hpRatio 判斷（兩者判準只看 hp，不看有無座標）。
 *
 * highHp 判準（純顯示用啟發式，不代表官方 boss 標記）：
 * - 只看 finite 且 > 0 的 hp；每個 distinct npcId 只算一次（重複 row 不加權）。
 * - 需至少 2 個合格物種，且該物種自己 hp 也合格，否則 hpRatio=null、highHp=false。
 * - hpRatio = 該物種 hp / 其餘合格物種 hp 的標準算術中位數（偶數筆取中間兩筆平均）；
 *   hpRatio >= 10 才視為 highHp。
 * - 沒有絕對 hp 門檻、不看 drop_exp；單一合格物種永遠不會是 highHp。
 */
export function buildMonsterMarkers(
  monsters: StageMonsterSpawn[],
  positions: MonsterSpawnPosition[],
  image: StageMapImage | null,
): StageMonsterMarker[] {
  const positionsByNpc = new Map<number, MonsterSpawnPosition[]>();
  for (const p of positions) {
    const list = positionsByNpc.get(p.npcId);
    if (list) list.push(p);
    else positionsByNpc.set(p.npcId, [p]);
  }

  // distinct npcId → hp，只收 finite 且 > 0；重複的 npcId（理論上呼叫端不該有）只取第一筆，
  // 確保後面的中位數計算「每個物種只算一次」而不是被 row 數加權。
  const distinctHpByNpc = new Map<number, number>();
  for (const m of monsters) {
    if (isFinitePositive(m.hp) && !distinctHpByNpc.has(m.npcId)) {
      distinctHpByNpc.set(m.npcId, m.hp);
    }
  }
  const validSpeciesCount = distinctHpByNpc.size;

  return monsters.map((m) => {
    const points = hasValidImageDims(image)
      ? pointsForPositions(positionsByNpc.get(m.npcId) ?? [], image)
      : [];

    let hpRatio: number | null = null;
    let highHp = false;
    const ownHp = distinctHpByNpc.get(m.npcId);
    if (validSpeciesCount >= 2 && ownHp !== undefined) {
      const others = [...distinctHpByNpc.entries()]
        .filter(([npcId]) => npcId !== m.npcId)
        .map(([, hp]) => hp)
        .sort((a, b) => a - b);
      if (others.length > 0) {
        hpRatio = ownHp / median(others);
        highHp = hpRatio >= 10;
      }
    }

    return { ...m, highHp, hpRatio, points };
  });
}
