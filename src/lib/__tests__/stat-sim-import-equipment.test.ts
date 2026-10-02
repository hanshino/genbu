import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getStatSimData } from "@/lib/queries/stat-sim";
import { createDefaultCharacter } from "@/lib/stat-character";
import { computePanel } from "@/lib/stat-sim";
import { decomposeEquipment } from "@/lib/stat-sim-import-equipment";
import {
  IMPORT_STAT_KEYS, type ImportEquipEntry, type ImportStats,
} from "@/lib/types/stat-sim-import";
import {
  type EquippedItem, type EquipSlot, type GameData, type SimItem, type SocketRecipe, type ValueRange,
} from "@/lib/types/stat-sim";

function fixture(overrides: Partial<SimItem> = {}, recipes: SocketRecipe[] = []): GameData {
  return {
    itemsById: { 1: {
      id: 1, name: "測試裝備", level: 1, typeName: "SWORD", slotHint: ["right"],
      strongPathId: null, stats: {}, socketCount: 2, socketCategory: 1, ...overrides,
    } },
    enhancementsByPath: {}, passives: [], meridianIds: [],
    socketRecipes: Object.fromEntries(recipes.map((recipe) => [recipe.id, recipe])),
    socketRecipeIdsByCategory: { 1: recipes.map((recipe) => recipe.id) },
  };
}
const recipe = (id: number, ranges: ValueRange[] = [[2, 6]]): SocketRecipe => ({
  id, name: `配方 ${id}`, effects: [{ stat: "atk", ranges }],
});
const entry = (stats: ImportStats = {}, inlays: ImportEquipEntry["inlays"] = [0, 0, 0, 0]): ImportEquipEntry => ({
  id: 1, plus: 0, stats, inlays,
});

function verify(input: ImportEquipEntry, equipment: EquippedItem, data: GameData, slot: EquipSlot = "right") {
  const item = data.itemsById[input.id];
  for (const stat of IMPORT_STAT_KEYS) {
    const total = (item?.stats[stat] ?? 0) + (equipment.manualBonuses[stat] ?? 0)
      + (equipment.sockets ?? []).reduce((sum, fill) => sum + (fill?.stat === stat ? fill.value : 0), 0)
      + (equipment.randomRolls ?? []).reduce((sum, roll) => sum +
        (item?.randomOptions?.find((option) => option.attribute === roll.attribute)?.stat === stat ? roll.value : 0), 0);
    expect(total, `${input.id} ${stat} conservation`).toBe(input.stats[stat] ?? 0);
  }
  expect(equipment.manualBonuses).not.toHaveProperty("weight");
  expect(equipment.enhancementLevel).toBe(input.plus);
  const character = createDefaultCharacter();
  character.equipment[slot] = equipment;
  expect(computePanel(character, data).issues.filter((issue) => issue.code.startsWith("invalid-"))).toEqual([]);
}

function run(input: ImportEquipEntry, data: GameData) {
  const result = decomposeEquipment(input, "right", data);
  verify(input, result.equipment, data);
  return result;
}

