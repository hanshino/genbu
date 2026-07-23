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
