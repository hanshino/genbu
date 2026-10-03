// 菁英怪判準（純顯示用啟發式，不代表官方 boss 標記）。地圖頁與練功地圖共用。
//
// - 只看 finite 且 > 0 的 hp；每個 distinct npcId 只算一次（重複 row 不加權）。
// - 需至少 2 個合格物種，且該物種自己 hp 也合格，否則 ratio=null、不是菁英。
// - ratio = 該物種 hp / 其餘合格物種 hp 的標準算術中位數（偶數筆取中間兩筆平均）；
//   ratio >= ELITE_HP_RATIO 才算菁英。
// - 沒有絕對 hp 門檻；單一合格物種永遠不會是菁英。

export const ELITE_HP_RATIO = 10;

function isFinitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** 標準算術中位數；偶數筆取中間兩筆的平均。輸入須已由呼叫端排序。 */
function median(sortedAsc: number[]): number {
  const mid = Math.floor(sortedAsc.length / 2);
  if (sortedAsc.length % 2 === 1) return sortedAsc[mid];
  return (sortedAsc[mid - 1] + sortedAsc[mid]) / 2;
}

/** npcId → hp 倍數（無法比較時為 null，不代表 0 倍）。 */
export function computeHpRatios(
  monsters: readonly { npcId: number; hp: number | null }[],
): Map<number, number | null> {
  // 重複的 npcId 只取第一筆，確保中位數「每個物種只算一次」而不是被 row 數加權。
  const distinctHp = new Map<number, number>();
  for (const m of monsters) {
    if (isFinitePositive(m.hp) && !distinctHp.has(m.npcId)) distinctHp.set(m.npcId, m.hp);
  }

  const result = new Map<number, number | null>();
  for (const m of monsters) {
    if (result.has(m.npcId)) continue;
    const own = distinctHp.get(m.npcId);
    if (distinctHp.size < 2 || own === undefined) {
      result.set(m.npcId, null);
      continue;
    }
    const others = [...distinctHp.entries()]
      .filter(([npcId]) => npcId !== m.npcId)
      .map(([, hp]) => hp)
      .sort((a, b) => a - b);
    result.set(m.npcId, own / median(others));
  }
  return result;
}

export function isEliteRatio(ratio: number | null): boolean {
  return ratio != null && ratio >= ELITE_HP_RATIO;
}
