import { getDb } from "@/lib/db";

export interface EntityImage {
  url: string;
  width: number | null;
  height: number | null;
}

// SQLite 預設變數上限 999，留餘裕分塊避免超長 IN (...)。
const CHUNK_SIZE = 900;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

interface ImageRow {
  key: number;
  url: string;
  width: number | null;
  height: number | null;
}

function buildMap(
  ids: number[],
  sql: (placeholders: string) => string,
): Map<number, EntityImage> {
  const map = new Map<number, EntityImage>();
  if (ids.length === 0) return map;
  const db = getDb();
  const unique = [...new Set(ids)];
  for (const part of chunk(unique, CHUNK_SIZE)) {
    const placeholders = part.map(() => "?").join(",");
    const rows = db.prepare(sql(placeholders)).all(...part) as ImageRow[];
    for (const r of rows) {
      map.set(r.key, { url: r.url, width: r.width, height: r.height });
    }
  }
  return map;
}

export function getItemIconMap(ids: number[]): Map<number, EntityImage> {
  return buildMap(
    ids,
    (ph) =>
      `SELECT item_id AS key, url, width, height
       FROM item_images
       WHERE kind = 'icon' AND item_id IN (${ph})`,
  );
}

export function getItemIcon(id: number): EntityImage | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT url, width, height FROM item_images WHERE kind = 'icon' AND item_id = ?`,
    )
    .get(id) as { url: string; width: number | null; height: number | null } | undefined;
  return row ? { url: row.url, width: row.width, height: row.height } : null;
}

// 技能 icon 依 (magic_id, level) 存放。多數技能每級同圖，但同一 id 可能掛多個技能名
// （如 553、592 各等級是不同技能），所以 key 用 magicId→level→image，不能只取最低等級。
export function getMagicIconMap(ids: number[]): Map<number, Map<number, EntityImage>> {
  const map = new Map<number, Map<number, EntityImage>>();
  if (ids.length === 0) return map;
  const db = getDb();
  for (const part of chunk([...new Set(ids)], CHUNK_SIZE)) {
    const placeholders = part.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT magic_id, level, url, width, height FROM magic_images
         WHERE magic_id IN (${placeholders}) ORDER BY magic_id, level`,
      )
      .all(...part) as (EntityImage & { magic_id: number; level: number })[];
    for (const r of rows) {
      let levels = map.get(r.magic_id);
      if (!levels) map.set(r.magic_id, (levels = new Map()));
      levels.set(r.level, { url: r.url, width: r.width, height: r.height });
    }
  }
  return map;
}

/** 取指定等級 icon；該級沒圖就退回最低等級。 */
export function pickMagicIcon(
  levels: Map<number, EntityImage> | undefined,
  level: number,
): EntityImage | null {
  if (!levels) return null;
  return levels.get(level) ?? levels.values().next().value ?? null;
}

export function getNpcImageMap(ids: number[]): Map<number, EntityImage> {
  return buildMap(
    ids,
    (ph) =>
      `SELECT npc_id AS key, url, width, height
       FROM npc_images
       WHERE npc_id IN (${ph})`,
  );
}

export function getNpcImage(id: number): EntityImage | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT url, width, height FROM npc_images WHERE npc_id = ?`)
    .get(id) as { url: string; width: number | null; height: number | null } | undefined;
  return row ? { url: row.url, width: row.width, height: row.height } : null;
}
