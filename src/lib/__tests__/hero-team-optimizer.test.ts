import { describe, expect, it } from "vitest";
import {
  HERO_BONUS_KEYS,
  optimizeHeroTeams,
  pushBoundedTop,
  suggestHeroAdditions,
  type BoundedTopEntry,
  type HeroBonusKey,
  type HeroTeamResult,
} from "../hero-team-optimizer";
import { getHeroCombinations, getHeroes } from "@/lib/queries/heroes";
import type { HeroCombination, HeroSummary } from "@/lib/types/hero";

function hero(id: number): HeroSummary {
  return { id, groupId: "1", name: `英雄${id}`, starUp: 0, combinationCount: 0 };
}

function heroes(...ids: number[]): HeroSummary[] {
  return ids.map(hero);
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** 預設八項皆為 null，只覆寫指定欄位，模擬 hero_connect 的 nullable 加成。 */
function combo(
  id: number,
  memberIds: number[],
  bonus: Partial<Record<HeroBonusKey, number>> = {},
): HeroCombination {
  return {
    id,
    name: `組合${id}`,
    help: "",
    heroCount: memberIds.length,
    members: memberIds.map((heroId, i) => ({ slot: i + 1, heroId, name: `英雄${heroId}` })),
    bonus: {
      hp: bonus.hp ?? null,
      mp: bonus.mp ?? null,
      atk: bonus.atk ?? null,
      matk: bonus.matk ?? null,
      def: bonus.def ?? null,
      mdef: bonus.mdef ?? null,
      dodge: bonus.dodge ?? null,
      hit: bonus.hit ?? null,
    },
  };
}

function ids(results: HeroTeamResult[]): number[][] {
  return results.map((r) => r.companionIds);
}

describe("optimizeHeroTeams 輸入守則", () => {
  const roster = heroes(1, 2, 3);
  const combos = [combo(1, [1, 2], { atk: 10 })];

  it("主英雄不存在時回傳空結果", () => {
    expect(
      optimizeHeroTeams({
        heroes: roster,
        combinations: combos,
        mainHeroId: 99,
        slots: 1,
        target: "atk",
      }),
    ).toEqual([]);
  });

  it("slots 不在 1–4 時回傳空結果", () => {
    for (const slots of [0, 5, 1.5, -1]) {
      expect(
        optimizeHeroTeams({
          heroes: roster,
          combinations: combos,
          mainHeroId: 1,
          slots: slots as 1,
          target: "atk",
        }),
      ).toEqual([]);
    }
  });

  it("可用人數不足以組成完整隊伍時回傳空結果", () => {
    expect(
      optimizeHeroTeams({
        heroes: roster,
        combinations: combos,
        mainHeroId: 1,
        slots: 4,
        target: "atk",
      }),
    ).toEqual([]);
    expect(
      optimizeHeroTeams({
        heroes: roster,
        combinations: combos,
        mainHeroId: 1,
        slots: 2,
        target: "atk",
        availableHeroIds: [2],
      }),
    ).toEqual([]);
  });
});

describe("optimizeHeroTeams 隊伍組成", () => {
  it("主英雄固定，companions 恰好 slots 位且不含主英雄", () => {
    const results = optimizeHeroTeams({
      heroes: heroes(1, 2, 3, 4),
      combinations: [combo(1, [1, 2], { atk: 10 }), combo(2, [1, 3], { atk: 10 })],
      mainHeroId: 1,
      slots: 2,
      target: "atk",
    });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.mainHeroId).toBe(1);
      expect(r.companionIds).toHaveLength(2);
      expect(r.companionIds).not.toContain(1);
      expect([...r.companionIds].sort((a, b) => a - b)).toEqual(r.companionIds);
    }
  });

  it("只有全員在隊伍才觸發，subset 不算", () => {
    const roster = heroes(1, 2, 3);
    const combos = [combo(1, [1, 2, 3], { atk: 100 })];

    // slots=1：隊伍只有 {1,2} 或 {1,3}，三人組合不成立 → 無 triggered link → 無結果
    expect(
      optimizeHeroTeams({
        heroes: roster,
        combinations: combos,
        mainHeroId: 1,
        slots: 1,
        target: "atk",
      }),
    ).toEqual([]);

    const full = optimizeHeroTeams({
      heroes: roster,
      combinations: combos,
      mainHeroId: 1,
      slots: 2,
      target: "atk",
    });
    expect(full).toHaveLength(1);
    expect(full[0].companionIds).toEqual([2, 3]);
    expect(full[0].targetScore).toBe(100);
  });

  it("零 triggered link 的合法隊伍不列入結果", () => {
    expect(
      optimizeHeroTeams({
        heroes: heroes(1, 2, 3),
        combinations: [combo(1, [2, 3, 4], { atk: 50 })],
        mainHeroId: 1,
        slots: 1,
        target: "atk",
      }),
    ).toEqual([]);
  });

  it("companions-only 連結會計入，並與主英雄連結分組", () => {
    const results = optimizeHeroTeams({
      heroes: heroes(1, 2, 3),
      combinations: [combo(1, [1, 2], { atk: 10 }), combo(7, [2, 3], { atk: 50 })],
      mainHeroId: 1,
      slots: 2,
      target: "atk",
    });
    expect(results).toHaveLength(1);
    const [top] = results;
    expect(top.companionIds).toEqual([2, 3]);
    expect(top.mainHeroLinks.map((c) => c.id)).toEqual([1]);
    expect(top.companionLinks.map((c) => c.id)).toEqual([7]);
    expect(top.targetScore).toBe(60);
  });

  it("最佳解可能完全由 companions 完成，candidate pool 不得漏掉", () => {
    // 主英雄 1 只與 2 有連結（atk 10）；3+4 的 companions-only 連結才是最佳解。
    const results = optimizeHeroTeams({
      heroes: heroes(1, 2, 3, 4),
      combinations: [combo(1, [1, 2], { atk: 10 }), combo(2, [3, 4], { atk: 900 })],
      mainHeroId: 1,
      slots: 2,
      target: "atk",
    });
    expect(results[0].companionIds).toEqual([3, 4]);
    expect(results[0].mainHeroLinks).toEqual([]);
    expect(results[0].companionLinks.map((c) => c.id)).toEqual([2]);
    expect(results[0].targetScore).toBe(900);
  });

  it("triggered links 依 hero_connect.id 遞增", () => {
    const results = optimizeHeroTeams({
      heroes: heroes(1, 2, 3),
      combinations: [combo(9, [1, 3], { atk: 1 }), combo(4, [1, 2], { atk: 1 })],
      mainHeroId: 1,
      slots: 2,
      target: "atk",
    });
    expect(results[0].mainHeroLinks.map((c) => c.id)).toEqual([4, 9]);
  });
});

