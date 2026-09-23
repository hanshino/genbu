import { describe, it, expect } from "vitest";
import { getMissionLogic, getNpcImagesByName } from "../mission-logic";
import { getMissionDialogue } from "../messages";

describe("任務 NPC 立繪（依名字對 npc）", () => {
  it("801 交付 NPC 明若蘭有立繪", () => {
    const logic = getMissionLogic(801);
    expect(logic.completeNpcs).toContain("明若蘭");
    expect(logic.npcImages["明若蘭"]?.url).toMatch(/^https:\/\//);
  });

  it("17002 家族總管（同名多筆 npc）取到有圖的一筆，流程 NPC 也都有 key", () => {
    const logic = getMissionLogic(17002);
    expect(logic.npcImages["家族總管"]?.url).toMatch(/^https:\/\//);
    for (const f of logic.flow) for (const n of f.npcs) expect(n in logic.npcImages).toBe(true);
  });

  it("查無的名字回傳 null，不會丟錯", () => {
    const map = getNpcImagesByName(["明若蘭", "不存在的NPC名字__x", "不存在的NPC名字__x"]);
    expect(map.get("不存在的NPC名字__x")).toBeNull();
    expect(map.get("明若蘭")).not.toBeNull();
    expect(getNpcImagesByName([]).size).toBe(0);
  });

  it("相關對話的說話者帶立繪；對不到 npc 的（陸奕擎）與系統訊息為 null", () => {
    const entries = getMissionDialogue(801).flatMap((g) => g.entries);
    expect(entries.find((e) => e.speaker === "陸天灝")?.speakerImage?.url).toMatch(/^https:\/\//);
    expect(entries.find((e) => e.speaker === "陸奕擎")?.speakerImage).toBeNull();
    for (const e of entries) if (!e.speaker) expect(e.speakerImage).toBeNull();
  });
});
