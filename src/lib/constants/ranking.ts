export const THRESHOLD_KEYS = ["hit", "def", "mdef", "dodge"] as const;
export type ThresholdKey = (typeof THRESHOLD_KEYS)[number];
export type Thresholds = Partial<Record<ThresholdKey, number>>;
