import { getDb } from "@/lib/db";
import { getItemIconMap, type EntityImage } from "@/lib/queries/images";
import { parseDropItem } from "@/lib/queries/monsters";

export interface TrainingDropSource {
  itemId: number;
  /** 單隻怪每次擊殺的掉率（%）。分母含 itemId=0 空槽，與怪物頁掉落表一致。 */
  percent: number;
}

export interface TrainingDropItemInfo {
  name: string | null;
  type: string | null;
  level: number | null;
  icon: EntityImage | null;
}

export interface TrainingDropData {
  byNpc: Map<number, TrainingDropSource[]>;
  items: Map<number, TrainingDropItemInfo>;
}

// SQLite 變數上限 999，留餘裕分塊。
const CHUNK_SIZE = 900;

function chunks<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += CHUNK_SIZE) out.push(arr.slice(i, i + CHUNK_SIZE));
  return out;
}

/**
 * 練功地圖卡片的掉落資料：一次取回多隻怪的掉落與物品資訊。
 * 依 id 數分塊，每塊固定 3 個 query（掉落表、物品、圖示），不逐怪查詢。
 */
export function getTrainingDropData(npcIds: readonly number[]): TrainingDropData {
  const byNpc = new Map<number, TrainingDropSource[]>();
  const items = new Map<number, TrainingDropItemInfo>();
  const unique = [...new Set(npcIds)];
  if (unique.length === 0) return { byNpc, items };

  const db = getDb();
  const itemIds = new Set<number>();
  for (const part of chunks(unique)) {
    const rows = db
      .prepare(
        `SELECT id, drop_item FROM monsters WHERE id IN (${part.map(() => "?").join(",")})`,
      )
      .all(...part) as Array<{ id: number; drop_item: string | null }>;
    for (const row of rows) {
      const pairs = parseDropItem(row.drop_item);
      const totalWeight = pairs.reduce((s, p) => s + p.rate, 0);
      if (totalWeight <= 0) continue;
      // 同一物品在一隻怪的掉落表可能出現兩次，機率相加。
      const percentByItem = new Map<number, number>();
      for (const p of pairs) {
        // itemId=0 是空槽（沒掉落），只算進分母；掉率 0 的項目不列。
        if (p.itemId === 0 || p.rate <= 0) continue;
        const percent = (p.rate / totalWeight) * 100;
        percentByItem.set(p.itemId, (percentByItem.get(p.itemId) ?? 0) + percent);
        itemIds.add(p.itemId);
      }
      byNpc.set(
        row.id,
        [...percentByItem].map(([itemId, percent]) => ({ itemId, percent })),
      );
    }
  }

  const ids = [...itemIds];
  const icons = getItemIconMap(ids);
  for (const part of chunks(ids)) {
    const rows = db
      .prepare(
        `SELECT id, name, type_name AS type, base_lv AS level
         FROM items WHERE id IN (${part.map(() => "?").join(",")})`,
      )
      .all(...part) as Array<{
      id: number;
      name: string | null;
      type: string | null;
      level: number | null;
    }>;
    for (const r of rows) {
      items.set(r.id, { name: r.name, type: r.type, level: r.level, icon: icons.get(r.id) ?? null });
    }
  }
  return { byNpc, items };
}
