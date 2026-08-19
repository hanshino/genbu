import { describe, it, expect } from "vitest";
import {
  getAchievementCategories,
  getAchievementsByCategory,
  searchAchievements,
  ACHIEVEMENT_SEARCH_LIMIT,
} from "../achievements";

describe("getAchievementCategories", () => {
  it("回傳 9 個大分類,依 sort_order 排序,首位為功名錄", () => {
    const cats = getAchievementCategories();
    expect(cats).toHaveLength(9);
    expect(cats[0].id).toBe(1);
    expect(cats[0].name).toBe("功名錄");
  });

  it("功名錄含 3 個子分類;成就點數(101)有 7 筆、共 70 點", () => {
    const cats = getAchievementCategories();
    const sub = cats[0].subCats;
    expect(sub.map((s) => s.id)).toEqual([101, 102, 103]);
    const points = sub.find((s) => s.id === 101)!;
    expect(points.count).toBe(7);
    expect(points.totalPoints).toBe(70);
  });
});

describe("getAchievementsByCategory", () => {
  it("功名錄(cat 1)共 51 筆,依子分類排序", () => {
    const rows = getAchievementsByCategory(1);
    expect(rows).toHaveLength(51);
    expect(rows[0].subCatId).toBe(101);
  });

  it("解碼欄位齊全:id 1 初有所成 = 5 點、貨幣獎勵(type 1, id 7, ×1)", () => {
    const rows = getAchievementsByCategory(1);
    const a = rows.find((r) => r.id === 1)!;
    expect(a.name).toBe("初有所成");
    expect(a.points).toBe(5);
    expect(a.rewardType).toBe(1);
    expect(a.rewardId).toBe(7);
    expect(a.rewardAmount).toBe(1);
  });

  it("type 5 獎勵 join magic 取得名稱(初窺門徑 → 物攻增加)", () => {
    // 初窺門徑在功名錄 > 奇功(sub_cat 102)
    const rows = getAchievementsByCategory(1);
    const a = rows.find((r) => r.name === "初窺門徑")!;
    expect(a.rewardType).toBe(5);
    expect(a.rewardName).toBe("物攻增加");
  });

  // v7.2.6.6 起功名錄整條成就鏈的 prereq 被清為 0,全庫僅剩期間成就 >
  // 無名之島(sub_cat 1001)的 30002/30004 還有前置關係。
  it("前置成就 self-join 取得名稱(無名島外也是諸般委託皆肯接 → 前置:忍村來客混成半個熟人)", () => {
    const rows = getAchievementsByCategory(101);
    const a = rows.find((r) => r.id === 30002)!;
    expect(a.prereqName).toBe("忍村來客混成半個熟人");
  });

  it("不存在的分類回傳空陣列", () => {
    expect(getAchievementsByCategory(99999)).toEqual([]);
  });
});

describe("searchAchievements", () => {
  it("跨分類搜尋名稱+描述並附分類名(關鍵字:銀兩 → 5 筆)", () => {
    const rows = searchAchievements("銀兩");
    expect(rows).toHaveLength(5);
    for (const r of rows) {
      expect(r.categoryName.length).toBeGreaterThan(0);
      expect(r.subCatName.length).toBeGreaterThan(0);
    }
  });

  it("結果 cap 在 ACHIEVEMENT_SEARCH_LIMIT(關鍵字:成)", () => {
    const rows = searchAchievements("成");
    expect(rows).toHaveLength(ACHIEVEMENT_SEARCH_LIMIT);
  });
});
