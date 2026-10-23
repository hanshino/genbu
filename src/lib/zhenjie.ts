/** 從道具說明「真解效果：★★★」取星數；沒有就回 null。 */
export function parseZhenjieStars(summary: string | null | undefined): number | null {
  const match = summary?.match(/真解效果：(★+)/);
  return match ? [...match[1]].length : null;
}

/**
 * 抽 n 次（n 在 modMin..modMax 間均勻，推測）、每次從 lineCount 條等權重詞條或「沒抽到」
 * 裡放回抽樣，重複抽到不疊加。回傳 [實際條數 j] 的機率，索引 0..lineCount。
 * noneWeight / lineWeight 是單條權重和「沒抽到」權重（分母相同即可）。
 */
export function distinctLineDistribution(
  modMin: number,
  modMax: number,
  lineCount: number,
  lineWeight: number,
  noneWeight = 0,
): number[] {
  const total = lineCount * lineWeight + noneWeight;
  const result = new Array<number>(lineCount + 1).fill(0);
  const draws = modMax - modMin + 1;
  for (let n = modMin; n <= modMax; n++) {
    // dp[d] = 抽完目前次數後，已有 d 條不同詞條的機率
    let dp = new Array<number>(lineCount + 1).fill(0);
    dp[0] = 1;
    for (let i = 0; i < n; i++) {
      const next = new Array<number>(lineCount + 1).fill(0);
      for (let d = 0; d <= lineCount; d++) {
        if (dp[d] === 0) continue;
        const pNew = ((lineCount - d) * lineWeight) / total;
        next[d] += dp[d] * (1 - pNew);
        if (d < lineCount) next[d + 1] += dp[d] * pNew;
      }
      dp = next;
    }
    for (let d = 0; d <= lineCount; d++) result[d] += dp[d] / draws;
  }
  return result;
}
