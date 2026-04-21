// CLAUDE.md documents this directory for weighted formulas & constants.
// The canonical source lives in src/lib/scoring/presets.ts; this module
// re-exports for discoverability alongside future cross-feature configs.
export { presets as weightedPresets, getPresetById, getPresetByLabel } from "@/lib/scoring/presets";
export type { Preset, Weights } from "@/lib/scoring/types";
