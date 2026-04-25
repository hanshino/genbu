export type TriangleSolution = {
  T: number;
  BL: number;
  BR: number;
  u1: number;
  u2: number;
  p1: number;
  p2: number;
  m1: number;
  m2: number;
};

export type MagicTriangleResult =
  | { ok: true; solutions: TriangleSolution[] }
  | { ok: false; reason: "invalid_sum" | "invalid_leak" | "no_solution" };

const VALID_SUMS = new Set([17, 18, 19, 20, 21, 22, 23]);

export function solveMagicTriangle(sum: number, leak: number): MagicTriangleResult {
  if (!VALID_SUMS.has(sum)) return { ok: false, reason: "invalid_sum" };
  if (!Number.isInteger(leak) || leak < 1 || leak > 9) {
    return { ok: false, reason: "invalid_leak" };
  }

  const cornersSum = 3 * sum - 45;
  const solutions: TriangleSolution[] = [];
  const seen = new Set<string>();

  for (let T = 1; T <= 9; T++) {
    if (T === leak) continue;
    for (let BL = 1; BL <= 9; BL++) {
      if (BL === leak || BL === T) continue;
      const BR = cornersSum - T - BL;
      if (BR < 1 || BR > 9) continue;
      if (BR === leak || BR === T || BR === BL) continue;

      const u2 = sum - T - leak - BL;
      if (u2 < 1 || u2 > 9) continue;
      if (u2 === leak || u2 === T || u2 === BL || u2 === BR) continue;

      const usedCore = new Set([T, BL, BR, leak, u2]);
      const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => !usedCore.has(n));

      const rightTarget = sum - T - BR;
      for (const p1 of pool) {
        const p2 = rightTarget - p1;
        if (p2 === p1) continue;
        if (!pool.includes(p2)) continue;

        const afterRight = pool.filter((n) => n !== p1 && n !== p2);

        const bottomTarget = sum - BL - BR;
        for (const m1 of afterRight) {
          const m2 = bottomTarget - m1;
          if (m2 === m1) continue;
          if (!afterRight.includes(m2)) continue;

          const sol: TriangleSolution = { T, BL, BR, u1: leak, u2, p1, p2, m1, m2 };
          const key = `${T},${leak},${u2},${BL},${m1},${m2},${BR},${p2},${p1}`;
          if (seen.has(key)) continue;
          seen.add(key);
          solutions.push(sol);
        }
      }
    }
  }

  if (solutions.length === 0) return { ok: false, reason: "no_solution" };
  return { ok: true, solutions };
}
