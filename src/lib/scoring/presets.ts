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
    weights: { dex: 15, hit: 5, atk: 7 },
  },
  // genbu-only addition (not in LINE bot config)
  {
    id: "medic",
    label: "根骨醫毒",
    weights: { vit: 6, matk: 1 },
  },
] as const;

export function getPresetById(id: string): Preset | null {
  return presets.find((p) => p.id === id) ?? null;
}

export function getPresetByLabel(label: string): Preset | null {
  return presets.find((p) => p.label === label) ?? null;
}
