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
      `SELECT p.npc_id AS npcId,
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
