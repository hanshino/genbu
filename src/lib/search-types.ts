// 全站搜尋的共用型別。不 import DB，client component 也能安全引用。

export const SEARCH_TYPES = [
  "page",
  "guide",
  "item",
  "skill",
  "monster",
  "npc",
  "mission",
  "map",
  "hero",
  "compound",
  "achievement",
] as const;

export type SearchType = (typeof SEARCH_TYPES)[number];

export const SEARCH_TYPE_LABELS: Record<SearchType, string> = {
  page: "頁面",
  guide: "攻略",
  item: "道具",
  skill: "技能",
  monster: "怪物",
  npc: "NPC",
  mission: "任務",
  map: "地圖",
  hero: "英雄",
  compound: "煉化",
  achievement: "成就",
};

export function isSearchType(v: unknown): v is SearchType {
  return typeof v === "string" && (SEARCH_TYPES as readonly string[]).includes(v);
}

export interface SearchHit {
  type: SearchType;
  /** 同類型內唯一即可（技能是 `${id}:${name}`），當 React key 用 */
  id: string;
  name: string;
  href: string;
  /** 右側灰字補充，例如道具類型、怪物等級 */
  meta?: string;
  /** 名稱沒中、靠說明文字命中時，命中處前後的一小段說明 */
  snippet?: string;
}

export interface SearchGroup {
  type: SearchType;
  label: string;
  /** 該類型命中總數（hits 只是前 N 筆） */
  total: number;
  hits: SearchHit[];
}

export interface SearchResult {
  query: string;
  /** 所有類型命中總數 */
  total: number;
  /** 只含有命中的類型；依「組內最佳排名 → 類型權重」排序 */
  groups: SearchGroup[];
}