describe("optimizeHeroTeams 可用英雄限制", () => {
  const roster = heroes(1, 2, 3, 4);
  const combos = [combo(1, [1, 2], { atk: 10 }), combo(2, [1, 4], { atk: 999 })];

  it("省略 availableHeroIds 代表全部可用", () => {
    const results = optimizeHeroTeams({
      heroes: roster,
      combinations: combos,
      mainHeroId: 1,
      slots: 1,
      target: "atk",
    });
    expect(results[0].companionIds).toEqual([4]);
    expect(results[0].targetScore).toBe(999);
  });

  it("提供 availableHeroIds 時 companions 只能來自該集合", () => {
    const results = optimizeHeroTeams({
      heroes: roster,
      combinations: combos,
      mainHeroId: 1,
      slots: 1,
      target: "atk",
      availableHeroIds: [2, 3],
    });
    expect(ids(results)).toEqual([[2]]);
    expect(results[0].targetScore).toBe(10);
  });

  it("主英雄未被勾選也一律自動保留", () => {
    const results = optimizeHeroTeams({
      heroes: roster,
      combinations: combos,
      mainHeroId: 1,
      slots: 1,
      target: "atk",
      availableHeroIds: [4],
    });
    expect(results).toHaveLength(1);
    expect(results[0].mainHeroId).toBe(1);
    expect(results[0].companionIds).toEqual([4]);
  });

  it("availableHeroIds 含主英雄時不會把主英雄當成 companion", () => {
    const results = optimizeHeroTeams({
      heroes: roster,
      combinations: combos,
      mainHeroId: 1,
      slots: 1,
      target: "atk",
      availableHeroIds: [1, 2],
    });
    expect(ids(results)).toEqual([[2]]);
  });
});

