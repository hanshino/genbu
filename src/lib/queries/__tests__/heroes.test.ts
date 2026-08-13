import { describe, expect, it } from "vitest";
import { getHeroById, getHeroCombinations, getHeroCombinationsForHero, getHeroes } from "../heroes";
import type { HeroCombination } from "@/lib/types/hero";

/** 掃過所有英雄收集組合，用來驗證 hero_connect 的整體資料契約。 */
function collectCombinations(): { all: HeroCombination[]; unique: Map<number, HeroCombination> } {
  const all: HeroCombination[] = [];
  const unique = new Map<number, HeroCombination>();
  for (const hero of getHeroes()) {
    for (const combo of getHeroCombinationsForHero(hero.id)) {
      all.push(combo);
      unique.set(combo.id, combo);
    }
  }
  return { all, unique };
}

describe("getHeroes", () => {
  it("回傳 84 位英雄且 id 唯一", () => {
    const heroes = getHeroes();
    expect(heroes).toHaveLength(84);
    expect(new Set(heroes.map((h) => h.id)).size).toBe(84);
  });

  it("依 group、id 排序", () => {
    const heroes = getHeroes();
    const sorted = [...heroes].sort((a, b) => a.groupId.localeCompare(b.groupId) || a.id - b.id);
    expect(heroes.map((h) => h.id)).toEqual(sorted.map((h) => h.id));
  });

  it("combinationCount 總和 = hero_connect 的 192 個成員參照", () => {
    const total = getHeroes().reduce((sum, h) => sum + h.combinationCount, 0);
    expect(total).toBe(192);
  });

  it("英雄 1 出現在 4 組組合中", () => {
    const hero = getHeroes().find((h) => h.id === 1)!;
    expect(hero.name).toBe("鬼靈精怪。小魔星");
    expect(hero.groupId).toBe("1");
    expect(hero.starUp).toBe(100);
    expect(hero.combinationCount).toBe(4);
  });
});

describe("getHeroById", () => {
  it("回傳英雄 1 的 raw stats 與 help", () => {
    const hero = getHeroById(1)!;
    expect(hero).not.toBeNull();
    expect(hero.name).toBe("鬼靈精怪。小魔星");
    expect(hero.stats).toEqual({
      hp: 15600,
      mp: 5980,
      atk: 1250,
      matk: 625,
      def: 936,
      mdef: 936,
      hit: 180,
      dodge: 300,
      critical: 8,
      uncannyDodge: 20,
    });
    expect(hero.help.length).toBeGreaterThan(0);
  });

  it("不存在的 id 回傳 null", () => {
    expect(getHeroById(99999)).toBeNull();
  });
});

describe("getHeroCombinationsForHero", () => {
  it("英雄 1 的 4 組組合皆包含自己，且依 id 排序", () => {
    const combos = getHeroCombinationsForHero(1);
    expect(combos.map((c) => c.id)).toEqual([1, 12, 24, 46]);
    for (const combo of combos) {
      expect(combo.members.some((m) => m.heroId === 1)).toBe(true);
    }
  });

  it("保留 slot 順序（組合 12 的 hero1=13、hero2=1）", () => {
    const combo = getHeroCombinationsForHero(1).find((c) => c.id === 12)!;
    expect(combo.name).toBe("酸酸甜甜");
    expect(combo.members.map((m) => [m.slot, m.heroId])).toEqual([
      [1, 13],
      [2, 1],
    ]);
  });

  it("缺少的加成保留 null，不補 0", () => {
    const combo = getHeroCombinationsForHero(1).find((c) => c.id === 1)!;
    expect(combo.bonus).toEqual({
      hp: 4170,
      mp: 810,
      atk: 155,
      matk: 82,
      def: null,
      mdef: null,
      dodge: 65,
      hit: null,
    });
  });

  it("沒有組合的英雄回傳空陣列", () => {
    // 英雄 40（塞外雙生。木子兄弟）未出現在任何 hero_connect 槽位。
    expect(getHeroCombinationsForHero(40)).toEqual([]);
    expect(getHeroById(40)!.combinationCount).toBe(0);
  });
});

