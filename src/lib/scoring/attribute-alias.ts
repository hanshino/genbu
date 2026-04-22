import { itemAttributeNames } from "@/lib/constants/i18n";

// Reverse map: 中文標籤 → DB column key
const labelToKeyMap: ReadonlyMap<string, string> = new Map(
  Object.entries(itemAttributeNames).map(([key, label]) => [label, key]),
);

export function labelToKey(label: string): string | null {
  return labelToKeyMap.get(label) ?? null;
}

export const knownRandLabels: readonly string[] = Array.from(labelToKeyMap.keys());