describe("optimizeHeroTeams 數值與排序", () => {
  it("null 加成以 0 計算，且不改寫輸入資料", () => {
    const combos = [combo(1, [1, 2], { atk: 30, hp: 5 })];
    const results = optimizeHeroTeams({
      heroes: heroes(1, 2),
      combinations: combos,
      mainHeroId: 1,
      slots: 1,
      target: "def",
    });
    expect(results[0].totals).toEqual({
      hp: 5,
      mp: 0,
      atk: 30,
      matk: 0,
      def: 0,
      mdef: 0,
      dodge: 0,
      hit: 0,
    });
    expect(results[0].targetScore).toBe(0);
    // 輸入的 nullable 語意必須原封不動
    expect(combos[0].bonus.def).toBeNull();
    expect(combos[0].bonus.mp).toBeNull();
  });

  it("八項各自累加，target 只決定排序分數", () => {
    const results = optimizeHeroTeams({
      heroes: heroes(1, 2, 3),
      combinations: [
        combo(1, [1, 2], { hp: 1, mp: 2, atk: 3, matk: 4, def: 5, mdef: 6, dodge: 7, hit: 8 }),
        combo(2, [2, 3], {
          hp: 10,
          mp: 20,
          atk: 30,
          matk: 40,
          def: 50,
          mdef: 60,
          dodge: 70,
          hit: 80,
        }),
      ],
      mainHeroId: 1,
      slots: 2,
      target: "mdef",
    });
    expect(results[0].totals).toEqual({
      hp: 11,
      mp: 22,
      atk: 33,
      matk: 44,
      def: 55,
      mdef: 66,
      dodge: 77,
      hit: 88,
    });
    expect(results[0].targetScore).toBe(66);
    expect(HERO_BONUS_KEYS.every((k) => k in results[0].totals)).toBe(true);
  });

  it("依 target descending 排序", () => {
    const results = optimizeHeroTeams({
      heroes: heroes(1, 2, 3, 4),
      combinations: [
        combo(1, [1, 2], { atk: 5 }),
        combo(2, [1, 3], { atk: 50 }),
        combo(3, [1, 4], { atk: 20 }),
      ],
      mainHeroId: 1,
      slots: 1,
      target: "atk",
    });
    expect(ids(results)).toEqual([[3], [4], [2]]);
    expect(results.map((r) => r.targetScore)).toEqual([50, 20, 5]);
  });

  it("同分時以 companion IDs 數值逐項比較，不是字串比較", () => {
    // 9 vs 10：字串排序會把 "10" 放前面，數值排序必須是 9 在前。
    const results = optimizeHeroTeams({
      heroes: heroes(1, 9, 10),
      combinations: [combo(1, [1, 9], { atk: 7 }), combo(2, [1, 10], { atk: 7 })],
      mainHeroId: 1,
      slots: 1,
      target: "atk",
    });
    expect(ids(results)).toEqual([[9], [10]]);
  });

  it("同分且多位 companions 時逐項比較 tuple", () => {
    // 三位候選 2/9/10 兩兩成隊，全部同分：[2,9] < [2,10] < [9,10]
    const combos = [
      combo(1, [1, 2], { atk: 1 }),
      combo(2, [1, 9], { atk: 1 }),
      combo(3, [1, 10], { atk: 1 }),
    ];
    const results = optimizeHeroTeams({
      heroes: heroes(1, 2, 9, 10),
      combinations: combos,
      mainHeroId: 1,
      slots: 2,
      target: "atk",
    });
    expect(results.map((r) => r.targetScore)).toEqual([2, 2, 2]);
    expect(ids(results)).toEqual([
      [2, 9],
      [2, 10],
      [9, 10],
    ]);
  });

  it("最多回傳 10 筆", () => {
    const companions = range(2, 20);
    const results = optimizeHeroTeams({
      heroes: heroes(1, ...companions),
      // atk 遞減，讓期望順序可預測
      combinations: companions.map((id, i) => combo(i + 1, [1, id], { atk: 1000 - i })),
      mainHeroId: 1,
      slots: 1,
      target: "atk",
    });
    expect(results).toHaveLength(10);
    expect(ids(results)).toEqual(range(2, 11).map((id) => [id]));
  });

  it("同分過多時 Top 10 仍由 tie-break 決定", () => {
    const companions = range(2, 20);
    const results = optimizeHeroTeams({
      heroes: heroes(1, ...companions),
      combinations: companions.map((id, i) => combo(i + 1, [1, id], { atk: 42 })),
      mainHeroId: 1,
      slots: 1,
      target: "atk",
    });
    expect(ids(results)).toEqual(range(2, 11).map((id) => [id]));
  });
});

