import type { ItemRand } from "@/lib/types/item";
import { labelToKey } from "./attribute-alias";

/**
 * Compute the expected random contribution per attribute key for an item,
 * given its item_rand rows. Uses the "rate-weighted midpoint" model:
 *   E[key X] = Σ over rows with attribute==X of ((min+max)/2) × (rate/totalRate)
 * where totalRate is the sum of rate across ALL rand rows for the item.
 */
export function expectedRandom(rands: readonly ItemRand[]): Record<string, number> {
  if (rands.length === 0) return {};

  const totalRate = rands.reduce((acc, r) => acc + r.rate, 0);
  if (totalRate === 0) return {};

  const out: Record<string, number> = {};
  for (const row of rands) {
    const key = labelToKey(row.attribute);
    if (!key) continue;
    const midpoint = (row.min + row.max) / 2;
    const contribution = midpoint * (row.rate / totalRate);
    out[key] = (out[key] ?? 0) + contribution;
  }
  return out;
}
