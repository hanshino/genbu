import { getDb } from "@/lib/db";
import { parseZhenjieStars } from "@/lib/zhenjie";

export interface ZhenjieBook {
  id: number;
  name: string;
  /** 由說明文字「真解效果：★…」解析；全部 70 本都有。 */
  stars: number;
  skillId: number;
  skillName: string | null;
  /** magic.clan；null 代表不分門派的武學（翔龍、疾殺等）。 */
  clan: string | null;
  modCountMin: number;
  modCountMax: number;
  /** 強度 M 範圍（item_rand_counts.comp_count_min..max）。 */
  strengthMin: number;
  strengthMax: number;
  /** 每條詞條的權重（item_rand.rate），依 seq 排；分母 1,000,000。 */
  lineTokens: string[];
  lineWeights: number[];
  /** 「沒抽到」的權重（token = '0' 那列，沒有就是 0）。 */
  noneWeight: number;
}

interface BookRow {
  id: number;
  name: string;
  summary: string | null;
  skillId: number;
  skillName: string | null;
  clan: string | null;
  modCountMin: number;
  modCountMax: number;
  strengthMin: number;
  strengthMax: number;
}

/** 全部真解書（items.use_case = 23），依星數高到低、id 排序。 */
export function getZhenjieBooks(): ZhenjieBook[] {
  const db = getDb();
  // magic 每個等級一列，技能名稱與門派取最低等級那列。
  const rows = db
    .prepare(
      `SELECT i.id, i.name, i.summary,
              i.use_case2 AS skillId,
              m.name AS skillName, m.clan,
              c.mod_count_min AS modCountMin, c.mod_count_max AS modCountMax,
              c.comp_count_min AS strengthMin, c.comp_count_max AS strengthMax
         FROM items i
         JOIN item_rand_counts c ON c.item_id = i.id
         LEFT JOIN magic m ON m.id = i.use_case2
              AND m.level = (SELECT MIN(level) FROM magic WHERE id = i.use_case2)
        WHERE i.use_case = 23
        ORDER BY i.id`,
    )
    .all() as BookRow[];

  const lines = db
    .prepare(
      `SELECT r.id, r.token, r.rate
         FROM item_rand r JOIN items i ON i.id = r.id
        WHERE i.use_case = 23
        ORDER BY r.id, r.seq`,
    )
    .all() as { id: string; token: string; rate: number }[];
  const linesById = new Map<number, { token: string; rate: number }[]>();
  for (const line of lines) {
    const id = Number(line.id);
    const list = linesById.get(id) ?? [];
    list.push(line);
    linesById.set(id, list);
  }

  return rows
    .map((row) => {
      const bookLines = linesById.get(row.id) ?? [];
      const real = bookLines.filter((l) => l.token !== "0");
      return {
        id: row.id,
        name: row.name,
        stars: parseZhenjieStars(row.summary) ?? 0,
        skillId: row.skillId,
        skillName: row.skillName,
        clan: row.clan,
        modCountMin: row.modCountMin,
        modCountMax: row.modCountMax,
        strengthMin: row.strengthMin,
        strengthMax: row.strengthMax,
        lineTokens: real.map((l) => l.token),
        lineWeights: real.map((l) => l.rate),
        noneWeight: bookLines.find((l) => l.token === "0")?.rate ?? 0,
      };
    })
    .sort((a, b) => b.stars - a.stars || a.id - b.id);
}

/** 單本真解；不是真解（use_case ≠ 23）回 null。 */
export function getZhenjieBook(itemId: number): ZhenjieBook | null {
  return getZhenjieBooks().find((b) => b.id === itemId) ?? null;
}

export interface ZhenjieTier {
  stars: number;
  strengthMin: number;
  strengthMax: number;
  bookCount: number;
}

/** 各星數的強度範圍與本數，依星數由低到高。同星數的書範圍相同（測試有鎖）。 */
export function getZhenjieTiers(books: ZhenjieBook[] = getZhenjieBooks()): ZhenjieTier[] {
  const tiers = new Map<number, ZhenjieTier>();
  for (const b of books) {
    const tier = tiers.get(b.stars);
    if (tier) tier.bookCount++;
    else
      tiers.set(b.stars, {
        stars: b.stars,
        strengthMin: b.strengthMin,
        strengthMax: b.strengthMax,
        bookCount: 1,
      });
  }
  return [...tiers.values()].sort((a, b) => a.stars - b.stars);
}