/** 直接全組合掃描的 oracle，不共用 optimizer 的任何內部邏輯。 */
function bruteForce(
  roster: HeroSummary[],
  combinations: HeroCombination[],
  mainHeroId: number,
  slots: number,
  target: HeroBonusKey,
  availableHeroIds?: number[],
): Array<{ companionIds: number[]; targetScore: number; linkIds: number[] }> {
  const pool = roster
    .map((h) => h.id)
    .filter((id) => id !== mainHeroId && (!availableHeroIds || availableHeroIds.includes(id)))
    .sort((a, b) => a - b);

  const out: Array<{ companionIds: number[]; targetScore: number; linkIds: number[] }> = [];
  const walk = (start: number, picked: number[]) => {
    if (picked.length === slots) {
      const team = [mainHeroId, ...picked];
      const triggered = combinations.filter(
        (c) => c.members.length > 0 && c.members.every((m) => team.includes(m.heroId)),
      );
      if (triggered.length === 0) return;
      const score = triggered.reduce((s, c) => s + (c.bonus[target] ?? 0), 0);
      out.push({
        companionIds: [...picked],
        targetScore: score,
        linkIds: triggered.map((c) => c.id).sort((a, b) => a - b),
      });
      return;
    }
    for (let i = start; i < pool.length; i++) walk(i + 1, [...picked, pool[i]]);
  };
  walk(0, []);

  out.sort((a, b) => {
    if (b.targetScore !== a.targetScore) return b.targetScore - a.targetScore;
    for (let i = 0; i < a.companionIds.length; i++) {
      if (a.companionIds[i] !== b.companionIds[i]) return a.companionIds[i] - b.companionIds[i];
    }
    return 0;
  });
  return out.slice(0, 10);
}

describe("optimizeHeroTeams 對照 brute-force oracle", () => {
  const roster = heroes(...range(1, 9));
  // 混合：含主英雄、companions-only、2~4 人、部分 null 加成
  const combinations = [
    combo(1, [1, 2], { atk: 12, hp: 100 }),
    combo(2, [1, 3], { atk: 8, def: 3 }),
    combo(3, [2, 3], { atk: 20 }),
    combo(4, [4, 5], { atk: 20, mp: 7 }),
    combo(5, [1, 4, 5], { atk: 5 }),
    combo(6, [3, 6, 7], { atk: 14, dodge: 2 }),
    combo(7, [2, 5, 8], { hit: 9 }),
    combo(8, [1, 6, 7, 8], { atk: 30 }),
    combo(9, [5, 9], { atk: 12 }),
    combo(10, [1, 9], { atk: 12 }),
    combo(11, [6, 8], { atk: 6 }),
  ];

  for (const slots of [1, 2, 3, 4] as const) {
    for (const target of ["atk", "hp", "def"] as const) {
      it(`slots=${slots} target=${target} 與 oracle 一致`, () => {
        const actual = optimizeHeroTeams({
          heroes: roster,
          combinations,
          mainHeroId: 1,
          slots,
          target,
        });
        const expected = bruteForce(roster, combinations, 1, slots, target);
        expect(
          actual.map((r) => ({
            companionIds: r.companionIds,
            targetScore: r.targetScore,
            linkIds: [...r.mainHeroLinks, ...r.companionLinks]
              .map((c) => c.id)
              .sort((a, b) => a - b),
          })),
        ).toEqual(expected);
      });
    }
  }

  it("受限名冊下也與 oracle 一致", () => {
    const available = [2, 3, 5, 6, 8];
    const actual = optimizeHeroTeams({
      heroes: roster,
      combinations,
      mainHeroId: 1,
      slots: 3,
      target: "atk",
      availableHeroIds: available,
    });
    const expected = bruteForce(roster, combinations, 1, 3, "atk", available);
    expect(actual.map((r) => r.companionIds)).toEqual(expected.map((r) => r.companionIds));
    expect(actual.map((r) => r.targetScore)).toEqual(expected.map((r) => r.targetScore));
    for (const r of actual) {
      for (const id of r.companionIds) expect(available).toContain(id);
    }
  });

  it("八項 totals 與 oracle 逐項一致", () => {
    const actual = optimizeHeroTeams({
      heroes: roster,
      combinations,
      mainHeroId: 1,
      slots: 4,
      target: "atk",
    });
    for (const r of actual) {
      const team = [1, ...r.companionIds];
      const triggered = combinations.filter((c) => c.members.every((m) => team.includes(m.heroId)));
      for (const key of HERO_BONUS_KEYS) {
        expect(r.totals[key]).toBe(triggered.reduce((s, c) => s + (c.bonus[key] ?? 0), 0));
      }
      // 分組必須覆蓋且不重疊
      expect(
        [...r.mainHeroLinks, ...r.companionLinks].map((c) => c.id).sort((a, b) => a - b),
      ).toEqual(triggered.map((c) => c.id).sort((a, b) => a - b));
      expect(r.mainHeroLinks.every((c) => c.members.some((m) => m.heroId === 1))).toBe(true);
      expect(r.companionLinks.every((c) => c.members.every((m) => m.heroId !== 1))).toBe(true);
    }
  });
});

