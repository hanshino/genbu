import { getGuide, getGuides, type GuideMeta } from "@/lib/guides";

/**
 * 迷宮攻略內文提到的怪物 id：<Monster id={…}>、DungeonStep 的 groups ids:[…] 與 marks {id:…}。
 * 寶箱、機關也會被抓進來，用的人自己依閃躲等欄位過濾。
 */
export function monsterIdsInSource(source: string): number[] {
  const ids = new Set<number>();
  for (const m of source.matchAll(/<Monster id=\{(\d+)\}/g)) ids.add(Number(m[1]));
  for (const m of source.matchAll(/ids:\s*\[([\d,\s]+)\]/g)) {
    for (const x of m[1].split(",")) if (x.trim()) ids.add(Number(x));
  }
  for (const m of source.matchAll(/\{\s*id:\s*(\d+)/g)) ids.add(Number(m[1]));
  return [...ids];
}

/** 每篇迷宮攻略與它提到的怪物 id，依攻略順序。 */
export function getDungeonMonsterIds(): { guide: GuideMeta; ids: number[] }[] {
  return getGuides()
    .filter((g) => g.category === "dungeon")
    .map((guide) => ({ guide, ids: monsterIdsInSource(getGuide(guide.slug)?.source ?? "") }));
}
