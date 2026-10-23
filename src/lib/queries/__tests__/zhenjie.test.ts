import { describe, it, expect } from "vitest";
import { getZhenjieBooks } from "../zhenjie";
import { ZHENJIE_BONUSES, zhenjieBonusValue } from "@/configs/zhenjie";
import { distinctLineDistribution, parseZhenjieStars } from "@/lib/zhenjie";

// 說明文字的星數與 ITEMRAND.INI 的強度範圍一一對應（2026-10 資料，70 本無例外）。
const STAR_RANGES: Record<number, [number, number]> = {
  1: [10, 40],
  2: [10, 70],
  3: [20, 90],
  4: [30, 120],
  5: [40, 140],
  6: [50, 170],
};

describe("getZhenjieBooks", () => {
  const books = getZhenjieBooks();

  it("returns all 70 books with stars parsed", () => {
    expect(books).toHaveLength(70);
    for (const b of books) expect(b.stars).toBeGreaterThanOrEqual(1);
  });

  it("star count matches strength range", () => {
    for (const b of books) {
      expect([b.strengthMin, b.strengthMax], `#${b.id}`).toEqual(STAR_RANGES[b.stars]);
    }
  });

  it("every book has the 8 bonus lines in seq order", () => {
    const tokens = ZHENJIE_BONUSES.map((d) => d.token);
    for (const b of books) expect(b.lineTokens, `#${b.id}`).toEqual(tokens);
  });

  it("links 翔龍真解 to its skill", () => {
    const book = books.find((b) => b.id === 32748);
    expect(book).toMatchObject({ stars: 6, skillId: 378, skillName: "翔龍", modCountMin: 2, modCountMax: 4 });
  });
});

describe("zhenjie formulas", () => {
  const [ratio, dmg, hit] = ZHENJIE_BONUSES;

  it("computes bonus values with floor and min 1", () => {
    expect(zhenjieBonusValue(50, ratio)).toBe(62);
    expect(zhenjieBonusValue(170, dmg)).toBe(5950);
    expect(zhenjieBonusValue(104, dmg)).toBe(3640);
    expect(zhenjieBonusValue(104, hit)).toBe(5);
    expect(zhenjieBonusValue(10, hit)).toBe(1);
  });

  it("parses stars from summary", () => {
    expect(parseZhenjieStars("說明\\n\\n真解效果：★★★")).toBe(3);
    expect(parseZhenjieStars("一般道具")).toBeNull();
  });

  it("distinct line distribution for 2..4 draws over 8 equal lines", () => {
    const dist = distinctLineDistribution(2, 4, 8, 125000);
    expect(dist[1]).toBeCloseTo((1 / 8 + 1 / 64 + 8 / 4096) / 3, 10);
    expect(dist[4]).toBeCloseTo(1680 / 4096 / 3, 10);
    expect(dist.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 10);
  });
});