describe("pushBoundedTop bounded-result contract", () => {
  const entry = (score: number, idx: number[]): BoundedTopEntry => ({ score, idx });

  it("長度永遠不超過 k，無論餵入多少候選", () => {
    const top: BoundedTopEntry[] = [];
    for (let i = 0; i < 5000; i++) {
      pushBoundedTop(top, entry(i % 97, [i]), 10);
      expect(top.length).toBeLessThanOrEqual(10);
    }
    expect(top).toHaveLength(10);
  });

  it("結果等同「全收集後排序取前 k 筆」", () => {
    // 固定 seed 的偽隨機，避免 flaky
    let seed = 42;
    const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const all: BoundedTopEntry[] = [];
    for (let i = 0; i < 800; i++) {
      all.push(entry(Math.floor(rand() * 20), [Math.floor(rand() * 30), Math.floor(rand() * 30)]));
    }

    const bounded: BoundedTopEntry[] = [];
    for (const e of all) pushBoundedTop(bounded, e, 10);

    const sorted = [...all].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      for (let i = 0; i < a.idx.length; i++) {
        if (a.idx[i] !== b.idx[i]) return a.idx[i] - b.idx[i];
      }
      return 0;
    });
    expect(bounded.map((e) => [e.score, e.idx])).toEqual(
      sorted.slice(0, 10).map((e) => [e.score, e.idx]),
    );
  });

  it("k <= 0 時不保存任何候選", () => {
    const top: BoundedTopEntry[] = [];
    pushBoundedTop(top, entry(999, [0]), 0);
    expect(top).toEqual([]);
  });

  it("排不進榜的候選會被丟棄，不佔記憶體", () => {
    const top: BoundedTopEntry[] = [];
    for (let i = 0; i < 10; i++) pushBoundedTop(top, entry(1000 - i, [i]), 10);
    const before = top.map((e) => e.idx[0]);
    pushBoundedTop(top, entry(-1, [99]), 10);
    expect(top.map((e) => e.idx[0])).toEqual(before);
    expect(top).toHaveLength(10);
  });
});

