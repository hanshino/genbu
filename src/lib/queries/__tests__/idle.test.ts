import { describe, expect, it } from "vitest";
import { GAME_SPEED, IDLE_STAGE_ID, SEARCH_TICKS, TICK_MS } from "@/configs/idle";
import { applyAllocation, autoAllocateDelta } from "@/lib/idle/allocation";
import { buildCombatant, presetProblem } from "@/lib/idle/character";
import { advance } from "@/lib/idle/engine";
import { skillOptions } from "@/lib/idle/skills";
import { makeState } from "@/lib/idle/__tests__/fixtures";
import type { IdleData, IdleState } from "@/lib/idle/types";
import { getIdlePreset, loadIdleData } from "../idle";

const BARE_HAND = 300; // 移花宮・空手（男）
const SWORD = 304; // 移花宮・劍（男）：長劍 SWORD
const BARE_HAND_BAD = 200; // 惡人谷・空手（男）
const BLADE = 202; // 惡人谷・刀（男）：青銅刀 BLADE

function freshState(data: IdleData): IdleState {
  return advance(makeState({ presetId: data.presetId, gender: data.gender, sectId: data.sectId, seed: 7 }), 0, data).state;
}

function withAutoAllocation(state: IdleState, data: IdleData): IdleState {
  const applied = applyAllocation(state, autoAllocateDelta(state, data));
  if ("error" in applied) throw new Error(applied.error);
  return { ...state, attributes: applied.attributes, unspentPoints: state.unspentPoints - applied.cost };
}

/** 把等級凍結在 Lv1、只打一種怪：量平均每隻要幾 tick。 */
function ticksPerKill(data: IdleData, monsterId: number, state: IdleState, kills = 120): number {
  const frozen: IdleData = {
    ...data,
    monsters: { [monsterId]: data.monsters[monsterId] },
    spawns: [{ monsterId, weight: 1 }],
    levelExp: [0, 1e12],
  };
  let cur = state;
  let ticks = 0;
  while (cur.stats.kills < kills) {
    cur = advance(cur, 600, frozen).state;
    ticks += 600;
    if (ticks > 60 * 3600 * 24) throw new Error("打不死");
  }
  return ticks / cur.stats.kills;
}

describe("loadIdleData（stage 147）", () => {
  const data = loadIdleData(IDLE_STAGE_ID, SWORD)!;

  it("載入兩隻怪、出現權重、經驗表、預設武器", () => {
    expect(data).not.toBeNull();
    expect(data.spawns).toEqual([
      { monsterId: 5407, weight: 23 },
      { monsterId: 5408, weight: 23 },
    ]);
    expect(data.monsters[5407]).toMatchObject({ level: 3, hp: 50, dropExp: 85, extraDef: 1, magicDef: 1, baseDodge: 65, dropMoneyMin: 2, dropMoneyMax: 4 });
    expect(data.monsters[5408]).toMatchObject({ level: 5, hp: 110, dropExp: 94, baseDodge: 67, dropMoneyMin: 1, dropMoneyMax: 7 });
    expect(data.levelExp[1]).toBe(29);
    expect(data.levelExp[2]).toBe(108);
    expect(data.levelExp).toHaveLength(201);
    expect(data.weapon).toMatchObject({ id: 20101, typeName: "SWORD", damage: [18, 20] });
    expect(data.sectId).toBe(4);
    expect(data.gender).toBe("m");
  });

  it("空手預設角色沒有武器；不存在的預設角色或地圖回 null", () => {
    expect(loadIdleData(IDLE_STAGE_ID, BARE_HAND)!.weapon).toBeNull();
    expect(loadIdleData(IDLE_STAGE_ID, 999999)).toBeNull();
    expect(loadIdleData(999999, SWORD)).toBeNull();
    expect(getIdlePreset(999999)).toBeNull();
  });

  it("技能的命中 tick 與施放時長取自時間軸（星雲劍法 20 / 20，落英繽紛 0 與 8 / 79）", () => {
    const nebula = data.skills.find((s) => s.id === 112)!.levels[0];
    expect(nebula).toMatchObject({ level: 1, learnLevel: 9, hitTicks: [20], castTicks: 20 });
    const petals = data.skills.find((s) => s.id === 111)!.levels[0];
    expect(petals).toMatchObject({ hitTicks: [0, 8], castTicks: 79, p3: 2 });
  });

  it("同一組參數回傳同一份（快取）", () => {
    expect(loadIdleData(IDLE_STAGE_ID, SWORD)).toBe(data);
  });
});

describe("預設角色是否可玩", () => {
  it("空手、長劍、青銅刀可玩；弓（木紋手甲）、入門弟子（sect 1）不行", () => {
    for (const id of [BARE_HAND, SWORD, BARE_HAND_BAD, BLADE]) {
      expect(presetProblem(loadIdleData(IDLE_STAGE_ID, id)!)).toBeNull();
    }
    expect(presetProblem(loadIdleData(IDLE_STAGE_ID, 508)!)).not.toBeNull(); // 無名島 sect 16
    expect(presetProblem(loadIdleData(IDLE_STAGE_ID, 100)!)).not.toBeNull(); // 入門弟子 sect 1
    expect(presetProblem(loadIdleData(IDLE_STAGE_ID, 1220)!)).not.toBeNull(); // 曼陀・扇（CLAW 不支援）
  });
});

