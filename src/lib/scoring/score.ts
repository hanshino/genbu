import type { Item, ItemRand } from "@/lib/types/item";
import type { ScoredItem, Weights } from "./types";
import { expectedRandom } from "./random-expected";

// Accepts Item, RankingItem, or any object with numeric attribute fields.
// Interfaces don't satisfy `Record<string, ...>` implicitly, so we narrow
// to `object` at the boundary and cast internally.
export type ScoreInput = { id: number; name: string };

export function scoreItemWithExpected(
  item: ScoreInput,
  expected: Readonly<Record<string, number>>,
  weights: Weights
): ScoredItem {
  const record = item as unknown as Readonly<Record<string, unknown>>;
  let baseScore = 0;
  let score = 0;
  for (const [key, w] of Object.entries(weights)) {
    const raw = record[key];
    const fixed = typeof raw === "number" ? raw : 0;
    baseScore += fixed * w;
    score += (fixed + (expected[key] ?? 0)) * w;
  }
  return { item: item as Item, baseScore, score, expectedRandom: expected };
}

export function scoreItem(
  item: ScoreInput,
  rands: readonly ItemRand[],
  weights: Weights
): ScoredItem {
  return scoreItemWithExpected(item, expectedRandom(rands), weights);
}
