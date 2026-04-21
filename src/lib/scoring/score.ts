import type { Item, ItemRand } from "@/lib/types/item";
import type { ScoredItem, Weights } from "./types";
import { expectedRandom } from "./random-expected";

/**
 * Compute the weighted score for an item, combining fixed attributes with
 * random-attribute expectations. Weight keys missing from the item are
 * ignored. Missing keys in weights contribute 0 (no weight).
 */
export function scoreItem(
  item: Item,
  rands: readonly ItemRand[],
  weights: Weights
): ScoredItem {
  const asRecord = item as unknown as Record<string, number | string | null>;
  const expected = expectedRandom(rands);

  let baseScore = 0;
  let score = 0;
  for (const [key, w] of Object.entries(weights)) {
    const raw = asRecord[key];
    const fixed = typeof raw === "number" ? raw : 0;
    baseScore += fixed * w;
    score += (fixed + (expected[key] ?? 0)) * w;
  }

  return { item, baseScore, score, expectedRandom: expected };
}
