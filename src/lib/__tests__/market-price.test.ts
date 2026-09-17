import { describe, it, expect } from "vitest";
import type { PriceReport } from "@/lib/queries/market-prices";
import {
  formatAmount,
  formatReference,
  formatSilver,
  median,
  referencePrice,
  relativeTime,
  toSilver,
} from "@/lib/market-price";

const NOW = 1_800_000_000_000; // 固定時間，30 天窗口的測試才不會隨時鐘漂移
const NOW_SEC = NOW / 1000;
const DAY = 86_400;

function report(overrides: Partial<PriceReport>): PriceReport {
  return {
    id: 1,
    itemId: 10,
    server: "fish",
    currency: "silver",
    amount: 1000,
    nickname: "英雄",
    tag: "a1b2c",
    netVotes: 0,
    myVote: 0,
    createdAt: NOW_SEC - DAY,
    ...overrides,
  };
}

describe("toSilver", () => {
  it("官幣照遊戲內固定匯率換算", () => {
    expect(toSilver(18, "official", null)).toBe(18_000_000);
  });

  it("台幣沒設匯率時無法比較，回 null 而不是 0", () => {
    expect(toSilver(600, "twd", null)).toBeNull();
    expect(toSilver(600, "twd", 0)).toBeNull();
    expect(toSilver(600, "twd", 25_000)).toBe(15_000_000);
  });
});

describe("median", () => {
  it("奇數取中間，偶數取中間兩筆平均", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("沒有資料回 null", () => {
    expect(median([])).toBeNull();
  });
});

describe("referencePrice", () => {
  const reports: PriceReport[] = [
    report({ id: 1, amount: 1000 }),
    report({ id: 2, amount: 3000 }),
    report({ id: 3, amount: 2000 }),
    report({ id: 4, amount: 999_999, server: "flower" }), // 別台不算
    report({ id: 5, amount: 999_999, createdAt: NOW_SEC - 31 * DAY }), // 太舊不算
    report({ id: 6, amount: 999_999, netVotes: -1 }), // 有爭議不算
  ];

  it("只取當前伺服器、近 30 天、認同數不為負的回報中位數", () => {
    expect(referencePrice(reports, "fish", null, NOW)).toEqual({
      silver: 2000,
      count: 3,
      cash: 0,
    });
  });

  it("沒設匯率時台幣排除在外並計數，不推估", () => {
    const withCash = [...reports, report({ id: 7, currency: "twd", amount: 600 })];
    expect(referencePrice(withCash, "fish", null, NOW)).toEqual({
      silver: 2000,
      count: 3,
      cash: 1,
    });
  });

  it("設了匯率之後台幣一起算進中位數", () => {
    const withCash = [...reports, report({ id: 7, currency: "twd", amount: 2 })];
    // 1 台幣 = 2000 銀兩 → 4000，序列 [1000, 2000, 3000, 4000] 中位數 2500
    expect(referencePrice(withCash, "fish", 2000, NOW)).toEqual({
      silver: 2500,
      count: 4,
      cash: 1,
    });
  });

  it("完全沒有可用回報時參考價為 null", () => {
    expect(referencePrice([], "fish", null, NOW).silver).toBeNull();
  });
});

describe("formatSilver", () => {
  it("照台灣玩家習慣切萬與億", () => {
    expect(formatSilver(8_500)).toEqual({ value: "8,500", unit: "銀兩" });
    expect(formatSilver(18_500_000)).toEqual({ value: "1,850", unit: "萬銀兩" });
    expect(formatSilver(250_000_000)).toEqual({ value: "2.5", unit: "億銀兩" });
  });
});

describe("formatReference", () => {
  it("台幣未設匯率時顯示破折號，絕不推估", () => {
    expect(formatReference(18_500_000, "twd", null)).toEqual({ value: "—", unit: "台幣" });
  });

  it("設了匯率才換算台幣", () => {
    expect(formatReference(18_500_000, "twd", 25_000)).toEqual({ value: "740", unit: "台幣" });
  });

  it("官幣走固定匯率", () => {
    expect(formatReference(18_500_000, "official", null)).toEqual({ value: "18.5", unit: "官幣" });
  });

  it("沒有參考價時各幣別都是破折號", () => {
    expect(formatReference(null, "silver", null).value).toBe("—");
  });
});

describe("formatAmount", () => {
  it("單筆回報照原本填的幣別顯示，不換算", () => {
    expect(formatAmount(600, "twd")).toEqual({ value: "600", unit: "台幣" });
    expect(formatAmount(18, "official")).toEqual({ value: "18", unit: "官幣" });
    expect(formatAmount(18_500_000, "silver")).toEqual({ value: "1,850", unit: "萬銀兩" });
  });
});

describe("relativeTime", () => {
  it("一分鐘內算剛剛", () => {
    expect(relativeTime(NOW_SEC - 10, NOW)).toBe("剛剛");
  });

  it("時鐘超前的回報不會顯示成未來", () => {
    expect(relativeTime(NOW_SEC + 3 * 3600, NOW)).toBe("剛剛");
  });

  it("依時距選用天/小時/分鐘", () => {
    expect(relativeTime(NOW_SEC - 3 * 3600, NOW)).toContain("小時");
    expect(relativeTime(NOW_SEC - 2 * DAY, NOW)).toContain("天");
  });
});
