import type { HeroCombination, HeroCombinationBonus, HeroSummary } from "@/lib/types/hero";

/** 可作為排序目標的八項加成，與 hero_connect 的 nullable bonus 欄位同名。 */
export type HeroBonusKey = keyof HeroCombinationBonus;

export const HERO_BONUS_KEYS: readonly HeroBonusKey[] = [
  "hp",
  "mp",
  "atk",
  "matk",
  "def",
  "mdef",
  "dodge",
  "hit",
];

/** 八項加成總和；null 加成在此層一律以 0 計算，原始 combination 仍保留 null。 */
export type HeroBonusTotals = Record<HeroBonusKey, number>;

export interface OptimizeInput {
  heroes: HeroSummary[];
  combinations: HeroCombination[];
  mainHeroId: number;
  /** 恰好要選幾位相惜英雄（不含主英雄），隊伍上限 5 人。 */
  slots: 1 | 2 | 3 | 4;
  target: HeroBonusKey;
  /** 省略＝全部英雄可用；提供時 companions 只能從此集合挑，主英雄一律自動保留。 */
  availableHeroIds?: number[];
}

export interface HeroTeamResult {
  mainHeroId: number;
  /** 恰好 slots 位，依 id 遞增。 */
  companionIds: number[];
  /** 已觸發且成員含主英雄的連結，依 hero_connect.id 遞增。 */
  mainHeroLinks: HeroCombination[];
  /** 已觸發且完全由相惜英雄組成的連結，依 hero_connect.id 遞增。 */
  companionLinks: HeroCombination[];
  totals: HeroBonusTotals;
  targetScore: number;
}

const MAX_RESULTS = 10;

/**
 * 枚舉期間唯一被保留的候選資料：只有 targetScore 與 companions 的 pool 索引。
 * 不保存 totals／links／被淘汰的隊伍，記憶體用量與可行解數量無關。
 */
export interface BoundedTopEntry {
  score: number;
  /** companions 在 pool 中的索引，遞增排序 */
  idx: number[];
}

/**
 * 排序契約：targetScore descending，同分時 companion 索引 tuple ascending 逐項數值比較。
 * 直接吃 raw score/idx，讓 hot path 能先判斷「排不進去」再決定是否 snapshot。
 * pool 為遞增排序，因此索引 tuple 的順序等同 hero id tuple 的順序。
 */
function beats(score: number, idx: readonly number[], other: BoundedTopEntry): boolean {
  if (score !== other.score) return score > other.score;
  for (let i = 0; i < idx.length; i++) {
    if (idx[i] !== other.idx[i]) return idx[i] < other.idx[i];
  }
  return false;
}

/**
 * 把候選併入「最多 k 筆、已依排序契約排好」的 list。
 *
 * bounded contract：無論被呼叫幾次，`top.length` 恆 <= k，被淘汰的候選不會被保留；
 * 結果與「全部收集後排序再取前 k 筆」一致。
 */
export function pushBoundedTop(
  top: BoundedTopEntry[],
  entry: BoundedTopEntry,
  k: number,
): BoundedTopEntry[] {
  if (k <= 0) return top;
  let at = 0;
  while (at < top.length && !beats(entry.score, entry.idx, top[at])) at++;
  if (at >= k) return top; // 連最後一名都排不進去，直接丟掉
  top.splice(at, 0, entry);
  if (top.length > k) top.length = k;
  return top;
}

function emptyTotals(): HeroBonusTotals {
  return { hp: 0, mp: 0, atk: 0, matk: 0, def: 0, mdef: 0, dodge: 0, hit: 0 };
}

/** 可能觸發的連結：members 都在 {主英雄} ∪ pool 內，且扣掉主英雄後人數 <= slots。 */
interface RelevantLink {
  combo: HeroCombination;
  /** members 扣掉主英雄後的 pool 索引，遞增排序 */
  needed: number[];
  hasMain: boolean;
}

/** 掛在 needed 最大索引上的連結；others 為其餘 needed，全部小於該索引。 */
interface AnchoredLink {
  others: number[];
  targetBonus: number;
}

