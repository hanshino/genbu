import { describe, expect, it } from "vitest";
import {
  getBoxItemIds,
  getBoxesContainingItem,
  getItemBoxContents,
  getMissionsRewardingItem,
  getMissionsTakingItem,
} from "../mission-logic";
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
});
