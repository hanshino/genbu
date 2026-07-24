import { getDb } from "@/lib/db";
import type { StageKind } from "@/lib/types/stage";
import { getNpcImageMap, type EntityImage } from "./images";

export interface StageMapImage {
  url: string;
  imgWidth: number;
  imgHeight: number;
  tilesW: number;
  tilesH: number;
  tilePx: number;
}

/** 單張地圖背景圖；無圖（718 張中僅 62 張有）回 null。 */
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
