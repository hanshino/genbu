/**
 * hero 表（84 筆）的戰鬥數值欄位。
 * schema 上這些欄位皆為 `integer not null`，故全部非 nullable。
 */
export interface HeroStats {
  hp: number;
  mp: number;
  atk: number;
  matk: number;
  def: number;
  mdef: number;
  hit: number;
  dodge: number;
  critical: number;
  uncannyDodge: number;
}

/** 英雄列表投影。 */
export interface HeroSummary {
  id: number;
  /** hero."group" 原始值（varchar，資料中為 "1"~"4"），只是原始分組欄位 */
  groupId: string;
  name: string;
  /** hero.star_up 原始值，語意未解碼，不做任何換算 */
  starUp: number;
  /** 此英雄出現在幾組 hero_connect 組合中（hero1~hero5 任一槽命中） */
  combinationCount: number;
}

/** 英雄詳情：raw fields 全量。 */
export interface HeroDetail extends HeroSummary {
  /** hero.help 原始說明文字 */
  help: string;
  stats: HeroStats;
}

/** 組合中的單一成員，slot 對應 hero_connect.hero1~hero5 的欄位位置。 */
export interface HeroCombinationMember {
  /** 1~5，對應 hero1~hero5 欄位順序 */
  slot: number;
  heroId: number;
  /** JOIN hero 取得的名稱；查無對應 hero 時 fallback 為 `英雄 #id` */
  name: string;
}

/**
 * hero_connect 組合（75 筆）。
 *
 * 加成欄位在 schema 上是 `integer null`，且實測大量為 NULL
 * （def 49、mdef 61、dodge 48、hit 44、atk 16、matk 5 筆為 NULL），
 * 代表「該組合沒有這項加成」，故一律保留 null，不用 COALESCE 補 0 掩蓋缺失。
 */
export interface HeroCombinationBonus {
  hp: number | null;
  mp: number | null;
  atk: number | null;
  matk: number | null;
  def: number | null;
  mdef: number | null;
  dodge: number | null;
  hit: number | null;
}

export interface HeroCombination {
  id: number;
  /** hero_connect.name（schema 宣告為 integer，實際存的是組合中文名） */
  name: string;
  /** hero_connect.help 原始加成說明文字 */
  help: string;
  /** hero_connect.hero_count 原始值；實測與非 null 成員數一致 */
  heroCount: number;
  /** 依 hero1~hero5 槽位順序，略過 null 槽 */
  members: HeroCombinationMember[];
  bonus: HeroCombinationBonus;
}
