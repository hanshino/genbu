import { getDb } from "@/lib/db";
import type { Status } from "@/lib/types/status";

// 單一狀態細項查詢。magic.extra_status 有 ~4% 指向不存在的 STATUS.ID（遊戲端孤兒參照），
// 所以回傳是 nullable。
export function getStatusById(id: number): Status | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, "group", "order", name, param1, param2, param3, param4, param5
       FROM status WHERE id = ?`,
    )
    .get(id) as Status | undefined;
  return row ?? null;
}