describe("decomposeEquipment — synthetic", () => {
  it("missing item uses ID only, retaining only imported stats and enhancement", () => {
    const input = { ...entry({ atk: 17 }), id: 999, plus: 5 };
    const result = run(input, fixture());
    expect(result.equipment).toEqual({ itemId: 999, enhancementLevel: 5, manualBonuses: { atk: 17 } });
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: "missing-item", severity: "warning", slot: "right", itemId: 999 })]);
  });

  it("negative residual stays signed; unexported DB weight is never canceled", () => {
    const result = run(entry({ atk: 7 }), fixture({ stats: { atk: 10, hp: 20, weight: 300 } }));
    expect(result.equipment.manualBonuses).toEqual({ atk: -3, hp: -20 });
    expect(result.diagnostics.map((d) => [d.code, d.stat])).toEqual([["data-mismatch", "hp"], ["data-mismatch", "atk"]]);
    expect(result.diagnostics[0].message).toContain("可能資料版本不一致");
  });

  it("ignores non-import stats in the input and never guesses weight socket effects", () => {
    const data = fixture({ stats: { weight: 300 }, randomOptions: [
      { attribute: "重量", stat: "weight", ranges: [[1, 10]] },
    ] }, [{ id: 10, name: "重量", effects: [{ stat: "weight", ranges: [[5, 5]] }] }]);
    const input = entry({}, [0, 0, 0, 10]);
    Object.assign(input.stats, { weight: 999 });
    const result = run(input, data);
    expect(result.equipment).toMatchObject({ manualBonuses: {}, randomRolls: [], sockets: [null, null] });
    expect(result.diagnostics.map((d) => d.code)).toEqual(["undecomposable"]);
  });

  it("missing recipes occupy their compacted slot; zeros are removed and remaining slots padded", () => {
    const result = run(entry({ atk: 4 }, [0, 99, 0, 10]), fixture({ socketCount: 3 }, [recipe(10, [[4, 4]])]));
    expect(result.equipment.sockets).toEqual([null, { recipeId: 10, stat: "atk", value: 4 }, null]);
    expect(result.diagnostics.map((d) => d.code)).toEqual(["missing-socket-recipe"]);
  });

  it("wrong category leaves null; overflow never creates an invalid trailing null", () => {
    const data = fixture({ socketCount: 1 }, [recipe(10)]);
    data.socketRecipeIdsByCategory = { 2: [10] };
    const result = run(entry({}, [0, 10, 10, 10]), data);
    expect(result.equipment.sockets).toEqual([null]);
    expect(result.diagnostics.map((d) => d.code)).toEqual(["invalid-socket-category", "invalid-socket-index", "invalid-socket-index"]);
  });

  it("fixed recipes subtract before random allocation; fewer rolls than randomCount min is fine", () => {
    const data = fixture({ stats: { def: 10 }, randomCount: [5, 5], randomOptions: [
      { attribute: "防禦", stat: "def", ranges: [[100, 500]] },
      { attribute: "根骨", stat: "vit", ranges: [[1, 5]] },
    ] }, [{ id: 10, name: "固定防禦", effects: [{ stat: "def", ranges: [[25, 25]] }] }]);
    const result = run(entry({ def: 471 }, [0, 0, 10, 10]), data);
    expect(result.equipment.sockets?.map((fill) => fill?.value)).toEqual([25, 25]);
    expect(result.equipment.randomRolls).toEqual([{ attribute: "防禦", value: 411 }]);
    expect(result.equipment.manualBonuses).toEqual({});
    expect(result.diagnostics).toEqual([]);
  });

  it("random-first allocation raises sockets in order after exhausting the random maximum", () => {
    const data = fixture({ randomOptions: [{ attribute: "物攻", stat: "atk", ranges: [[5, 10]] }] }, [recipe(10, [[9, 12]])]);
    const first = run(entry({ atk: 24 }, [0, 0, 10, 10]), data);
    expect(first.equipment.sockets?.map((fill) => fill?.value)).toEqual([9, 9]);
    expect(first.equipment.randomRolls).toEqual([{ attribute: "物攻", value: 6 }]);
    const raised = run(entry({ atk: 32 }, [0, 0, 10, 10]), data);
    expect(raised.equipment.sockets?.map((fill) => fill?.value)).toEqual([12, 10]);
    expect(raised.equipment.randomRolls).toEqual([{ attribute: "物攻", value: 10 }]);
    expect(raised.diagnostics).toEqual([]);
  });

  it("can omit an unobserved random roll when sockets alone fit, but never invent one at R <= 0", () => {
    const data = fixture({ randomOptions: [{ attribute: "物攻", stat: "atk", ranges: [[5, 10]] }] }, [recipe(10, [[9, 12]])]);
    const result = run(entry({ atk: 20 }, [0, 0, 10, 10]), data);
    expect(result.equipment.sockets?.map((fill) => fill?.value)).toEqual([10, 10]);
    expect(result.equipment.randomRolls).toEqual([]);
    expect(result.diagnostics).toEqual([]);
    expect(run(entry(), data).equipment.randomRolls).toEqual([]);
  });

  it("respects gaps in BOTH socket and random unions, including lookahead past greedy endpoints", () => {
    const data = fixture({ randomOptions: [{ attribute: "物攻", stat: "atk", ranges: [[2, 2], [5, 5]] }] }, [
      recipe(10, [[1, 1], [4, 4]]), recipe(11, [[1, 1], [3, 3]]),
    ]);
    const result = run(entry({ atk: 8 }, [0, 0, 10, 11]), data);
    expect(result.equipment.sockets?.map((fill) => fill?.value)).toEqual([1, 1]);
    // 5 cannot be used: remaining socket total 3 is in a gap. 2 also cannot make 6.
    expect(result.equipment.manualBonuses).not.toEqual({});
  });

  it("union endpoints find an exact solution even when the maximal random roll cannot work", () => {
    const data = fixture({ randomOptions: [{ attribute: "物攻", stat: "atk", ranges: [[2, 3], [6, 6]] }] }, [
      recipe(10, [[1, 1], [4, 4]]), recipe(11, [[1, 1], [3, 3]]),
    ]);
    const result = run(entry({ atk: 9 }, [0, 0, 10, 11]), data);
    expect(result.equipment.sockets?.map((fill) => fill?.value)).toEqual([4, 3]);
    expect(result.equipment.randomRolls).toEqual([{ attribute: "物攻", value: 2 }]);
    expect(result.diagnostics).toEqual([]);
  });

  it("no random: even split, integer remainder by socket order and constrained minima", () => {
    const result = run(entry({ atk: 11 }, [0, 0, 10, 10]), fixture({}, [recipe(10, [[1, 10]])]));
    expect(result.equipment.sockets?.map((fill) => fill?.value)).toEqual([6, 5]);
    expect(result.diagnostics).toEqual([]);
    const constrained = run(entry({ atk: 11 }, [0, 10, 11, 11]), fixture({ socketCount: 3 }, [recipe(10, [[10, 20]]), recipe(11, [[0, 20]])]));
    expect(constrained.equipment.sockets?.map((fill) => fill?.value)).toEqual([10, 1, 0]);
    const gap = run(entry({ atk: 7 }, [0, 0, 10, 10]), fixture({}, [recipe(10, [[1, 2], [5, 6]])]));
    expect(gap.equipment.sockets?.map((fill) => fill?.value)).toEqual([5, 2]);
    expect(gap.diagnostics).toEqual([]);
  });

  it("multi-effect selection uses STAT_KEYS, not recipe order, and considers later sockets", () => {
    const multi: SocketRecipe = { id: 10, name: "多效果", effects: [
      { stat: "def", ranges: [[4, 6]] }, { stat: "atk", ranges: [[4, 6]] },
    ] };
    const first = run(entry({ atk: 4, def: 4 }, [0, 0, 0, 10]), fixture({}, [multi]));
    expect(first.equipment.sockets?.[0]).toEqual({ recipeId: 10, stat: "atk", value: 4 });
    const lookahead = run(entry({ atk: 4, def: 4 }, [0, 0, 10, 11]), fixture({}, [multi, recipe(11, [[3, 5]])]));
    expect(lookahead.equipment.sockets).toEqual([
      { recipeId: 10, stat: "def", value: 4 }, { recipeId: 11, stat: "atk", value: 4 },
    ]);
    expect(lookahead.diagnostics).toEqual([]);
    const onlySecondFits = run(entry({ atk: 2, def: 4 }, [0, 0, 0, 10]), fixture({}, [multi]));
    expect(onlySecondFits.equipment.sockets?.[0]).toEqual({ recipeId: 10, stat: "def", value: 4 });
    expect(onlySecondFits.equipment.manualBonuses).toEqual({ atk: 2 });
  });

  it.each([1, 3, 20])("infeasible total %i keeps valid recipe minima plus signed manual compensation", (total) => {
    const result = run(entry({ atk: total }, [0, 0, 10, 10]), fixture({}, [recipe(10, [[2, 2], [4, 4]])]));
    expect(result.equipment.sockets?.map((fill) => fill?.value)).toEqual([2, 2]);
    expect(result.equipment.manualBonuses).toEqual({ atk: total - 4 });
    expect(result.equipment.randomRolls).toEqual([]);
    expect(result.diagnostics.map((d) => d.code)).toEqual(["undecomposable"]);
  });

  it("fixed socket exceeding residual stays fixed with a negative manual correction", () => {
    const result = run(entry({ atk: 1 }, [0, 0, 0, 10]), fixture({}, [recipe(10, [[4, 4]])]));
    expect(result.equipment.manualBonuses).toEqual({ atk: -3 });
    expect(result.diagnostics.map((d) => d.code)).toEqual(["undecomposable"]);
  });

  it("random below its value minimum is not an illegal roll; unmatched stats name the item and stat", () => {
    const result = run(entry({ atk: 2, hp: 17 }), fixture({ randomOptions: [{ attribute: "物攻", stat: "atk", ranges: [[5, 10]] }] }));
    expect(result.equipment.manualBonuses).toEqual({ hp: 17, atk: 2 });
    expect(result.equipment.randomRolls).toEqual([]);
    expect(result.diagnostics.map((d) => d.code)).toEqual(["unmatched-residual", "undecomposable"]);
    expect(result.diagnostics[0]).toMatchObject({ stat: "hp", message: expect.stringContaining("測試裝備") });
    expect(result.diagnostics[0].message).toContain("體力");
  });

  it("final engine validation falls back to fixed-only sockets and subtracts those before manual", () => {
    // Inconsistent option metadata creates duplicate attributes; the engine catches this.
    const data = fixture({ randomOptions: [
      { attribute: "重複", stat: "atk", ranges: [[1, 10]] },
      { attribute: "重複", stat: "def", ranges: [[1, 10]] },
    ] }, [recipe(10, [[2, 2]]), recipe(11)]);
    const result = run(entry({ atk: 10, def: 4 }, [0, 0, 10, 11]), data);
    expect(result.equipment.sockets).toEqual([{ recipeId: 10, stat: "atk", value: 2 }, null]);
    expect(result.equipment.randomRolls).toEqual([]);
    expect(result.equipment.manualBonuses).toEqual({ atk: 8, def: 4 });
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: "undecomposable", message: expect.stringContaining("invalid-random-roll") })]);
  });

  it("large intervals do not enumerate integers; deterministic and no input mutation", () => {
    const data = fixture({ randomOptions: [{ attribute: "物攻", stat: "atk", ranges: [[1, 1_000_000_000]] }] }, [recipe(10, [[1, 1_000_000_000]])]);
    const input = entry({ atk: 2_000_000_001 }, [0, 0, 10, 10]);
    const before = structuredClone({ data, input });
    const first = run(input, data);
    expect(first.equipment.sockets?.map((fill) => fill?.value)).toEqual([1_000_000_000, 1]);
    expect(first.equipment.randomRolls).toEqual([{ attribute: "物攻", value: 1_000_000_000 }]);
    expect(run(input, data)).toEqual(first);
    expect({ data, input }).toEqual(before);
  });

  it("exhaustive small-domain oracle: union feasibility, random priority, legality and conservation", () => {
    const data = fixture({ randomOptions: [{ attribute: "物攻", stat: "atk", ranges: [[2, 3], [6, 7]] }] }, [
      recipe(10, [[1, 2], [5, 6]]), recipe(11, [[2, 3], [7, 7]]),
    ]);
    for (let total = -2; total <= 24; total++) {
      const solutions = [1, 2, 5, 6].flatMap((a) => [2, 3, 7].flatMap((b) =>
        [0, 2, 3, 6, 7].filter((r) => a + b + r === total).map((r) => ({ a, b, r }))));
      const result = run(entry({ atk: total }, [0, 0, 10, 11]), data);
      expect(result.equipment.manualBonuses.atk ?? 0).toBe(solutions.length ? 0 : total - 3);
      if (solutions.length) {
        expect(result.diagnostics).toEqual([]);
        const random = Math.max(...solutions.map((s) => s.r));
        expect(result.equipment.randomRolls?.[0]?.value ?? 0).toBe(random);
        if (random > 0) expect(result.equipment.sockets?.[0]?.value).toBe(Math.max(...solutions.filter((s) => s.r === random).map((s) => s.a)));
      } else expect(result.diagnostics.some((d) => d.code === "undecomposable")).toBe(true);
    }
  });

  it("exhaustive no-random oracle: minimum spread with slot-order tie breaking across unions", () => {
    const data = fixture({}, [recipe(10, [[1, 3], [6, 7]]), recipe(11, [[2, 4], [8, 8]])]);
    for (let total = 0; total <= 17; total++) {
      const solutions = [1, 2, 3, 6, 7].flatMap((a) => [2, 3, 4, 8]
        .filter((b) => a + b === total).map((b) => [a, b]))
        .sort(([a, b], [c, d]) => (a * a + b * b) - (c * c + d * d) || c - a);
      const result = run(entry({ atk: total }, [0, 0, 10, 11]), data);
      expect(result.equipment.sockets?.map((fill) => fill?.value)).toEqual(solutions[0] ?? [1, 2]);
      expect(result.equipment.manualBonuses.atk ?? 0).toBe(solutions.length ? 0 : total - 3);
    }
  });
});

