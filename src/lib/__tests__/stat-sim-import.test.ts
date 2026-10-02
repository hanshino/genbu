// @vitest-environment node
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { buildCompareRows } from "@/components/stat-sim/import-compare";
import { getStatSimData } from "../queries/stat-sim";
import { createDefaultCharacter, parseCharacter } from "../stat-character";
import { computePanel } from "../stat-sim";
import { assembleImport } from "../stat-sim-import";
import { decodeImport } from "../stat-sim-import-codec";
import { EQUIP_SLOTS, type GameData, type PassiveDef } from "../types/stat-sim";
import { ImportError, type ImportPayloadV1 } from "../types/stat-sim-import";

function payload(): ImportPayloadV1 {
  const character = createDefaultCharacter();
  return {
    v: 1, app: "proto", at: "", name: "測試", sect: 2, level: 1,
    bare: character.attributes, remainingPoints: 6,
    equipment: Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, null])) as ImportPayloadV1["equipment"],
    skills: {},
  };
}
const emptyData: GameData = { itemsById: {}, enhancementsByPath: {}, passives: [], meridianIds: [] };

describe("assembleImport", () => {
  let data: GameData;
  beforeAll(() => { data = getStatSimData(); });

  it.each([
    ["止戰詩園-Lv190", { str: 79, pow: 11, vit: 1, agi: 186, dex: 31, wis: 40 }, null],
    ["晨曦破空-Lv192", { str: 200, pow: 1, vit: 61, agi: 8, dex: 93, wis: 1 }, "855.3"],
  ] as const)("實機樣本 %s：保留裸六圍，計算轉生與含裝六圍", async (name, expected, meridianPlan) => {
    const raw = await decodeImport(readFileSync(`docs/plans/stat-sim-import-samples/${name}.txt`, "utf8"));
    const before = structuredClone(raw);
    const { character, renamed } = assembleImport(raw, data, { id: name }, []);
    expect(character.attributes).toEqual(raw.bare);
    expect(character.rebirthPoints).toBe(140);
    expect(character).not.toHaveProperty("rebirthLevels");
    expect(character.meridianPlan).toBe(meridianPlan);
    expect(character.manual).toEqual({ hero: {}, formation: {} });
    expect(parseCharacter(character).ok).toBe(true);
    expect(renamed).toBe(false);
    if (name === "晨曦破空-Lv192") expect(character.passiveLevels[1151]).toBe(1);
    const result = computePanel(character, data);
    const actual = Object.fromEntries(Object.entries(result.attributes).map(([key, value]) => [key, value.value]));
    expect(actual).toEqual(expected);
    expect(actual).toEqual(raw.panel?.attributes);
    expect(raw).toEqual(before);
  });

  it.each([
    [[], "測試", false],
    [["測試"], "測試（匯入）", true],
    [["測試", "測試（匯入）"], "測試（匯入 2）", true],
    [["測試", "測試（匯入）", "測試（匯入 2）"], "測試（匯入 3）", true],
  ] as const)("名稱撞名時選第一個可用名稱 %#", (names, expected, renamed) => {
    const result = assembleImport(payload(), emptyData, { id: "test" }, [...names]);
    expect(result.character.name).toBe(expected);
    expect(result.renamed).toBe(renamed);
  });

  it.each([1, 256, 1024, 999])("拒絕不支援門派 %s", (sect) => {
    const assemble = () => assembleImport({ ...payload(), sect }, emptyData, { id: "test" }, []);
    expect(assemble).toThrow(ImportError);
    expect(assemble).toThrow(sect === 999 ? "v1 尚未支援此門派：999" : "v1 尚未支援轉職前門派");
  });

  it("無法推算轉生時填 0 並附原因", () => {
    const result = assembleImport({ ...payload(), remainingPoints: 1000 }, emptyData, { id: "test" }, []);
    expect(result.character.rebirthPoints).toBe(0);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "rebirth-inference", severity: "warning", message: expect.stringContaining("轉生點數總和須為"),
    }));
  });

  it("只保留已知被動，截上限；副門派依技能數、再依固定順序選兩個", () => {
    const passive = (id: number, clan: string): PassiveDef => ({
      id, name: `技能${id}`, clan, group: "sub", maxLevel: 3,
      learnLevels: [0, 1, 1, 1], iconUrl: null, cumulative: [{}, {}, {}, {}],
    });
    const raw = payload();
    raw.skills = { 1: 10, 2: 1, 3: 1, 4: 1, 5: 0, 999: 10 };
    const result = assembleImport(raw, { ...emptyData, passives: [
      passive(1, "CLASS_MAGIC"), passive(2, "CLASS_MAGIC"), passive(3, "CLASS_GOD"),
      passive(4, "CLASS_SHAULIN"), passive(5, "CLASS_ISLE"),
    ] }, { id: "test" }, []);
    expect(result.character.passiveLevels).toEqual({ 1: 3, 2: 1, 3: 1, 4: 1, 5: 0 });
    expect(result.character.subSects).toEqual(["CLASS_MAGIC", "CLASS_GOD"]);
    expect(result.diagnostics).toContainEqual({
      code: "passive-clamped", severity: "info", message: "被動 技能1 Lv10 超過上限，已改為 Lv3",
    });
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "too-many-sub-sects", severity: "warning" }));
  });

  it("收集裝備拆解 diagnostics", () => {
    const raw = payload();
    raw.equipment.cap = { id: 999999, plus: 1, inlays: [0, 0, 0, 0], stats: { str: 5 } };
    const result = assembleImport(raw, emptyData, { id: "test" }, []);
    expect(result.character.equipment.cap?.manualBonuses).toEqual({ str: 5 });
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "missing-item", slot: "cap" }));
    expect(parseCharacter(result.character).ok).toBe(true);
  });
});

describe("buildCompareRows", () => {
  it("只列匯入提供的欄位，保留 null、繁體中文 labels 與差值原因", () => {
    const result = computePanel(createDefaultCharacter(), emptyData);
    result.stats.atk.value = null;
    result.stats.atk.estimateReasons = ["v1 未支援遠程物攻"];
    const rows = buildCompareRows({ attributes: { str: 11, pow: 1 }, stats: {
      hp: 999, atk: 100, hit: 99, weight_cap: 99999, attack_speed: 99,
    } }, result, ["BOW"]);
    expect(rows.map((row) => row.key)).toEqual(["str", "pow", "hp", "atk", "hit", "attack_speed", "weight_cap"]);
    expect(rows[0]).toMatchObject({ label: "外功", group: "六圍", reason: "可能有屬性丹藥" });
    expect(rows[1].reason).toBeUndefined();
    expect(rows.find((row) => row.key === "atk")).toMatchObject({
      sim: null, reason: "英雄／陣法、符類藥水或經脈；遠程物攻公式未定",
    });
    expect(rows.find((row) => row.key === "attack_speed")?.reason).toBe("攻速換算未解");
    expect(rows.find((row) => row.key === "weight_cap")?.reason).toBe("已知誤差，生效中的藥水也會增加");
    expect(buildCompareRows({}, result)).toEqual([]);
  });
});