describe("技能可選範圍", () => {
  it("Lv1..8 沒有任何門派技能可學（最低 char_level 9）", () => {
    const data = loadIdleData(IDLE_STAGE_ID, SWORD)!;
    const choice = skillOptions(data, 8, buildCombatant({ sectId: 4, level: 8, attributes: freshState(data).attributes }, data));
    expect(choice).toEqual({ options: [], defaultSkillId: null });
  });

  it("Lv15 的移花宮拿劍：只有劍法，取可學的最高級，預設是期望傷害最高", () => {
    const data = loadIdleData(IDLE_STAGE_ID, SWORD)!;
    const attributes = { str: 20, pow: 1, vit: 1, agi: 1, dex: 20, wis: 1 };
    const choice = skillOptions(data, 15, buildCombatant({ sectId: 4, level: 15, attributes }, data));
    const ids = choice.options.map((o) => o.skillId);
    expect(ids).toContain(111); // 落英繽紛
    expect(ids).toContain(112); // 星雲劍法
    expect(ids).toContain(113); // 落月
    expect(ids).not.toContain(114); // 無相明玉掌：掌法要空手
    expect(choice.options.find((o) => o.skillId === 112)!.level).toBe(2); // Lv13 學到 Lv2
    const best = choice.options.reduce((a, b) => (b.expected > a.expected ? b : a));
    expect(choice.defaultSkillId).toBe(best.skillId);
  });

  it("空手的移花宮只有掌法", () => {
    const data = loadIdleData(IDLE_STAGE_ID, BARE_HAND)!;
    const attributes = { str: 1, pow: 20, vit: 1, agi: 1, dex: 20, wis: 1 };
    const choice = skillOptions(data, 15, buildCombatant({ sectId: 4, level: 15, attributes }, data));
    const ids = choice.options.map((o) => o.skillId);
    expect(ids).toContain(114);
    expect(ids).not.toContain(112);
  });
});

describe("Lv1 預設配點能打死兩隻怪（平均每隻幾 tick）", () => {
  const rows: string[] = [];
  const cases = [
    ["移花宮・空手", BARE_HAND],
    ["移花宮・劍", SWORD],
    ["惡人谷・空手", BARE_HAND_BAD],
    ["惡人谷・刀", BLADE],
  ] as const;

  it.each(cases)("%s", (label, presetId) => {
    const data = loadIdleData(IDLE_STAGE_ID, presetId)!;
    const base = freshState(data);
    const tuned = withAutoAllocation(base, data);
    expect(tuned.unspentPoints).toBe(0);
    const cells: string[] = [];
    for (const monsterId of [5407, 5408]) {
      const allOne = ticksPerKill(data, monsterId, base, 30);
      const auto = ticksPerKill(data, monsterId, tuned);
      expect(Number.isFinite(auto)).toBe(true);
      const seconds = (auto * TICK_MS) / GAME_SPEED / 1000;
      const perHour = 3600 / seconds;
      cells.push(
        `${monsterId}: auto ${auto.toFixed(0)} ticks = ${seconds.toFixed(1)} s/kill = ${perHour.toFixed(0)} kills/h` +
          ` (all-1: ${allOne.toFixed(0)} ticks)`,
      );
      expect(auto).toBeGreaterThan(SEARCH_TICKS);
    }
    rows.push(`${label} [${presetId}] attrs ${JSON.stringify(tuned.attributes)} | ${cells.join(" | ")}`);
  });

  it("輸出量測結果", () => {
    console.log(`GAME_SPEED ${GAME_SPEED}\n${rows.join("\n")}`);
  });
});

describe("12 小時離線快轉", () => {
  it("2,592,000 ticks 在 1 秒內結算完，且與事件路徑一致（Lv1 打到升級的真實資料）", () => {
    const data = loadIdleData(IDLE_STAGE_ID, SWORD)!;
    const state = withAutoAllocation(freshState(data), data);
    const ticks = Math.floor((12 * 3600 * 1000 * GAME_SPEED) / TICK_MS);
    const started = performance.now();
    const fast = advance(state, ticks, data);
    const elapsed = performance.now() - started;
    console.log(
      `12h fast-forward: ${elapsed.toFixed(0)} ms, ${fast.summary.kills} kills, Lv${fast.summary.levelBefore} -> Lv${fast.summary.levelAfter}, ` +
        `${fast.summary.exp} exp, ${fast.summary.money} money`,
    );
    expect(elapsed).toBeLessThan(1000);
    expect(fast.summary.kills).toBeGreaterThan(100);

    const full = advance(state, ticks, data, { collectEvents: true });
    expect(fast.summary).toEqual(full.summary);
    expect(fast.state).toEqual(full.state);
  });
});
