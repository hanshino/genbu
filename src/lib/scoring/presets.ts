import type { Preset } from "./types";

// Ported verbatim from ../tthol-line-bot/src/configs/weighted.config.js
// Do not edit values without updating the parity test.
export const presets: readonly Preset[] = [
  {
    id: "pure-wis",
    label: "純玄系列",
    weights: { wis: 7, dex: 3, hit: 1, def: 0.5, mdef: 0.25 },
  },
  {
    id: "pure-str",
    label: "純外系列",
    weights: { str: 11, atk: 1, dex: 3, hit: 1, def: 0.5, mdef: 0.5 },
  },
  {
    id: "pure-pow",
    label: "純內系列",
    weights: { pow: 9, matk: 1, dex: 3, hit: 1, def: 0.5, mdef: 0.5 },
  },
  {
    id: "wis-pow",
    label: "玄內系列",
    weights: { wis: 7, pow: 5, matk: 1, dex: 3, hit: 1, def: 0.5, mdef: 0.25 },
  },
  {
    id: "wis-str",
    label: "玄外系列",
    weights: { wis: 7, str: 5, atk: 1, dex: 3, hit: 1, def: 0.5, mdef: 0.5 },
  },
  {
    id: "crit-blade",
    label: "爆刀",
    weights: { agi: 7, str: 7, critical: 5, def: 0.75, mdef: 0.75 },
  },
  {
    id: "gauntlet",
    label: "手甲",
    // genbu-revised per player interview: atk > dex > hit.
    // LINE bot had { dex: 15, hit: 5, atk: 7 }; players prioritize 物攻 over
    // 技巧, so atk takes the lead with dex as clear secondary, hit minor.
    weights: { atk: 15, dex: 7, hit: 3 },
  },
  // genbu-only addition (not in LINE bot config)
  {
    id: "medic",
    label: "根骨醫毒",
    weights: { vit: 6, matk: 1 },
  },
] as const;

// Threshold for which weighted stats count as a preset's "identity" —
// anything at ≥45% of the max weight is a required identifying stat, so
// that secondary-but-still-heavy weights (手甲's dex:7 vs atk:15) are not
// discarded in favour of a sole max-weight primary. Tuned so presets read
// semantically: 手甲 → {atk,dex}, 純外 → {str}, 玄內 → {wis,pow}, etc.
const IDENTITY_WEIGHT_RATIO = 0.45;

// For each preset, the stat keys that identify its flavour. An item must
// have nonzero value in ALL of these to be labeled with the preset's chip,
// preventing atk-heavy-but-dex-less items from being mislabeled as 手甲
// under the atk-primary weights.
export const PRESET_PRIMARY_STATS: ReadonlyMap<string, readonly string[]> = new Map(
  presets.map((p) => {
    const max = Math.max(...Object.values(p.weights));
    const threshold = max * IDENTITY_WEIGHT_RATIO;
    const identities = Object.entries(p.weights)
      .filter(([, w]) => w >= threshold)
      .map(([k]) => k);
    return [p.id, identities];
  }),
);

export function getPresetById(id: string): Preset | null {
  return presets.find((p) => p.id === id) ?? null;
}

export function getPresetByLabel(label: string): Preset | null {
  return presets.find((p) => p.label === label) ?? null;
}