describe("optimizeHeroTeams 真實 dataset（84 heroes / 75 connects）", () => {
  const realHeroes = getHeroes();
  const realCombinations = getHeroCombinations();

  /** 獨立 naive 參考：收集全部可行解再排序取前 10。 */
  function naiveTop(mainHeroId: number, slots: number, target: HeroBonusKey) {
    const pool = realHeroes
      .map((h) => h.id)
      .filter((id) => id !== mainHeroId)
      .sort((a, b) => a - b);
    const out: { ids: number[]; score: number; linkIds: number[] }[] = [];
    const walk = (start: number, picked: number[]) => {
      if (picked.length === slots) {
        const team = [mainHeroId, ...picked];
        const trig = realCombinations.filter(
          (c) => c.members.length > 0 && c.members.every((m) => team.includes(m.heroId)),
        );
        if (trig.length === 0) return;
        out.push({
          ids: [...picked],
          score: trig.reduce((s, c) => s + (c.bonus[target] ?? 0), 0),
          linkIds: trig.map((c) => c.id).sort((a, b) => a - b),
        });
        return;
      }
      for (let i = start; i < pool.length; i++) walk(i + 1, [...picked, pool[i]]);
    };
    walk(0, []);
    out.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      for (let i = 0; i < a.ids.length; i++) {
        if (a.ids[i] !== b.ids[i]) return a.ids[i] - b.ids[i];
      }
      return 0;
    });
    return out.slice(0, 10);
  }

  it("bounded 枚舉與 naive 全收集排序結果一致（slots 1–3 × 4 個 target）", () => {
    for (const mainHeroId of [1, 7, 9, 13, 40]) {
      for (const slots of [1, 2, 3] as const) {
        for (const target of ["atk", "hp", "def", "dodge"] as const) {
          const actual = optimizeHeroTeams({
            heroes: realHeroes,
            combinations: realCombinations,
            mainHeroId,
            slots,
            target,
          });
          const expected = naiveTop(mainHeroId, slots, target);
          expect({
            mainHeroId,
            slots,
            target,
            v: actual.map((r) => ({
              ids: r.companionIds,
              score: r.targetScore,
              linkIds: [...r.mainHeroLinks, ...r.companionLinks]
                .map((c) => c.id)
                .sort((a, b) => a - b),
            })),
          }).toEqual({ mainHeroId, slots, target, v: expected });
        }
      }
    }
  });

  it("slots=4 全量枚舉仍與 naive 一致，且只回傳 <= 10 筆", () => {
    const actual = optimizeHeroTeams({
      heroes: realHeroes,
      combinations: realCombinations,
      mainHeroId: 1,
      slots: 4,
      target: "atk",
    });
    expect(actual.length).toBeLessThanOrEqual(10);
    expect(actual.map((r) => ({ ids: r.companionIds, score: r.targetScore }))).toEqual(
      naiveTop(1, 4, "atk").map((r) => ({ ids: r.ids, score: r.score })),
    );
  });

  it("記憶體 bounded：slots=4 的可行解遠多於 10，回傳仍恰好 10 筆", () => {
    // 先用 naive 確認這個設定的可行解數量遠大於 10（bounded 才有意義）
    const feasible = (() => {
      const pool = realHeroes
        .map((h) => h.id)
        .filter((id) => id !== 1)
        .sort((a, b) => a - b);
      let count = 0;
      const walk = (start: number, picked: number[]) => {
        if (picked.length === 4) {
          const team = [1, ...picked];
          if (realCombinations.some((c) => c.members.every((m) => team.includes(m.heroId))))
            count++;
          return;
        }
        for (let i = start; i < pool.length; i++) walk(i + 1, [...picked, pool[i]]);
      };
      walk(0, []);
      return count;
    })();
    expect(feasible).toBeGreaterThan(1000);

    const results = optimizeHeroTeams({
      heroes: realHeroes,
      combinations: realCombinations,
      mainHeroId: 1,
      slots: 4,
      target: "atk",
    });
    expect(results).toHaveLength(10);
  });
});

