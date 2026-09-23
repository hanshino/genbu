import { describe, expect, it } from "vitest";
import { getHeroes } from "../heroes";
import { getHeroTokenSources } from "../mission-logic";

describe("getHeroTokenSources（英雄頁符令來源）", () => {
  it("英雄 1（小魚兒）有 2 個禮盒來源，含選項路徑", () => {
    const sources = getHeroTokenSources(1);
    expect(sources).toEqual([
      { kind: "box", id: 31445, name: "小魚兒符令", qty: 50, choicePath: "用50枚小花金幣試試看" },
      { kind: "box", id: 33001, name: "小魔星符令", qty: 3, choicePath: null },
    ]);
  });

  it("英雄 84（解無憂）來源包含 20週年同樂包", () => {
    const ids = getHeroTokenSources(84).map((s) => s.id);
    expect(ids).toEqual([33084, 33982]);
  });

  it("84 位英雄都有禮盒來源，合計 108 筆（is_gm=0）", () => {
    const all = getHeroes().flatMap((h) => getHeroTokenSources(h.id));
    expect(getHeroes().every((h) => getHeroTokenSources(h.id).length > 0)).toBe(true);
    expect(all.filter((s) => s.kind === "box")).toHaveLength(108);
  });

  // ponytail: 目前資料沒有任何 mission_rewards.hero_token（is_mission=1, is_gm=0），
  // 無法挑出「有任務來源的英雄」；資料更新出現後改成對特定英雄斷言。
  it("目前資料中沒有任務符令來源", () => {
    const all = getHeroes().flatMap((h) => getHeroTokenSources(h.id));
    expect(all.filter((s) => s.kind === "mission")).toHaveLength(0);
  });

  it("不存在的英雄回傳空陣列", () => {
    expect(getHeroTokenSources(999999)).toEqual([]);
  });
});
