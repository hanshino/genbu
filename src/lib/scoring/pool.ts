import type { ItemRand } from "@/lib/types/item";
import { expectedRandom } from "./random-expected";
import { presets } from "./presets";
import { scoreItemWithExpected, type ScoreInput } from "./score";
import type { Weights } from "./types";

export function groupRandsByItemId(
  rands: readonly ItemRand[]
): Map<number, ItemRand[]> {
  const map = new Map<number, ItemRand[]>();
  for (const r of rands) {
    const key = Number(r.id);
    const arr = map.get(key);
    if (arr) arr.push(r);
    else map.set(key, [r]);
  }
  return map;
}

export function computePoolMaxValues(pool: readonly object[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const it of pool) {
    for (const [k, v] of Object.entries(it)) {
      if (typeof v === "number") m[k] = Math.max(m[k] ?? 0, v);
    }
  }
  return m;
}

// Score an item against all built-in presets, sharing the expected-random
// computation across presets instead of recomputing it per preset.
export function scoreItemAcrossPresets(
  item: ScoreInput,
  rands: readonly ItemRand[]
): Record<string, number> {
  const expected = expectedRandom(rands);
  const out: Record<string, number> = {};
  for (const p of presets) {
    out[p.id] = scoreItemWithExpected(item, expected, p.weights).score;
  }
  return out;
}

// Score a single item against a given weight vector, sharing a precomputed
// expected-random map. For hot paths that score the same item more than once.
export function scoreWithShared(
  item: ScoreInput,
  expected: Readonly<Record<string, number>>,
  weights: Weights
): number {
  return scoreItemWithExpected(item, expected, weights).score;
}
