import type { Item, ItemRand } from "@/lib/types/item";

export interface Tag {
  id: string;
  label: string;
  // optional tooltip / explanation
  description?: string;
}

export interface ClassifierInput {
  item: Item;
  rands: readonly ItemRand[];
}

// Future: rule shape will be declarative, e.g.
//   { tag, requires: ['str:>=5', 'dex:>=5'], excludes: ['pow:>=3'] }
// Phase 2 only ships the module shell.