/**
 * 固定主英雄，從可用英雄中枚舉恰好 slots 位相惜英雄，回傳 targetScore 最高的 Top 10 隊伍。
 *
 * 觸發規則（第一版假設）：一組 hero_connect 的所有 non-null 成員都在隊伍中才算觸發，
 * 主英雄沒有特殊待遇，完全由 companions 組成的連結同樣計入。
 * 所有已觸發連結的八項 bonus 直接相加，null 視為 0。
 * 至少要觸發一組連結才會列入結果。
 *
 * 排序：targetScore descending；同分時以 companion IDs 的遞增數列逐項比較（數值比較，非字串）。
 * 主英雄不存在、slots 不在 1–4、或可用人數不足以組成完整隊伍時回傳空陣列。
 *
 * 枚舉只維護 bounded Top 10（見 pushBoundedTop），不保存全部可行解；
 * 八項 totals 與連結分組只對最後勝出的 <= 10 組隊伍計算。
 */
export function optimizeHeroTeams({
  heroes,
  combinations,
  mainHeroId,
  slots,
  target,
  availableHeroIds,
}: OptimizeInput): HeroTeamResult[] {
  if (!Number.isInteger(slots) || slots < 1 || slots > 4) return [];
  if (!heroes.some((h) => h.id === mainHeroId)) return [];

  // candidate pool：全體英雄扣掉主英雄，受限模式再交集可用集合。
  // 不依主英雄的 adjacency 縮減，否則會漏掉只由 companions 完成的連結。
  const allowed = availableHeroIds ? new Set(availableHeroIds) : null;
  const pool = heroes
    .map((h) => h.id)
    .filter((id) => id !== mainHeroId && (allowed === null || allowed.has(id)))
    .sort((a, b) => a - b);
  if (pool.length < slots) return [];

  const poolIndex = new Map<number, number>();
  pool.forEach((id, i) => poolIndex.set(id, i));

  // 先剔除在任何隊伍都不可能全員到齊的連結（成員不在可用範圍、或需要的人數超過 slots）。
  const relevant: RelevantLink[] = [];
  for (const combo of combinations) {
    if (combo.members.length === 0) continue; // 空成員組合無法判定觸發，跳過
    const needed: number[] = [];
    let hasMain = false;
    let reachable = true;
    for (const member of combo.members) {
      if (member.heroId === mainHeroId) {
        hasMain = true;
        continue;
      }
      const index = poolIndex.get(member.heroId);
      if (index === undefined) {
        reachable = false;
        break;
      }
      needed.push(index);
    }
    if (!reachable || needed.length > slots) continue;
    needed.sort((a, b) => a - b);
    relevant.push({ combo, needed, hasMain });
  }
  // 沒有任何可觸發的連結時，所有隊伍都會被「至少一組連結」的條件濾掉。
  if (relevant.length === 0) return [];

  // 每組連結掛在 needed 的最大索引上。DFS 依索引遞增加入 companions，
  // 因此該索引被加入時其餘 needed 必定已在隊伍中 → 每組連結每隊只判定一次，可增量累加分數。
  const anchored: AnchoredLink[][] = pool.map(() => []);
  let baseScore = 0;
  let baseCount = 0;
  for (const link of relevant) {
    const targetBonus = link.combo.bonus[target] ?? 0;
    if (link.needed.length === 0) {
      // 只由主英雄構成的連結，每一隊都成立。
      baseScore += targetBonus;
      baseCount++;
      continue;
    }
    const anchor = link.needed[link.needed.length - 1];
    anchored[anchor].push({ others: link.needed.slice(0, -1), targetBonus });
  }

  const top: BoundedTopEntry[] = [];
  const inTeam = new Uint8Array(pool.length);
  const companions: number[] = new Array<number>(slots).fill(0);
  let score = baseScore;
  let triggered = baseCount;

  function walk(start: number, depth: number) {
    if (depth === slots) {
      if (triggered === 0) return;
      // 先用 raw score/idx 比對現任最後一名，排不進去就不做任何 allocation。
      if (top.length === MAX_RESULTS && !beats(score, companions, top[MAX_RESULTS - 1])) return;
      pushBoundedTop(top, { score, idx: companions.slice() }, MAX_RESULTS);
      return;
    }
    const remaining = slots - depth;
    for (let i = start; i <= pool.length - remaining; i++) {
      companions[depth] = i;
      inTeam[i] = 1;
      let addedScore = 0;
      let addedCount = 0;
      const links = anchored[i];
      for (let l = 0; l < links.length; l++) {
        const others = links[l].others;
        let complete = true;
        for (let o = 0; o < others.length; o++) {
          if (!inTeam[others[o]]) {
            complete = false;
            break;
          }
        }
        if (complete) {
          addedScore += links[l].targetBonus;
          addedCount++;
        }
      }
      score += addedScore;
      triggered += addedCount;
      walk(i + 1, depth + 1);
      score -= addedScore;
      triggered -= addedCount;
      inTeam[i] = 0;
    }
  }
  walk(0, 0);

  const byId = (a: HeroCombination, b: HeroCombination) => a.id - b.id;
  return top.map((entry) => {
    const companionIds = entry.idx.map((i) => pool[i]);
    const team = new Set([mainHeroId, ...companionIds]);
    const mainHeroLinks: HeroCombination[] = [];
    const companionLinks: HeroCombination[] = [];
    const totals = emptyTotals();
    for (const link of relevant) {
      if (!link.combo.members.every((m) => team.has(m.heroId))) continue;
      for (const key of HERO_BONUS_KEYS) totals[key] += link.combo.bonus[key] ?? 0;
      if (link.hasMain) mainHeroLinks.push(link.combo);
      else companionLinks.push(link.combo);
    }
    return {
      mainHeroId,
      companionIds,
      mainHeroLinks: mainHeroLinks.sort(byId),
      companionLinks: companionLinks.sort(byId),
      totals,
      targetScore: entry.score,
    };
  });
}

