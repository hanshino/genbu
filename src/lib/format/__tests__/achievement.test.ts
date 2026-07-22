import { describe, it, expect } from "vitest";
import { formatReward } from "../achievement";

// reward_type 語意見 spec §2.1(已用真實資料實證)
describe("formatReward", () => {
  it("type 0 無獎勵 → null", () => {
    expect(
      formatReward({ rewardType: 0, rewardId: 0, rewardAmount: 0, rewardName: null }),
    ).toBeNull();
  });

  it("type 1 貨幣 → 佔位名稱 ×數量,無連結", () => {
    const r = formatReward({ rewardType: 1, rewardId: 7, rewardAmount: 10, rewardName: null });
    expect(r).toEqual({ label: "貨幣 #7 ×10" });
  });

  it("type 2 道具 → 名稱 ×數量 + /items 連結(實例:富可敵國 → 百萬官幣×50)", () => {
    const r = formatReward({
      rewardType: 2,
      rewardId: 24086,
      rewardAmount: 50,
      rewardName: "百萬官幣",
    });
    expect(r).toEqual({ label: "百萬官幣 ×50", href: "/items/24086" });
  });

  it("type 3 銀兩 → 千分位金額,無連結", () => {
    const r = formatReward({ rewardType: 3, rewardId: 1, rewardAmount: 500000, rewardName: null });
    expect(r).toEqual({ label: "銀兩 ×500,000" });
  });

  it("type 5 屬性加成 → magic 名稱 + /skills 連結(實例:初窺門徑 → 物攻增加)", () => {
    const r = formatReward({
      rewardType: 5,
      rewardId: 1183,
      rewardAmount: 1,
      rewardName: "物攻增加",
    });
    expect(r).toEqual({ label: "物攻增加", href: "/skills/1183" });
  });

  it("type 5 amount > 1 時附 ×數量(7 筆 reward_amount=2 的實例)", () => {
    const r = formatReward({
      rewardType: 5,
      rewardId: 1183,
      rewardAmount: 2,
      rewardName: "物攻增加",
    });
    expect(r).toEqual({ label: "物攻增加 ×2", href: "/skills/1183" });
  });

  it("join 不到名稱時 fallback 顯示 #id,不擲錯", () => {
    const r = formatReward({ rewardType: 2, rewardId: 99999, rewardAmount: 1, rewardName: null });
    expect(r).toEqual({ label: "#99999 ×1", href: "/items/99999" });
  });

  it("未知 reward_type 保底顯示,不擲錯", () => {
    const r = formatReward({ rewardType: 4, rewardId: 123, rewardAmount: 2, rewardName: null });
    expect(r).toEqual({ label: "獎勵 #4（#123 ×2）" });
  });
});
