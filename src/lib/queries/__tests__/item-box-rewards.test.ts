import { describe, expect, it } from "vitest";
import {
  getBoxItemIds,
  getBoxesContainingItem,
  getItemBoxContents,
  getMissionsRewardingItem,
  getMissionsTakingItem,
  getNpcDialogueRewardsForItem,
  getNpcDialogueTakesForItem,
} from "../mission-logic";
import { getNpcDetail } from "../npcs";
import type { ItemBoxOption } from "@/lib/types/mission-logic";

const names = (o: ItemBoxOption) => o.rewards.map((r) => r.resolved.itemName);

describe("道具頁：禮盒內容與任務反查", () => {
  it("24221 新手禮盒：單一結果，含初階新手禮盒×1（可再展開）、賞善輕功丹×5、急速便鞋限時 5 天", () => {
    const options = getItemBoxContents(24221);
    expect(options).toHaveLength(1);
    const [opt] = options;

    const inner = opt.rewards.find((r) => r.resolved.itemName === "初階新手禮盒");
    expect(inner?.qty).toBe(1);
    expect(inner?.contents?.length).toBeGreaterThan(0);

    expect(opt.rewards.find((r) => r.resolved.itemName === "賞善輕功丹")?.qty).toBe(5);

    const shoes = opt.rewards.find((r) => r.resolved.itemName === "急速便鞋");
    expect(shoes?.type).toBe("timed_item");
    expect(shoes?.durationMin).toBe(5 * 1440);
  });

  it("31067 新手成年禮盒：四個種族選項", () => {
    const options = getItemBoxContents(31067);
    expect(options.map((o) => o.choicePath).sort()).toEqual(["曼陀羅", "火狐族", "雪狼", "麒麟族"].sort());
    for (const o of options) expect(o.rewards.length).toBeGreaterThan(0);
  });

  it("31119 60神兵兌換券：十餘種兵器擇一，每個選項一件", () => {
    const options = getItemBoxContents(31119);
    expect(options.length).toBeGreaterThanOrEqual(10);
    expect(options.every((o) => o.rewards.length === 1 && o.choicePath)).toBe(true);
    expect(options.some((o) => names(o).includes("天罡刀"))).toBe(true);
  });

  it("同一選項內重複給同一道具會加總（30170 給 6 次小花千金兌券×1）", () => {
    const [opt] = getItemBoxContents(30170);
    expect(opt.rewards.find((r) => r.refId === 30171)?.qty).toBe(6);
  });

  it("巢狀深度上限：maxDepth=1 不展開", () => {
    const [opt] = getItemBoxContents(24221, 1);
    expect(opt.rewards.every((r) => r.contents === null)).toBe(true);
  });

  it("getBoxItemIds：只回傳本身是禮盒的 id", () => {
    expect([...getBoxItemIds([24221, 31054, 28154, 31067])].sort()).toEqual([24221, 31054, 31067]);
    expect(getBoxItemIds([]).size).toBe(0);
  });

  it("初階新手禮盒 31054 可從 24221 取得，附 icon 欄位", () => {
    const boxes = getBoxesContainingItem(31054);
    const box = boxes.find((b) => b.boxItemId === 24221);
    expect(box?.qty).toBe(1);
    expect(box).toHaveProperty("boxIcon");
  });

  it("24221 是任務 801 的獎勵", () => {
    expect(getMissionsRewardingItem(24221)).toContainEqual(
      expect.objectContaining({ missionId: 801, qty: 1, durationMin: null }),
    );
  });

  it("玄武珠 28336 會被任務 17002 收走 ×20", () => {
    expect(getMissionsTakingItem(28336)).toContainEqual(expect.objectContaining({ missionId: 17002, qty: 20 }));
  });

  it("三生石 28581：擲杯聖者的非任務對話獎勵去重，無詳情頁時不連結", () => {
    expect(getNpcDialogueRewardsForItem(28581)).toEqual([
      { npcName: "擲杯聖者", npcId: null, qty: 1, durationMin: null },
    ]);
  });

  it("百魅丹 24085：保留不同數量的對話獎勵", () => {
    expect(getNpcDialogueRewardsForItem(24085).map((r) => r.qty)).toEqual([1, 2]);
  });

  it("掃地僧的對話獎勵使用可解析的 NPC 詳情頁 id", () => {
    const [source] = getNpcDialogueRewardsForItem(28954);
    expect(source.npcName).toBe("掃地僧");
    expect(source.npcId).toBe(7060);
    expect(getNpcDetail(source.npcId!)?.name).toBe(source.npcName);
  });

  it("天工閣弟子對話中收走 27068 ×50，重複分支只列一次", () => {
    expect(getNpcDialogueTakesForItem(27068)).toEqual([
      { npcName: "天工閣弟子", npcId: 7897, qty: 50, durationMin: null },
    ]);
  });

  it("未收錄 NPC 名稱的收走紀錄仍保留", () => {
    expect(getNpcDialogueTakesForItem(33557)).toEqual([
      { npcName: null, npcId: null, qty: 10, durationMin: null },
    ]);
  });

  it("不存在的道具沒有 NPC 對話來源或用途", () => {
    expect(getNpcDialogueRewardsForItem(999999999)).toEqual([]);
    expect(getNpcDialogueTakesForItem(999999999)).toEqual([]);
  });
});
