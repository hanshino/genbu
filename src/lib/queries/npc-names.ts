import { getDb } from "@/lib/db";

// 預設暱稱從 npc 表隨機抽：只留純中文 2–5 字，濾掉開發用的佔位/測試名。
const RANDOM_NAME_SQL = `
  SELECT name FROM npc
  WHERE name NOT GLOB '*[^一-龥]*'
    AND length(name) BETWEEN 2 AND 5
    AND name NOT LIKE '%測%'   AND name NOT LIKE '%佔位%'
    AND name NOT LIKE '%劇情%' AND name NOT LIKE '%保留%'
    AND name NOT LIKE '%預留%' AND name NOT LIKE '%備用%'
    AND name NOT LIKE '%廢棄%' AND name NOT LIKE '%分身%'
    AND name NOT LIKE '%活動%' AND name NOT LIKE '%幻影%'
  ORDER BY random() LIMIT 1`;

export function randomNpcName(): string {
  try {
    const row = getDb().prepare(RANDOM_NAME_SQL).get() as { name: string } | undefined;
    return row?.name ?? "英雄";
  } catch {
    // ponytail: 取不到名字不該擋住登入，退回舊的固定預設值。
    return "英雄";
  }
}
