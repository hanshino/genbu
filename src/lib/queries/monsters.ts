import { getDb } from "@/lib/db";
import type { MonsterDropSource } from "@/lib/types/monster";

/**
 * drop_item JSON 格式: ["1", pair_count, item_id, rate, item_id, rate, ...]
 * 所有值為字串，需 parseInt 轉換。第一個元素固定 "1"，第二個為 pair 數量。
 */
function parseDropItem(json: string | null): { itemId: number; rate: number }[] {
  if (!json) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(arr) || arr.length < 2) return [];
  const pairCount = Number(arr[1]);
  const pairs: { itemId: number; rate: number }[] = [];
  for (let i = 0; i < pairCount; i++) {
    const idRaw = arr[2 + i * 2];
    const rateRaw = arr[3 + i * 2];
    if (idRaw === undefined || rateRaw === undefined) break;
    const itemId = Number(idRaw);
    const rate = Number(rateRaw);
    if (Number.isFinite(itemId) && Number.isFinite(rate)) {
      pairs.push({ itemId, rate });
    }
  }
  return pairs;
}

export function getMonstersByDropItem(itemId: number): MonsterDropSource[] {
  const db = getDb();
  // 先用 LIKE 過濾候選怪物（比全表 JSON 解析快），再解析確認。
  const rows = db
    .prepare(
      `SELECT n.id, n.name, n.level, m.drop_item
       FROM monsters m
       JOIN npc n ON m.id = n.id
       WHERE m.drop_item IS NOT NULL AND m.drop_item LIKE ?`,
    )
    .all(`%"${itemId}"%`) as Array<{ id: number; name: string; level: number; drop_item: string }>;

  const result: MonsterDropSource[] = [];
  for (const row of rows) {
    const pairs = parseDropItem(row.drop_item);
    const match = pairs.find((p) => p.itemId === itemId);
    if (match) {
      result.push({
        id: row.id,
        name: row.name,
        level: row.level,
        rate: match.rate,
      });
    }
  }
  result.sort((a, b) => b.rate - a.rate || a.level - b.level);
  return result;
}