describe("decomposeEquipment — real DB importer samples", () => {
  let data: GameData;
  beforeAll(() => { data = getStatSimData(); });

  it.each(["止戰詩園-Lv190", "晨曦破空-Lv192"])("%s: every equipment entry is warning-free and conserves imported stats", (name) => {
    const sample = JSON.parse(readFileSync(`docs/plans/stat-sim-import-samples/${name}.json`, "utf8")) as {
      equipment: Record<EquipSlot, ImportEquipEntry | null>;
    };
    const decomposed: Partial<Record<EquipSlot, EquippedItem>> = {};
    for (const [slot, raw] of Object.entries(sample.equipment) as [EquipSlot, ImportEquipEntry | null][]) {
      if (!raw) continue;
      const aliases: Record<string, string> = { extra_def: "def", magic_def: "mdef", critical_hit: "critical" };
      const input = { ...raw, stats: Object.fromEntries(Object.entries(raw.stats).map(([key, value]) => [aliases[key] ?? key, value])) };
      const result = decomposeEquipment(input, slot, data);
      expect(result.diagnostics, `${name} ${slot} ${raw.id}`).toEqual([]);
      expect(result.equipment.manualBonuses).toEqual({});
      verify(input, result.equipment, data, slot);
      expect(decomposeEquipment(input, slot, data)).toEqual(result);
      decomposed[slot] = result.equipment;
    }
    expect(Object.keys(decomposed)).toHaveLength(name.startsWith("止戰") ? 9 : 10);
    const body = decomposed.body!;
    expect(body.itemId).toBe(50444);
    expect(body.sockets).toEqual(Array.from({ length: 2 }, () => ({ recipeId: 10641, stat: "def", value: 25 })));
    expect(body.randomRolls).toHaveLength(4);
    expect(data.itemsById[50444].randomCount?.[0]).toBe(5);
    expect(Object.fromEntries(body.randomRolls!.map((roll) => [roll.attribute, roll.value]))).toEqual(name.startsWith("止戰")
      ? { 體力: 2375, 真氣: 1563, 防禦: 411, 護勁: 355 }
      : { 體力: 2379, 真氣: 1163, 防禦: 471, 護勁: 408 });
    if (name.startsWith("晨曦")) {
      // 外功 = str, 根骨 = vit (not atk / str); README and actual sample agree.
      expect(decomposed.right!.enhancementLevel).toBe(17);
      expect(decomposed.right!.sockets).toEqual(Array.from({ length: 2 }, () => ({ recipeId: 11142, stat: "str", value: 9 })));
      expect(decomposed.right!.randomRolls).toContainEqual({ attribute: "外功", value: 6 });
      expect(decomposed.left!.sockets).toEqual([{ recipeId: 10992, stat: "str", value: 7 }]);
      expect(decomposed.left!.randomRolls).toEqual(expect.arrayContaining([{ attribute: "命中", value: 25 }, { attribute: "根骨", value: 5 }]));
      expect(decomposed.left!.randomRolls).toHaveLength(2);
      expect(decomposed.cap!.sockets?.map((fill) => fill?.value)).toEqual([6, 5]);
    }
  });
});