export interface HeroAdditionSuggestion {
  heroId: number;
  /** 把這位英雄加進可使用範圍後，最佳隊伍的 targetScore */
  score: number;
  /** 相對目前最佳解的增幅，恆 > 0 */
  gain: number;
  /** 這位英雄補進來才有機會湊齊的連結（其餘成員都已在可用範圍或是主英雄） */
  unlocked: HeroCombination[];
}

export interface SuggestHeroAdditionsInput extends Omit<OptimizeInput, "availableHeroIds"> {
  /** 受限名冊；全部英雄皆可用時沒有「未持有英雄」，不該呼叫本函式。 */
  availableHeroIds: number[];
  /** 最多回傳幾筆，預設 4。 */
  limit?: number;
}

/**
 * 「再多一位會更好」：在未持有英雄中找出實際能把 targetScore 推最高的建議。
 *
 * 候選預選是可證明不漏解的，不做任意截斷：
 * 若某位未持有英雄 h 沒有任何「其餘成員都已可用且扣掉主英雄後人數 <= slots」的連結，
 * 則含 h 的隊伍不可能觸發任何含 h 的連結，其觸發集合完全落在 {主英雄} ∪ 已可用英雄 內，
 * 而該集合的隊伍還能再補一位已可用英雄（觸發只會增加不會減少），
 * 所以 h 的最佳分數不可能超過現有最佳解 → gain <= 0，排除它不會漏掉更好的建議。
 * 通過預選的候選一律跑完整 optimizer 取精確分數，不用估值排名。
 */
export function suggestHeroAdditions({
  heroes,
  combinations,
  mainHeroId,
  slots,
  target,
  availableHeroIds,
  limit = 4,
}: SuggestHeroAdditionsInput): HeroAdditionSuggestion[] {
  const [best] = optimizeHeroTeams({
    heroes,
    combinations,
    mainHeroId,
    slots,
    target,
    availableHeroIds,
  });
  // 目前連一組完整連結都湊不出來時沒有比較基準，交給 empty state 處理。
  if (!best) return [];

  const available = new Set(availableHeroIds);
  const suggestions: HeroAdditionSuggestion[] = [];

  for (const hero of heroes) {
    if (hero.id === mainHeroId || available.has(hero.id)) continue;
    const unlocked = combinations.filter(
      (combo) =>
        combo.members.length > 0 &&
        combo.members.some((m) => m.heroId === hero.id) &&
        combo.members.every(
          (m) => m.heroId === hero.id || m.heroId === mainHeroId || available.has(m.heroId),
        ) &&
        // 這條連結要塞得進隊伍：扣掉主英雄後的成員數不能超過 slots
        combo.members.filter((m) => m.heroId !== mainHeroId).length <= slots,
    );
    if (unlocked.length === 0) continue;

    const [top] = optimizeHeroTeams({
      heroes,
      combinations,
      mainHeroId,
      slots,
      target,
      availableHeroIds: [...availableHeroIds, hero.id],
    });
    if (!top) continue;
    const gain = top.targetScore - best.targetScore;
    if (gain <= 0) continue;
    suggestions.push({ heroId: hero.id, score: top.targetScore, gain, unlocked });
  }

  return suggestions.sort((a, b) => b.gain - a.gain || a.heroId - b.heroId).slice(0, limit);
}