describe("suggestHeroAdditions", () => {
  it("在 7 位候選中找出真正最佳的建議，即使它排在最後", () => {
    // 主英雄 1 已持有 2、3；候選 10..16 各自能與 2 湊出一條連結，gain 遞增，最佳(16) 在最後。
    const roster = heroes(1, 2, 3, ...range(10, 16));
    const combos = [
      combo(1, [1, 2], { atk: 100 }),
      ...range(10, 16).map((id, i) => combo(10 + i, [2, id], { atk: 10 * (i + 1) })),
    ];
    const suggestions = suggestHeroAdditions({
      heroes: roster,
      combinations: combos,
      mainHeroId: 1,
      slots: 2,
      target: "atk",
      availableHeroIds: [1, 2, 3],
      limit: 7,
    });
    // 7 位候選全部有正 gain，最佳必須是最後那位(16)
    expect(suggestions).toHaveLength(7);
    expect(suggestions[0].heroId).toBe(16);
    expect(suggestions[0].gain).toBe(70);
    expect(suggestions.map((s) => s.heroId)).toEqual([16, 15, 14, 13, 12, 11, 10]);
  });

  it("與逐一全掃的真實 gain 一致，預選不漏掉正 gain 候選", () => {
    const roster = heroes(1, 2, 3, ...range(10, 18));
    const combos = [
      combo(1, [1, 2], { atk: 50 }),
      combo(2, [1, 3], { atk: 20 }),
      combo(3, [2, 17], { atk: 400 }),
      combo(4, [1, 12], { atk: 90 }),
      combo(5, [3, 18], { atk: 5 }),
      combo(6, [10, 11], { atk: 999 }), // 兩位都未持有，補一位湊不齊
      combo(7, [1, 2, 15], { atk: 120 }),
    ];
    const availableHeroIds = [1, 2, 3];
    const best = optimizeHeroTeams({
      heroes: roster,
      combinations: combos,
      mainHeroId: 1,
      slots: 2,
      target: "atk",
      availableHeroIds,
    })[0];

    // 真實答案：對每位未持有英雄都跑一次 optimizer
    const truth = roster
      .filter((h) => !availableHeroIds.includes(h.id))
      .map((h) => {
        const top = optimizeHeroTeams({
          heroes: roster,
          combinations: combos,
          mainHeroId: 1,
          slots: 2,
          target: "atk",
          availableHeroIds: [...availableHeroIds, h.id],
        })[0];
        return { heroId: h.id, gain: top ? top.targetScore - best.targetScore : 0 };
      })
      .filter((t) => t.gain > 0)
      .sort((a, b) => b.gain - a.gain || a.heroId - b.heroId);

    const suggestions = suggestHeroAdditions({
      heroes: roster,
      combinations: combos,
      mainHeroId: 1,
      slots: 2,
      target: "atk",
      availableHeroIds,
      limit: 99,
    });
    expect(suggestions.map((s) => ({ heroId: s.heroId, gain: s.gain }))).toEqual(truth);
    // 需要兩位未持有英雄的連結不能被當成建議
    expect(suggestions.map((s) => s.heroId)).not.toContain(10);
    expect(suggestions.map((s) => s.heroId)).not.toContain(11);
  });

  it("gain <= 0 的英雄不列入建議", () => {
    const roster = heroes(1, 2, 3);
    const suggestions = suggestHeroAdditions({
      heroes: roster,
      combinations: [combo(1, [1, 2], { atk: 100 }), combo(2, [1, 3], { atk: 10 })],
      mainHeroId: 1,
      slots: 1,
      target: "atk",
      availableHeroIds: [1, 2],
    });
    // 加入 3 只能拿到 10 < 現有 100 → 無建議
    expect(suggestions).toEqual([]);
  });

  it("建議不影響 Top 10：未持有英雄不會出現在結果的 companionIds", () => {
    const roster = heroes(1, 2, 3, 4);
    const combos = [combo(1, [1, 2], { atk: 10 }), combo(2, [1, 4], { atk: 900 })];
    const availableHeroIds = [1, 2, 3];
    const results = optimizeHeroTeams({
      heroes: roster,
      combinations: combos,
      mainHeroId: 1,
      slots: 1,
      target: "atk",
      availableHeroIds,
    });
    for (const r of results) {
      for (const id of r.companionIds) expect(availableHeroIds).toContain(id);
    }
    const suggestions = suggestHeroAdditions({
      heroes: roster,
      combinations: combos,
      mainHeroId: 1,
      slots: 1,
      target: "atk",
      availableHeroIds,
    });
    expect(suggestions.map((s) => s.heroId)).toEqual([4]);
    expect(suggestions[0].gain).toBe(890);
    expect(suggestions[0].unlocked.map((c) => c.id)).toEqual([2]);
  });

  it("目前無完整連結（沒有比較基準）時回傳空陣列", () => {
    expect(
      suggestHeroAdditions({
        heroes: heroes(1, 2, 3),
        combinations: [combo(1, [2, 3], { atk: 10 })],
        mainHeroId: 1,
        slots: 1,
        target: "atk",
        availableHeroIds: [1, 2],
      }),
    ).toEqual([]);
  });

  it("主英雄不會被當成建議對象", () => {
    const suggestions = suggestHeroAdditions({
      heroes: heroes(1, 2, 3, 4),
      combinations: [combo(1, [1, 2], { atk: 10 }), combo(2, [1, 2, 3], { atk: 500 })],
      mainHeroId: 1,
      slots: 2,
      target: "atk",
      availableHeroIds: [2, 4],
    });
    expect(suggestions.map((s) => s.heroId)).not.toContain(1);
    expect(suggestions.map((s) => s.heroId)).toEqual([3]);
    expect(suggestions[0].gain).toBe(500);
  });
});
