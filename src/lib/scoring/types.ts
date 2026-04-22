import type { Item, ItemRand } from "@/lib/types/item";

// A single attribute key → weight mapping. Keys are DB column names
// (e.g., "str", "atk", "dex"). Missing keys are treated as weight 0.
export type Weights = Record<string, number>;

export interface Preset {
  id: string;
  label: string;
  weights: Weights;
  // Reserved for future: presets may declare which item types they apply to.
  // Phase 2 leaves this undefined (applies to all types).
  applicableTypes?: readonly string[];
}

export interface ScoredItem {
  item: Item;
  baseScore: number; // fixed-attr-only score
  score: number; // baseScore + random expected contribution
  expectedRandom: Record<string, number>; // per-attribute expected value
}

// Item together with its item_rand rows, ready to be scored.
export interface ItemWithRands {
  item: Item;
  rands: ItemRand[];
}
