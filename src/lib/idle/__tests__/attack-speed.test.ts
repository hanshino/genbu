import { describe, expect, it } from "vitest";
import { SEARCH_TICKS } from "@/configs/idle";
import {
  attackSpeedBase,
  attackSpeedLevel,
  swingHitTick,
  swingPeriodSeconds,
  swingTicks,
} from "@/lib/attack-speed";
import type { SimItem } from "@/lib/types/stat-sim";
import { buildCombatant } from "../character";
import { advance } from "../engine";
import { makeData, makeState, monster } from "./fixtures";

const BRONZE_BLADE: SimItem = {
  id: 23004,
  name: "新手用青銅刀",
  level: 1,
  typeName: "BLADE",
  slotHint: ["right", "left"],
  stats: {},
  strongPathId: null,
  damage: [4, 6],
};

/** 入門弟子（sect 1）拿新手用青銅刀；agi 之外的六圍都是 1。 */
const novice = (agi: number, weapon: SimItem = BRONZE_BLADE) => ({
  data: makeData({ presetId: 102, sectId: 1, weapon }),
  state: makeState({
    presetId: 102,
    sectId: 1,
    attributes: { str: 1, pow: 1, vit: 1, agi, dex: 1, wis: 1 },
  }),
});

describe("攻速等級（tthol-emulator attack_speed.py）", () => {
  it("空手：客戶端實測 身法 8→7、37→8、78→10、144→12、186→14", () => {
    for (const [agi, level] of [
      [8, 7],
      [37, 8],
      [78, 10],
      [144, 12],
      [186, 14],
    ] as const) {
      expect(attackSpeedLevel(null, 1, agi)).toBe(level);
    }
  });

  it("基礎值：入門弟子 刀 170、劍 175、匕首 180、棍 170、倭刀 175、空手 185", () => {
    expect(attackSpeedBase("BLADE", 1)).toBe(170);
    expect(attackSpeedBase("SWORD", 1)).toBe(175);
    expect(attackSpeedBase("STING", 1)).toBe(180);
    expect(attackSpeedBase("ROD", 1)).toBe(170);
    expect(attackSpeedBase("GREAT_SWORD", 1)).toBe(175);
    expect(attackSpeedBase(null, 1)).toBe(185);
  });

  it("門派欄位：移花宮 劍 180、惡人谷 刀 175、天外天 匕首 185；盾不在表裡", () => {
    expect(attackSpeedBase("SWORD", 4)).toBe(180);
    expect(attackSpeedBase("BLADE", 2)).toBe(175);
    expect(attackSpeedBase("STING", 8)).toBe(185);
    expect(attackSpeedBase("SHIELD", 1)).toBeNull();
  });

  it("裝備加成加在階梯等級上，上限 14（天外天 Lv190 身法 186 倭刀 +1：遊戲 14）", () => {
    expect(attackSpeedLevel("GREAT_SWORD", 8, 186, 1)).toBe(14);
    // 移花宮 身法 8 劍 +1：遊戲 7。
    expect(attackSpeedLevel("SWORD", 4, 8, 1)).toBe(7);
    expect(attackSpeedLevel("BLADE", 1, 1, 0)).toBe(5);
    expect(attackSpeedLevel("BLADE", 1, 1, 1)).toBe(6);
    expect(attackSpeedLevel("BLADE", 1, 1, -9)).toBe(1);
  });
});

describe("揮擊週期", () => {
  it("Lv1 約 0.85 秒、Lv14 約 0.16 秒", () => {
    expect(swingPeriodSeconds(1)).toBeCloseTo(0.853, 3);
    expect(swingPeriodSeconds(14)).toBeCloseTo(0.16, 5);
  });

  it("換成 ticks（1/60 秒）並四捨五入：Lv1 51、Lv5 38、Lv6 35、Lv14 10", () => {
    expect([1, 5, 6, 14].map(swingTicks)).toEqual([51, 38, 35, 10]);
    for (let level = 1; level <= 14; level++) {
      expect(Math.abs(swingTicks(level) - swingPeriodSeconds(level) * 60)).toBeLessThanOrEqual(0.5);
    }
  });

  it("命中在週期的 2/3（第 2d 格，下一次揮擊在 3d）", () => {
    expect([51, 38, 35, 10].map(swingHitTick)).toEqual([34, 25, 23, 7]);
  });
});

