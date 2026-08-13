import { getDb } from "@/lib/db";
import type {
  HeroCombination,
  HeroCombinationMember,
  HeroDetail,
  HeroSummary,
} from "@/lib/types/hero";

/**
 * 英雄列表（84 筆），依 hero."group"、id 排序。
 * combinationCount 是此英雄出現在幾組 hero_connect 中（hero1~hero5 任一槽）。
 */
export function getHeroes(): HeroSummary[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT h.id,
              h."group"  AS groupId,
              h.name,
              h.star_up  AS starUp,
              (SELECT COUNT(*) FROM hero_connect hc
               WHERE hc.hero1 = h.id OR hc.hero2 = h.id OR hc.hero3 = h.id
                  OR hc.hero4 = h.id OR hc.hero5 = h.id) AS combinationCount
       FROM hero h
       ORDER BY h."group", h.id`,
    )
    .all() as HeroSummary[];
}

interface HeroDetailRow {
  id: number;
  groupId: string;
  name: string;
  starUp: number;
  help: string;
  combinationCount: number;
  hp: number;
  mp: number;
  atk: number;
  matk: number;
  def: number;
  mdef: number;
  hit: number;
  dodge: number;
  critical: number;
  uncanny_dodge: number;
}

/** 單一英雄詳情；不存在回傳 null。 */
export function getHeroById(id: number): HeroDetail | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT h.id,
              h."group" AS groupId,
              h.name,
              h.star_up AS starUp,
              h.help,
              h.hp, h.mp, h.atk, h.matk, h.def, h.mdef,
              h.hit, h.dodge, h.critical, h.uncanny_dodge,
              (SELECT COUNT(*) FROM hero_connect hc
               WHERE hc.hero1 = h.id OR hc.hero2 = h.id OR hc.hero3 = h.id
                  OR hc.hero4 = h.id OR hc.hero5 = h.id) AS combinationCount
       FROM hero h
       WHERE h.id = ?`,
    )
    .get(id) as HeroDetailRow | undefined;
  if (!row) return null;

  return {
    id: row.id,
    groupId: row.groupId,
    name: row.name,
    starUp: row.starUp,
    combinationCount: row.combinationCount,
    help: row.help,
    stats: {
      hp: row.hp,
      mp: row.mp,
      atk: row.atk,
      matk: row.matk,
      def: row.def,
      mdef: row.mdef,
      hit: row.hit,
      dodge: row.dodge,
      critical: row.critical,
      uncannyDodge: row.uncanny_dodge,
    },
  };
}

interface HeroCombinationRow {
  id: number;
  name: string;
  help: string;
  heroCount: number;
  hero1: number | null;
  hero2: number | null;
  hero3: number | null;
  hero4: number | null;
  hero5: number | null;
  name1: string | null;
  name2: string | null;
  name3: string | null;
  name4: string | null;
  name5: string | null;
  hp: number | null;
  mp: number | null;
  atk: number | null;
  matk: number | null;
  def: number | null;
  mdef: number | null;
  dodge: number | null;
  hit: number | null;
}

function rowToCombination(row: HeroCombinationRow): HeroCombination {
  const slots: Array<[number | null, string | null]> = [
    [row.hero1, row.name1],
    [row.hero2, row.name2],
    [row.hero3, row.name3],
    [row.hero4, row.name4],
    [row.hero5, row.name5],
  ];
  const members: HeroCombinationMember[] = [];
  slots.forEach(([heroId, name], index) => {
    if (heroId === null) return;
    // 目前資料無孤兒參照，但 LEFT JOIN 仍可能落空，保留 fallback 而非丟棄該成員。
    members.push({ slot: index + 1, heroId, name: name ?? `英雄 #${heroId}` });
  });

  return {
    id: row.id,
    name: row.name,
    help: row.help,
    heroCount: row.heroCount,
    members,
    // 加成欄位為 nullable：null 代表該組合沒有這項加成，不補 0。
    bonus: {
      hp: row.hp,
      mp: row.mp,
      atk: row.atk,
      matk: row.matk,
      def: row.def,
      mdef: row.mdef,
      dodge: row.dodge,
      hit: row.hit,
    },
  };
}

const COMBINATION_SELECT = `SELECT hc.id, hc.name, hc.help,
          hc.hero_count AS heroCount,
          hc.hero1, hc.hero2, hc.hero3, hc.hero4, hc.hero5,
          h1.name AS name1, h2.name AS name2, h3.name AS name3,
          h4.name AS name4, h5.name AS name5,
          hc.hp, hc.mp, hc.atk, hc.matk, hc.def, hc.mdef, hc.dodge, hc.hit
   FROM hero_connect hc
   LEFT JOIN hero h1 ON h1.id = hc.hero1
   LEFT JOIN hero h2 ON h2.id = hc.hero2
   LEFT JOIN hero h3 ON h3.id = hc.hero3
   LEFT JOIN hero h4 ON h4.id = hc.hero4
   LEFT JOIN hero h5 ON h5.id = hc.hero5`;

/** 包含此英雄的所有組合，依 hero_connect.id 排序。 */
export function getHeroCombinationsForHero(heroId: number): HeroCombination[] {
  const db = getDb();
  const rows = db
    .prepare(
      `${COMBINATION_SELECT}
       WHERE hc.hero1 = ? OR hc.hero2 = ? OR hc.hero3 = ?
          OR hc.hero4 = ? OR hc.hero5 = ?
       ORDER BY hc.id`,
    )
    .all(heroId, heroId, heroId, heroId, heroId) as HeroCombinationRow[];
  return rows.map(rowToCombination);
}

/**
 * 全量 hero_connect 組合（75 筆），依 hero_connect.id 排序。
 * 供 team builder 一次載入後在 client 端做 pure optimizer 計算；
 * 與 getHeroCombinationsForHero 共用 row mapping，nullable 加成同樣保留 null。
 */
export function getHeroCombinations(): HeroCombination[] {
  const db = getDb();
  const rows = db.prepare(`${COMBINATION_SELECT} ORDER BY hc.id`).all() as HeroCombinationRow[];
  return rows.map(rowToCombination);
}
