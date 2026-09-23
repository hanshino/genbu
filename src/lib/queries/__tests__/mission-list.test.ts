import { describe, expect, it } from "vitest";
import { getAllMissionListItems } from "../missions";

describe("getAllMissionListItems", () => {
  const all = getAllMissionListItems();
  const byId = new Map(all.map((m) => [m.id, m]));

  it("全部任務都在（沒有客戶端資料的也要出現）", () => {
    expect(all.length).toBe(1311);
    expect(all.filter((m) => m.acceptNpcs == null).length).toBeGreaterThan(0);
  });

  it("15026「辛蕊伴隨」：兩組條件都要 Lv25 → 最低等級 25、門派移花宮", () => {
    const m = byId.get(15026)!;
    expect(m.minLevel).toBe(25);
    expect(m.factions).toEqual(["移花宮"]);
    expect(m.acceptNpcs).toContain("辛蕊");
    expect(m.hasReward).toBe(true);
  });

  it("18901「雲夢湖底」：有獎勵、無等級需求", () => {
    const m = byId.get(18901)!;
    expect(m.hasReward).toBe(true);
    expect(m.minLevel).toBeUndefined();
  });

  it("801「如假似真」：接取 NPC 未記載，但有獎勵（只有 take_item 不算）", () => {
    const m = byId.get(801)!;
    expect(m.acceptNpcs ?? []).toEqual([]);
    expect(m.hasReward).toBe(true);
  });

  it("804 有 timer → timed；限時任務數量合理", () => {
    expect(byId.get(804)!.timed).toBe(true);
    expect(byId.get(801)!.timed).toBeUndefined();
    expect(all.filter((m) => m.timed).length).toBeGreaterThan(50);
  });

  it("門派只出現 op=2 summary 裡的六個門派", () => {
    const factions = new Set(all.flatMap((m) => m.factions ?? []));
    expect([...factions].sort()).toEqual(["天外天", "惡人谷", "曼陀羅", "火狐", "移花宮", "雪狼"].sort());
  });
});
