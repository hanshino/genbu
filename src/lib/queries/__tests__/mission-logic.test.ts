import { describe, expect, it } from "vitest";
import { getItemBoxRewards, getMissionLogic } from "../mission-logic";
import { gameTextPlain } from "@/lib/format/game-text";

describe("getMissionLogic", () => {
  it("任務 801「如假似真」：明若蘭完成、魂回禮盒獎勵、熱水交付、流程 step 0–8", () => {
    const logic = getMissionLogic(801);

    expect(logic.completeNpcs).toContain("明若蘭");

    const rewardNames = logic.rewards.map((r) => r.resolved.itemName);
    expect(rewardNames).toContain("魂回禮盒");
    expect(logic.rewards.find((r) => r.resolved.itemName === "魂回禮盒")?.qty).toBe(1);

    const deliveryNames = logic.deliveries.map((r) => r.resolved.itemName);
    expect(deliveryNames).toContain("熱水");
    expect(logic.deliveries.find((r) => r.resolved.itemName === "熱水")?.qty).toBe(1);

    const steps = logic.flow.map((f) => f.step).filter((s) => s <= 8);
    for (let i = 0; i <= 8; i++) {
      expect(steps).toContain(i);
    }
  });

  it("任務 15026「辛蕊伴隨」：兩組條件，魅力 1800/4300，外功>=25，身法>=18，星雲劍法 Lv6，拒絕對話", () => {
    const logic = getMissionLogic(15026);

    expect(logic.requirementGroups).toHaveLength(2);

    const allConditions = logic.requirementGroups.flatMap((g) => g.conditions);
    const charismaValues = allConditions.filter((c) => c.kind === "charisma").map((c) => c.a1);
    expect(charismaValues).toContain(1800);
    expect(charismaValues).toContain(4300);

    expect(allConditions.some((c) => c.summary === "外功>=25")).toBe(true);
    expect(allConditions.some((c) => c.summary === "身法>=18")).toBe(true);

    const skillCond = allConditions.find((c) => c.kind === "skill");
    expect(skillCond?.skill).toEqual({ magicId: 112, level: 6, magicName: "星雲劍法" });

    // rejectText / flow.dialogue 保留 FONT 原文，比對看得到的文字
    expect(allConditions.some((c) => c.rejectText && gameTextPlain(c.rejectText) === "想為我分憂？！")).toBe(
      true,
    );

    const done = logic.flow.find((f) => f.step === 15);
    expect(done?.dialogue).toContain("<FONT");
    expect(gameTextPlain(done!.dialogue!)).toContain("（攸關性命，我當然再清楚不過啦！）");
    expect(gameTextPlain(done!.dialogue!)).not.toContain("<");
  });

  it("任務 17002「高手聘請-紅珊瑚」：家族總管完成，交付玄武珠/朱雀珠/白虎珠各×20、家族徽玉×2", () => {
    const logic = getMissionLogic(17002);

    expect(logic.completeNpcs).toContain("家族總管");

    const byName = new Map(logic.deliveries.map((d) => [d.resolved.itemName, d.qty]));
    expect(byName.get("玄武珠")).toBe(20);
    expect(byName.get("朱雀珠")).toBe(20);
    expect(byName.get("白虎珠")).toBe(20);
    expect(byName.get("家族徽玉")).toBe(2);
  });

  it("任務 18901「雲夢湖底」：迷宮調查使者完成，獎勵雲夢湖底寶箱×1 與 exp 18000", () => {
    const logic = getMissionLogic(18901);

    expect(logic.completeNpcs).toContain("迷宮調查使者");

    const item = logic.rewards.find((r) => r.resolved.itemName === "雲夢湖底寶箱");
    expect(item?.qty).toBe(1);

    const exp = logic.rewards.find((r) => r.type === "exp");
    expect(exp?.qty).toBe(18000);
  });

  it("排除 is_gm=1：任務 1 的 gm-only reset（msg 39026）不會出現在 accept/complete NPC 推導來源之外造成污染", () => {
    // 任務 1 的 accept/complete 只發生在 file_no=12（is_gm=0），
    // 若 is_gm 過濾失效，家族/其他 gm 專用訊息會混入 flow。
    const logic = getMissionLogic(1);
    expect(logic.completeNpcs.length).toBeGreaterThan(0);
    expect(logic.flow.every((f) => f.step >= 0)).toBe(true);
  });
});

describe("getItemBoxRewards", () => {
  it("道具 24221 魂回禮盒：一組開箱含初階新手禮盒×1、賞善輕功丹×5、急速便鞋限時 7200 分", () => {
    const grants = getItemBoxRewards(24221);
    expect(grants).toHaveLength(1);

    const byName = new Map(grants[0].rewards.map((r) => [r.resolved.itemName, r]));
    expect(byName.get("初階新手禮盒")?.qty).toBe(1);
    expect(byName.get("賞善輕功丹")?.qty).toBe(5);
    const shoes = byName.get("急速便鞋");
    expect(shoes?.type).toBe("timed_item");
    expect(shoes?.durationMin).toBe(7200);
  });

  it("道具 31067 新手成年禮盒：4 組擇一，各帶 choicePath", () => {
    const grants = getItemBoxRewards(31067);
    expect(grants).toHaveLength(4);
    for (const g of grants) {
      expect(g.choicePath).not.toBeNull();
    }
  });

  it("道具 31119 60神兵兌換券：多把武器擇一（>5 組）", () => {
    const grants = getItemBoxRewards(31119);
    expect(grants.length).toBeGreaterThan(5);
  });
});
