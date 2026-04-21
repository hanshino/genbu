import type { ClassifierInput, Tag } from "./types";

export type { Tag, ClassifierInput } from "./types";

// Phase 2 stub: returns no tags. Phase 2.5 will add rule-based classification
// (e.g. "外功+技巧 without 內力 → 外功型"). Consumers should treat an empty
// array as "no tags to display" rather than "unknown".
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- _input parameter reserved for Phase 2.5 rule-based classification
export function classify(_input: ClassifierInput): Tag[] {
  return [];
}
