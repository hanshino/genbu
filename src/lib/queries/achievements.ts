import { getDb } from "@/lib/db";
import type {
  AchievementCategory,
  AchievementRow,
  AchievementSearchRow,
} from "@/lib/types/achievement";

export const ACHIEVEMENT_SEARCH_LIMIT = 100;

/**
 * 共用的成就列 SELECT。
 * - reward_type=2 join items、reward_type=5 join magic 取獎勵名稱;
 *   magic 同 id 每等級一列(名稱一致),取 MIN(level) 那列避免重複。
 * - prereq 以 self-join 子查詢取名稱。
 */
const ROW_SELECT = `
  SELECT a.id,
         a.sub_cat_id    AS subCatId,
         a.group_no      AS groupNo,
         a.name,
         a.description,
         a.points,
         a.reset_type    AS resetType,
         a.reward_type   AS rewardType,
         a.reward_id     AS rewardId,
         a.reward_amount AS rewardAmount,
         CASE a.reward_type
           WHEN 2 THEN (SELECT i.name FROM items i WHERE i.id = a.reward_id)
           WHEN 5 THEN (SELECT m.name FROM magic m WHERE m.id = a.reward_id
                        ORDER BY m.level LIMIT 1)
         END AS rewardName,
         (SELECT p.name FROM achievements p WHERE p.id = a.prereq_achievement_id) AS prereqName
`;

/** 大分類 + 子分類(含筆數、點數加總),供 Tabs 與分節標題一次取回。 */
export function getAchievementCategories(): AchievementCategory[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.id           AS categoryId,
              c.name         AS categoryName,
              sc.id          AS subCatId,
              sc.name        AS subCatName,
              COUNT(a.id)    AS count,
              COALESCE(SUM(a.points), 0) AS totalPoints
       FROM achievement_categories c
       JOIN achievement_sub_cats sc ON sc.category_id = c.id
       LEFT JOIN achievements a ON a.sub_cat_id = sc.id
       GROUP BY sc.id
       ORDER BY c.sort_order, sc.sort_order, sc.id`,
    )
    .all() as Array<{
    categoryId: number;
    categoryName: string;
    subCatId: number;
    subCatName: string;
    count: number;
    totalPoints: number;
  }>;

  const cats: AchievementCategory[] = [];
  for (const r of rows) {
    let cat = cats.at(-1);
    if (!cat || cat.id !== r.categoryId) {
      cat = { id: r.categoryId, name: r.categoryName, subCats: [] };
      cats.push(cat);
    }
    cat.subCats.push({
      id: r.subCatId,
      name: r.subCatName,
      count: r.count,
      totalPoints: r.totalPoints,
    });
  }
  return cats;
}

/** 某大分類的全部成就,依子分類 → group_no → id 排序。 */
export function getAchievementsByCategory(categoryId: number): AchievementRow[] {
  const db = getDb();
  return db
    .prepare(
      `${ROW_SELECT}
       FROM achievements a
       JOIN achievement_sub_cats sc ON sc.id = a.sub_cat_id
       WHERE sc.category_id = ?
       ORDER BY sc.sort_order, sc.id, a.group_no, a.id`,
    )
    .all(categoryId) as AchievementRow[];
}

/** 跨全分類搜尋名稱+描述,附分類名,上限 ACHIEVEMENT_SEARCH_LIMIT。 */
export function searchAchievements(keyword: string): AchievementSearchRow[] {
  const kw = keyword.trim();
  if (!kw) return [];
  const db = getDb();
  const like = `%${kw}%`;
  return db
    .prepare(
      `${ROW_SELECT},
         sc.name AS subCatName,
         c.name  AS categoryName
       FROM achievements a
       JOIN achievement_sub_cats sc ON sc.id = a.sub_cat_id
       JOIN achievement_categories c ON c.id = sc.category_id
       WHERE a.name LIKE ? OR a.description LIKE ?
       ORDER BY c.sort_order, sc.sort_order, a.id
       LIMIT ${ACHIEVEMENT_SEARCH_LIMIT}`,
    )
    .all(like, like) as AchievementSearchRow[];
}