describe("放置角色的普攻", () => {
  it("入門弟子 刀：身法 1 / 10 / 30 = 等級 5 / 5 / 6，用自己的入門欄位", () => {
    const rows = [1, 10, 30].map((agi) => {
      const { data, state } = novice(agi);
      return buildCombatant(state, data).normalAttack;
    });
    expect(rows.map((r) => r.level)).toEqual([5, 5, 6]);
    expect(rows.map((r) => r.castTicks)).toEqual([38, 38, 35]);
    expect(rows.map((r) => r.hitTick)).toEqual([25, 25, 23]);
  });

  it("入門與轉職後的門派欄位不同：同樣是劍，入門 175 比移花宮 180 慢一級", () => {
    const sword = makeData().weapon!;
    const attrs = { str: 1, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 };
    const asNovice = buildCombatant(
      makeState({ presetId: 102, sectId: 1, attributes: attrs }),
      makeData({ presetId: 102, sectId: 1, weapon: sword }),
    ).normalAttack;
    const asSect = buildCombatant(
      makeState({ attributes: attrs }),
      makeData({ weapon: sword }),
    ).normalAttack;
    expect(asNovice.level).toBe(5);
    expect(asSect.level).toBe(6);
    expect(asSect.castTicks).toBeLessThan(asNovice.castTicks);
  });

  it("武器的 attack_speed 加成多一級", () => {
    const plain = novice(1);
    const fast = novice(1, { ...BRONZE_BLADE, stats: { attack_speed: 1 } });
    expect(buildCombatant(plain.state, plain.data).normalAttack.level).toBe(5);
    expect(buildCombatant(fast.state, fast.data).normalAttack.level).toBe(6);
  });

  it("引擎：普攻命中在週期的 2/3，週期結束直接揮下一次（沒有施放後間隔）", () => {
    const { data, state } = novice(1);
    const slow = {
      ...data,
      skills: [],
      monsters: { 5407: monster({ id: 5407, hp: 99999 }) },
      spawns: [{ monsterId: 5407, weight: 1 }],
    };
    const { events } = advance(state, SEARCH_TICKS + 38 * 2 + 1, slow, { collectEvents: true });
    expect(events.filter((e) => e.type === "cast").map((e) => e.t)).toEqual([
      SEARCH_TICKS,
      SEARCH_TICKS + 38,
      SEARCH_TICKS + 76,
    ]);
    expect(events.filter((e) => e.type === "cast")[0]).toMatchObject({
      skillId: null,
      castTicks: 38,
    });
    const hits = events.filter((e) => e.type === "hit" || e.type === "miss").map((e) => e.t);
    expect(hits.slice(0, 2)).toEqual([SEARCH_TICKS + 25, SEARCH_TICKS + 38 + 25]);
  });

  it("速度快的一方在同樣時間內揮得更多次，且結果在切段執行時一致", () => {
    const { data, state } = novice(1);
    const fastData = { ...data, weapon: { ...BRONZE_BLADE, stats: { attack_speed: 8 } } };
    const run = (d: typeof data) =>
      advance(state, 3000, { ...d, skills: [] }, { collectEvents: true });
    const slow = run(data).events.filter((e) => e.type === "cast").length;
    const quick = run(fastData).events.filter((e) => e.type === "cast").length;
    expect(quick).toBeGreaterThan(slow);
    const whole = advance(state, 3000, { ...data, skills: [] });
    const split = advance(advance(state, 1234, { ...data, skills: [] }).state, 3000 - 1234, {
      ...data,
      skills: [],
    });
    expect(split.state).toEqual(whole.state);
  });
});
