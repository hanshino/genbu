import { SEARCH_TICKS } from "@/configs/idle";
import { levelPoints } from "@/lib/stat-sim";
import type { SimItem } from "@/lib/types/stat-sim";
import type { IdleData, IdleMonster, IdleSkill, IdleState } from "../types";

export const SWORD: SimItem = {
  id: 20101,
  name: "長劍",
  level: 1,
  typeName: "SWORD",
  slotHint: ["right", "left"],
  stats: {},
  strongPathId: null,
  damage: [18, 20],
};

export function monster(over: Partial<IdleMonster> & Pick<IdleMonster, "id">): IdleMonster {
  return {
    name: `怪${over.id}`,
    level: 3,
    hp: 50,
    extraDef: 1,
    magicDef: 1,
    baseDodge: 0,
    dropExp: 85,
    dropMoneyMin: 2,
    dropMoneyMax: 4,
    ...over,
  };
}

/** 落英繽紛 Lv1 的形狀：func_dmg 7、兩段，命中在 tick 0 與 8，施放 79 ticks。 */
export const MULTI_HIT_SKILL: IdleSkill = {
  id: 111,
  name: "落英繽紛",
  skillType: 3,
  levels: [
    { level: 1, learnLevel: 1, funcDmg: 7, p1: 85, p2: 16, p3: 2, p4: 96, funcHitP1: 0, hitTicks: [0, 8], castTicks: 79 },
  ],
};

/** 星雲劍法 Lv1 的形狀：命中就在最後一個 tick（20 / 20）。 */
export const LATE_HIT_SKILL: IdleSkill = {
  id: 112,
  name: "星雲劍法",
  skillType: 3,
  levels: [
    { level: 1, learnLevel: 1, funcDmg: 3, p1: 150, p2: 2, p3: 0, p4: 0, funcHitP1: 90, hitTicks: [20], castTicks: 20 },
  ],
};

/** 移花宮（sect 4）拿長劍；兩隻怪，閃躲 0 所以一定命中。 */
export function makeData(over: Partial<IdleData> = {}): IdleData {
  const monsters = {
    5407: monster({ id: 5407, hp: 50 }),
    5408: monster({ id: 5408, hp: 110, level: 5, extraDef: 3, magicDef: 3, dropExp: 94, dropMoneyMin: 1, dropMoneyMax: 7 }),
  };
  const levelExp = [0, 29, 108, 282, 594, 1000, 1500, 2100, 2800, 3600, 4500, 5500];
  return {
    presetId: 304,
    sectId: 4,
    gender: "m",
    stageId: 147,
    weapon: SWORD,
    monsters,
    spawns: [
      { monsterId: 5407, weight: 23 },
      { monsterId: 5408, weight: 23 },
    ],
    levelExp,
    skills: [MULTI_HIT_SKILL, LATE_HIT_SKILL],
    ...over,
  };
}

export function makeState(over: Partial<IdleState> = {}): IdleState {
  return {
    presetId: 304,
    gender: "m",
    sectId: 4,
    level: 1,
    exp: 0,
    money: 0,
    attributes: { str: 1, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 },
    unspentPoints: levelPoints(1),
    skillId: null,
    skillLevel: 0,
    stageId: 147,
    seed: 12345,
    saveCounter: 0,
    lastSettledAt: 0,
    phase: { kind: "searching", remaining: SEARCH_TICKS },
    stats: { kills: 0, exp: 0, money: 0, hits: 0, misses: 0, damage: 0 },
    ...over,
  };
}