describe("hero_connect 資料契約", () => {
  it("共 75 組唯一組合、192 個成員參照", () => {
    const { all, unique } = collectCombinations();
    expect(unique.size).toBe(75);
    expect(all.length).toBe(192);
  });

  it("每位成員都能解析出 hero 名稱，沒有 fallback 佔位", () => {
    for (const combo of collectCombinations().unique.values()) {
      for (const member of combo.members) {
        expect(member.name).not.toMatch(/^英雄 #/);
        expect(member.name.length).toBeGreaterThan(0);
      }
    }
  });

  it("同一組合內沒有重複英雄，slot 遞增", () => {
    for (const combo of collectCombinations().unique.values()) {
      const ids = combo.members.map((m) => m.heroId);
      expect(new Set(ids).size).toBe(ids.length);
      const slots = combo.members.map((m) => m.slot);
      expect(slots).toEqual([...slots].sort((a, b) => a - b));
    }
  });

  it("members 長度與 hero_count 一致", () => {
    for (const combo of collectCombinations().unique.values()) {
      expect(combo.members).toHaveLength(combo.heroCount);
    }
  });

  it("組合人數分布為 2:48、3:15、4:9、5:3", () => {
    const dist = new Map<number, number>();
    for (const combo of collectCombinations().unique.values()) {
      dist.set(combo.heroCount, (dist.get(combo.heroCount) ?? 0) + 1);
    }
    expect(Object.fromEntries([...dist.entries()].sort((a, b) => a[0] - b[0]))).toEqual({
      2: 48,
      3: 15,
      4: 9,
      5: 3,
    });
  });
});

describe("getHeroCombinations", () => {
  it("回傳全部 75 組唯一組合，依 id 排序", () => {
    const combos = getHeroCombinations();
    expect(combos).toHaveLength(75);
    expect(new Set(combos.map((c) => c.id)).size).toBe(75);
    expect(combos.map((c) => c.id)).toEqual([...combos.map((c) => c.id)].sort((a, b) => a - b));
  });

  it("與逐一英雄反查的結果等價（含只由部分成員完成的組合）", () => {
    const all = getHeroCombinations();
    const perHero = collectCombinations().unique;
    expect(all.map((c) => c.id).sort((a, b) => a - b)).toEqual(
      [...perHero.keys()].sort((a, b) => a - b),
    );
    for (const combo of all) {
      expect(combo).toEqual(perHero.get(combo.id));
    }
  });

  it("沿用相同 row mapping：members 對應 slot 順序、名稱可解析", () => {
    const combo = getHeroCombinations().find((c) => c.id === 12)!;
    expect(combo.name).toBe("酸酸甜甜");
    expect(combo.members.map((m) => [m.slot, m.heroId])).toEqual([
      [1, 13],
      [2, 1],
    ]);
    expect(combo.members).toHaveLength(combo.heroCount);
  });

  it("nullable 加成保留 null，不補 0", () => {
    const combo = getHeroCombinations().find((c) => c.id === 1)!;
    expect(combo.bonus).toEqual({
      hp: 4170,
      mp: 810,
      atk: 155,
      matk: 82,
      def: null,
      mdef: null,
      dodge: 65,
      hit: null,
    });
    // 全量結果中確實存在 null 加成，optimizer 必須自行以 0 計算
    const withNull = getHeroCombinations().filter((c) =>
      Object.values(c.bonus).some((v) => v === null),
    );
    expect(withNull.length).toBeGreaterThan(0);
  });

  it("結果可直接供 optimizer 使用：members 非空且 heroId 都在 hero 表中", () => {
    const heroIds = new Set(getHeroes().map((h) => h.id));
    for (const combo of getHeroCombinations()) {
      expect(combo.members.length).toBeGreaterThan(0);
      for (const member of combo.members) {
        expect(heroIds.has(member.heroId)).toBe(true);
      }
    }
  });
});
