import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import * as d from "../damage";
import {
  makeAttacker,
  makeSkill,
  makeTarget,
  type Attacker,
  type Rng,
  type Skill,
  type Target,
} from "../damage";

// ---------------------------------------------------------------------------
// 黃金測資：scripts/combat/gen_vectors.py 以 Python tthol-combat 產生（npm run combat:vectors）
// ---------------------------------------------------------------------------

interface RngCall {
  method: "randrange" | "randint";
  args: number[];
  ret: number;
}

interface VectorCase {
  fn: string;
  args: unknown[];
  expected: unknown;
  rng?: RngCall[];
}

interface Vectors {
  tthol_combat_commit: string;
  cases: VectorCase[];
}

const VECTORS_PATH = path.join(__dirname, "vectors.json");

function loadVectors(): { vectors: Vectors | null; error: string | null } {
  if (!existsSync(VECTORS_PATH)) {
    return {
      vectors: null,
      error: `找不到 ${VECTORS_PATH}。請在 genbu 根目錄執行 \`npm run combat:vectors\` 產生黃金測資（需要 ../tthol-combat 與 uv）。`,
    };
  }
  return { vectors: JSON.parse(readFileSync(VECTORS_PATH, "utf-8")) as Vectors, error: null };
}

const { vectors, error: vectorsError } = loadVectors();

/** 浮點比較：相對誤差 1e-9。 */
function close(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= 1e-9 * Math.max(Math.abs(actual), Math.abs(expected));
}

/** 重播 Python 記錄下來的抽籤序列，逐次檢查方法與參數，回傳記錄的結果。 */
function scriptedRng(calls: RngCall[]): { rng: Rng; seen: RngCall[] } {
  const seen: RngCall[] = [];
  const next = (method: RngCall["method"], args: number[]): number => {
    const want = calls[seen.length];
    if (!want) throw new Error(`多餘的 ${method}(${args}) 呼叫（第 ${seen.length + 1} 次）`);
    const got: RngCall = { method, args, ret: want.ret };
    seen.push(got);
    return want.ret;
  };
  return {
    rng: {
      randrange: (stop) => next("randrange", [stop]),
      randint: (a, b) => next("randint", [a, b]),
    },
    seen,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => unknown;

const FUNCTIONS: Record<string, AnyFn> = {
  physical: d.physical,
  ignoreDefence: d.ignoreDefence,
  chance: d.chance,
  mpCost: d.mpCost,
  critChance: d.critChance,
  wisBonus: d.wisBonus,
  agiBonus: d.agiBonus,
  kylinWis: d.kylinWis,
  fixedBase: d.fixedBase,
  usesInner: d.usesInner,
  defenceOf: d.defenceOf,
  baseRange: d.baseRange,
  segments: d.segments,
  hitChance: d.hitChance,
  outcomes: d.outcomes,
  expectedDamage: d.expectedDamage,
  damageRange: d.damageRange,
  playerHit: d.playerHit,
};

describe("golden vectors from tthol-combat", () => {
  it("vectors.json exists", () => {
    expect(vectorsError, vectorsError ?? undefined).toBeNull();
    expect(vectors?.cases.length).toBeGreaterThan(0);
  });

  it("covers every ported function", () => {
    if (!vectors) return;
    const covered = new Set(vectors.cases.map((c) => c.fn));
    expect([...covered].sort()).toEqual(Object.keys(FUNCTIONS).sort());
  });

  const byFn = new Map<string, VectorCase[]>();
  for (const c of vectors?.cases ?? []) {
    byFn.set(c.fn, [...(byFn.get(c.fn) ?? []), c]);
  }

  for (const [fn, cases] of byFn) {
    it(`${fn} (${cases.length} cases)`, () => {
      const f = FUNCTIONS[fn];
      expect(f, `vectors.json 有未移植的函式 ${fn}`).toBeDefined();
      cases.forEach((c, i) => {
        const label = `${fn}#${i} args=${JSON.stringify(c.args)}`;
        if (fn === "playerHit") {
          const { rng, seen } = scriptedRng(c.rng ?? []);
          const [a, t, s] = c.args as [Attacker, Target, Skill | null];
          const got = d.playerHit(a, t, s, rng);
          expect(got, label).toEqual(c.expected);
          // 抽籤順序與參數必須和 Python 完全相同
          expect(seen, `${label} rng calls`).toEqual(c.rng);
          return;
        }
        const got = f(...c.args);
        if (fn === "expectedDamage") {
          expect(
            close(got as number, c.expected as number),
            `${label}: ${got} vs ${c.expected}`,
          ).toBe(true);
        } else if (fn === "outcomes") {
          const gs = got as d.Outcome[];
          const es = c.expected as d.Outcome[];
          expect(gs.length, label).toBe(es.length);
          gs.forEach((g, j) => {
            expect(close(g.p, es[j].p), `${label}[${j}].p: ${g.p} vs ${es[j].p}`).toBe(true);
            expect({ kind: g.kind, lo: g.lo, hi: g.hi }, label).toEqual({
              kind: es[j].kind,
              lo: es[j].lo,
              hi: es[j].hi,
            });
          });
        } else {
          expect(got, label).toEqual(c.expected);
        }
      });
    });
  }
});

// ---------------------------------------------------------------------------
// tthol-combat tests/test_damage.py 的 20 個單元測試，逐一移植
// ---------------------------------------------------------------------------

function mob(kw: Partial<Target> = {}): Target {
  return makeTarget({ level: 37, extraDef: 29, magicDef: 0, baseDodge: 0, ...kw });
}

function atk(level: number, a: number, matk: number, hit: number, crit: number, kw = {}): Attacker {
  return makeAttacker({ level, atk: a, matk, hit, crit, ...kw });
}

/** Python 的 Always / Never / Low / High：randrange 固定、randint 固定取低或高端。 */
function fixedRng(rr: number, ri: "lo" | "hi"): Rng {
  return {
    randrange: () => rr,
    randint: (a, b) => (ri === "lo" ? a : b),
  };
}
const Always = () => fixedRng(0, "lo"); // 每次都命中 / 重擊，randint 取低
const Never = () => fixedRng(94, "lo"); // 命中、不重擊
const Low = () => fixedRng(94, "lo");
const High = () => fixedRng(94, "hi");

/** Python round()：四捨六入五成雙。 */
function pyRound(x: number): number {
  const f = Math.floor(x);
  const diff = x - f;
  if (diff < 0.5) return f;
  if (diff > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

/** mulberry32：固定種子的 Rng，供「隨機與規劃一致」測試使用。 */
function seededRng(seed: number): Rng {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    randrange: (stop) => Math.floor(rand() * stop),
    randint: (a, b) => a + Math.floor(rand() * (b - a + 1)),
  };
}

const STAR = makeSkill({ funcDmg: 3, p1: 150, spendMp: 5 }); // 星雲劍法 112 Lv15
const FIRE = makeSkill({ funcDmg: 17, p1: 1900, p2: 200 }); // 業火紅蓮 744 Lv20
const STAB = makeSkill({ funcDmg: 10, p1: 2250, p2: 150 }); // 幽冥刺擊 722 Lv20
const JIAOMIE = makeSkill({ funcDmg: 50, p1: 1000, p2: 240 }); // 絞滅劍陣 843 Lv20
const LIANJI = makeSkill({ funcDmg: 48, p1: 420, p2: 200, p3: 4 }); // 雙劍連擊 831 Lv10

describe("tthol-combat tests/test_damage.py", () => {
  it("bare_hand_normal_and_crit_match_the_fit", () => {
    // 物攻 155 bare-handed on ▲吹箭客 (Lv37, extra_def 29): normal 134, crit 283 (tthol-data, exact)
    expect(d.physical(155, 100, 37, 29)).toBe(134);
    expect(d.physical(155, 200, 37, 29)).toBe(283);
    const a = atk(100, 155, 0, 1e6, 0);
    expect(d.playerHit(a, mob(), null, Never())).toEqual([[d.HIT, 134]]);
    const crit = atk(100, 155, 0, 1e6, 100);
    expect(d.playerHit(crit, mob(), null, Always())).toEqual([[d.CRIT, 283]]);
  });

  it("skills_never_crit", () => {
    const row = makeSkill({ funcDmg: 50, p1: 100, p3: 1 }); // 十字斬擊 822 Lv2
    const crit = atk(100, 155, 0, 1e6, 100);
    expect(d.playerHit(crit, mob(), row, Always())).toEqual([[d.HIT, 134]]);
  });

  it("defence_ignored_skill_matches_the_fit", () => {
    // 毒舌亂神 703 Lv20 (func_dmg 6, p1 1300 p2 450 p3 150): 內勁 1212 -> 16438, after a potion 1298 -> 17556
    expect(d.ignoreDefence(1300, 450, 150, 1212, 155)).toBe(16438);
    expect(d.ignoreDefence(1300, 450, 150, 1298, 155)).toBe(17556);
    const row = makeSkill({ funcDmg: 6, p1: 1300, p2: 450, p3: 150 });
    const a = atk(100, 155, 1212, 1e6, 0);
    expect(d.playerHit(a, mob({ extraDef: 500 }), row, Never())).toEqual([[d.HIT, 16438]]);
    expect(d.damageRange(a, mob({ extraDef: 500 }), row)).toEqual([16438, 16438]);
  });

  it("defence_ignored_skill_rolls_both_weapon_halves", () => {
    // official 毒舌亂神 Lv20 with 幟焰烈火拂塵 50281 (WHISK, damage 660..679, pdamage 824..849), 內勁 1722,
    // 物攻 244: 740 hits span exactly 34904..35257 (tthol-data 2026-10-14)
    const row = makeSkill({ funcDmg: 6, p1: 1300, p2: 450, p3: 150 });
    const a = atk(100, 244, 1722, 1e6, 0, {
      weaponMin: 660,
      weaponMax: 679,
      weaponType: "WHISK",
      pweaponMin: 824,
      pweaponMax: 849,
    });
    expect(d.damageRange(a, mob(), row)).toEqual([34904, 35257]);
    expect(d.playerHit(a, mob(), row, Low())).toEqual([[d.HIT, 34904]]);
    expect(d.playerHit(a, mob(), row, High())).toEqual([[d.HIT, 35257]]);
  });

  it("single_hit_adds_p2_before_the_defence", () => {
    // 斷空劍法 356 Lv20 (p1 1400, p2 200): official hits a constant 200·K/(K+D) above the range without p2
    const cut = makeSkill({ funcDmg: 3, p1: 1400, p2: 200 });
    const a = atk(100, 1053, 0, 1e6, 0);
    const t = mob({ level: 120, extraDef: 400 });
    const k = 5 * 120 + 500;
    const withP2 = d.playerHit(a, t, cut, Low())[0][1];
    expect(withP2).toBe(d.physical(1053, 1400, 120, 400, 200));
    expect(
      Math.abs(withP2 - d.physical(1053, 1400, 120, 400) - (200 * k) / (k + 400)),
    ).toBeLessThanOrEqual(1);
    const multi = { ...cut, funcDmg: 7, p3: 1 };
    expect(d.playerHit(a, t, multi, Low())[0][1]).toBe(d.physical(1053, 1400, 120, 400));
  });

  it("ammo_joins_the_base_once_on_a_swing_three_times_on_a_skill", () => {
    // official real client 2026-10-18 (tthol-headless): 物攻 646, 木紋手甲 BOW 92..98 + 十字鏢 23 on ▲虎頭工蜂 5223
    // (Lv21, 防禦 16): 10 normal hits 733..739 = the whole range, crits 1480..1484; 大手裡劍 263 Lv16 4415..4437
    const a = atk(100, 646, 241, 1e6, 0, {
      weaponMin: 92,
      weaponMax: 98,
      weaponType: "BOW",
      ammo: 23,
    });
    const t = mob({ level: 21, extraDef: 16 });
    expect(d.damageRange(a, t)).toEqual([733, 740]); // the BOW roll tops at 99 beside a 暗器
    expect(d.physical(646 + 23 + 92, 200, 21, 16)).toBeLessThanOrEqual(1480);
    expect(d.physical(646 + 23 + 98, 200, 21, 16)).toBeGreaterThanOrEqual(1484);
    const shuriken = makeSkill({ funcDmg: 3, p1: 560, p2: 16 });
    expect(d.baseRange(a, shuriken)).toEqual([646 + 3 * 23 + 92, 646 + 3 * 23 + 99]);
    const [lo, hi] = d.damageRange(a, t, shuriken);
    expect(lo).toBeLessThanOrEqual(4415);
    expect(hi).toBeGreaterThanOrEqual(4437);
    expect(d.baseRange({ ...a, ammo: 0 }, shuriken)).toEqual([646 + 92, 646 + 98]);
    // 影殺 261 Lv16 (func 7, p1 100, p2 40, 6 equal segments) adds p2 beside a 暗器: 818..821 on 5223
    const shadow = makeSkill({ funcDmg: 7, p1: 100, p2: 40, p3: 6 });
    const [slo, shi] = d.damageRange(a, t, shadow);
    expect(slo).toBeLessThanOrEqual(6 * 818);
    expect(shi).toBeGreaterThanOrEqual(6 * 821);
    expect(shi - slo).toBeLessThan(6 * 10);
    // 轟天彈 115: 大手裡劍's top 5954 (seen 4 times) is the roll of 99
    expect(d.damageRange({ ...a, ammo: 115 }, t, shuriken)[1]).toBe(5954);
  });

  it("skill_multiplier_and_multi_hit", () => {
    const row = makeSkill({ funcDmg: 4, p1: 1650, funcHitP1: 90 }); // 千瘡百孔 702 Lv20: 內勁 against 護勁
    let a = atk(100, 155, 900, 1e6, 0);
    const t = mob({ magicDef: 40 });
    expect(d.playerHit(a, t, row, Always())).toEqual([[d.HIT, d.physical(900, 1650, 37, 40)]]);
    a = atk(100, 155, 0, 1e6, 0);
    const multi = { ...row, funcDmg: 7, p1: 500, p3: 3 };
    const one = d.physical(155, 500, 37, 29);
    expect(d.playerHit(a, mob(), multi, Always())).toEqual([
      [d.HIT, one],
      [d.HIT, one],
      [d.HIT, one],
    ]);
    expect(d.damageRange(a, mob(), multi)).toEqual([3 * one, 3 * one]);
  });

  it("inner_or_outer_by_func_dmg_and_the_weapon_roll_by_kind", () => {
    // a sword (damage 945..970) and gloves (pdamage 1096..1114, tthol-data's two measured weapons)
    const sword = atk(100, 2000, 300, 1e6, 0, {
      weaponMin: 945,
      weaponMax: 970,
      weaponType: "SWORD",
    });
    const gloves = atk(100, 200, 1500, 1e6, 0, {
      weaponType: "PUNCHER",
      pweaponMin: 1096,
      pweaponMax: 1114,
    });
    const t = mob({ extraDef: 29, magicDef: 40 });
    expect(d.playerHit(sword, t, null, Low())).toEqual([
      [d.HIT, d.physical(2000 + 945, 100, 37, 29)],
    ]);
    expect(d.playerHit(gloves, t, null, Low())).toEqual([
      [d.HIT, d.physical(1500 + 1096, 100, 37, 40)],
    ]);
    const fire = { ...STAR, funcDmg: 17, p1: 1400 }; // 內勁: the sword has no pdamage
    const both = { ...STAR, funcDmg: 15, p1: 300 }; // 怒擊: 物攻 + 內勁
    expect(d.playerHit(sword, t, STAR, Low())).toEqual([[d.HIT, d.physical(2945, 150, 37, 29)]]);
    expect(d.playerHit(sword, t, fire, Low())).toEqual([[d.HIT, d.physical(300, 1400, 37, 40)]]);
    expect(d.playerHit(sword, t, both, Low())).toEqual([
      [d.HIT, d.physical(2945 + 300, 300, 37, 29)],
    ]);
    expect(d.baseRange(sword, both)).toEqual([3245, 3270]);
  });

  it("stab_adds_wis_times_p2_before_the_defence", () => {
    // official 幽冥刺擊 Lv20 on 8895 (Lv156, 防禦 1539): 物攻 1285, 龍躍鳳鳴匕首 860..878, 玄學 138 -> 96 hits in
    // 30544..30727 (tthol-headless xuanxue-20261013)
    const a = atk(189, 1285, 0, 1e6, 0, {
      weaponMin: 860,
      weaponMax: 878,
      weaponType: "DAGGER",
      wis: 138,
    });
    const t = mob({ level: 156, extraDef: 1539 });
    const lo = d.playerHit(a, t, STAB, Low())[0][1];
    const hi = d.playerHit(a, t, STAB, High())[0][1];
    expect([lo, hi]).toEqual([30544, 30727]); // the 96 hits' own span: floored before the 玄學 term (was one over)
    expect(d.damageRange(a, t, STAB)).toEqual([30544, 30727]);
    expect(d.playerHit({ ...a, wis: 0 }, t, STAB, High())[0][1]).toBe(21328); // 玄學 is ~30 % of it
    expect(d.playerHit(a, t, { ...STAB, funcDmg: 1 }, High())[0][1]).toBe(21328); // no 玄學 term on another kind
  });

  it("fire_adds_the_fitted_wis_curve", () => {
    // official 業火紅蓮 Lv20 on 8817 (Lv78, 護勁 216): 內勁 310, the unrefined 幻羽杖 (pdamage 545..606), 玄學 100 ->
    // 24 hits in 23915..24680; without 玄學 it would top out at 13897
    const a = atk(112, 0, 310, 1e6, 0, {
      weaponType: "STAFF",
      pweaponMin: 545,
      pweaponMax: 606,
      wis: 100,
    });
    const t = mob({ level: 78, magicDef: 216 });
    const [lo, hi] = d.damageRange(a, t, FIRE);
    expect(lo <= 23915 && 24680 <= hi && hi - lo < 1000).toBe(true);
    expect(d.wisBonus(FIRE, 100)).toBe(Math.floor((200 * 100 * 100) / 149));
    expect(d.wisBonus(FIRE, 0)).toBe(0);
  });

  it("miss_and_minimum_damage", () => {
    expect(d.playerHit(atk(1, 155, 0, 1, 0), mob({ baseDodge: 1e6 }), null, Never())).toEqual([
      [d.MISS, 0],
    ]);
    expect(d.physical(1, 100, 1, 500)).toBe(1); // never below 1 (live: many hits of exactly 1)
  });

  it("chance_always_hits_at_or_above_the_dodge", () => {
    // 命中 >= 閃躲 always hits (user, live play): a Lv13 命中 123 on 波克鼠 閃躲 74
    expect(d.chance(123, 74)).toBe(100);
    expect(d.chance(74, 74)).toBe(100);
    // below it: 100 % at 閃躲 = 命中 down to 0 % at 1.5x (the user, 2026-10-17)
    expect([1.1, 1.25, 1.4, 1.5, 4.5].map((x) => d.chance(100, pyRound(100 * x)))).toEqual([
      72, 40, 14, 0, 0,
    ]);
    expect(d.chance(270, 1198)).toBe(0); // 伊森 vs 赤焰洞 (was 22 %)
    expect(d.chance(1, 1000)).toBe(d.HIT_MIN);
    expect(d.HIT_MIN).toBe(0);
    // a skill's func_hit_p1 scales the 命中: 修羅刀法 87 % of 317 still beats 111, of 100 does not
    expect(d.chance(317, 111, 87)).toBe(100);
    expect(d.chance(100, 100, 87)).toBe(61);
    expect(d.chance(50, 100, 50)).toBe(0);
    expect(d.chance(60, 100, 200)).toBe(100);
  });

  it("mp_cost", () => {
    expect(d.mpCost(STAR, 1000)).toBe(5);
    expect(d.mpCost(makeSkill({ funcDmg: 0, p1: 0, spendMp: 25, spendFlag: 1 }), 1881)).toBe(470);
  });

  it("outcomes_weigh_crits_misses_and_chance_multipliers", () => {
    const a = atk(100, 155, 0, 80, 30);
    const t = mob({ baseDodge: 100 }); // 40 % hit
    const out = d.outcomes(a, t);
    expect(out.map((o) => [o.kind, o.lo])).toEqual([
      [d.HIT, 134],
      [d.CRIT, 283],
    ]);
    expect(out.reduce((s, o) => s + o.p, 0)).toBeCloseTo(0.4, 6);
    expect(d.expectedDamage(a, t)).toBeCloseTo(0.4 * (0.7 * 134 + 0.3 * 283), 6);
    // func_dmg 8 (醉月 / 要害刺擊): p1 at p4 %, else p2
    const drunk = makeSkill({ funcDmg: 8, p1: 800, p2: 400, p4: 25 });
    const sure = { ...a, hit: 1e6 };
    const lo8 = d.physical(155, 800, 37, 29);
    const lo4 = d.physical(155, 400, 37, 29);
    expect(d.damageRange(sure, t, drunk)).toEqual([lo4, lo8]);
    expect(d.expectedDamage(sure, t, drunk)).toBeCloseTo(0.25 * lo8 + 0.75 * lo4, 6);
  });

  it("random_and_planned_agree_on_the_bounds", () => {
    // every draw of player_hit falls in damage_range, over weapons, kinds and crits
    const r = seededRng(7);
    const a = atk(150, 1200, 900, 1e6, 40, {
      weaponMin: 300,
      weaponMax: 420,
      weaponType: "SWORD",
      pweaponMin: 200,
      pweaponMax: 260,
      wis: 80,
    });
    const t = mob({ level: 120, extraDef: 400, magicDef: 300 });
    const poison = makeSkill({ funcDmg: 6, p1: 1300, p2: 450, p3: 150 });
    const cut = { ...STAR, p2: 200 };
    const rows: (Skill | null)[] = [
      null,
      STAR,
      cut,
      FIRE,
      STAB,
      poison,
      { ...STAR, funcDmg: 7, p3: 4 },
      { ...STAR, funcDmg: 15 },
    ];
    for (const row of rows) {
      const [lo, hi] = d.damageRange(a, t, row);
      for (let i = 0; i < 200; i++) {
        const got = d.playerHit(a, t, row, r).reduce((s, [, v]) => s + v, 0);
        expect(got).toBeGreaterThanOrEqual(lo);
        expect(got).toBeLessThanOrEqual(hi);
      }
    }
  });

  it("kylin_wis_is_a_flat_term_after_the_multiplier", () => {
    // 玄學 × p2 / 100 × 外功, not scaled by p1, reduced by the defence
    const a = atk(120, 1500, 0, 1e6, 0, { wis: 150, str: 100 });
    const t = mob({ level: 100, extraDef: 300 });
    expect(d.kylinWis(JIAOMIE, a)).toBe(36000);
    expect(d.playerHit(a, t, JIAOMIE, Always())).toEqual([
      [d.HIT, d.physical(1500, 1000, 100, 300, 36000)],
    ]);
    expect(d.playerHit({ ...a, wis: 0 }, t, JIAOMIE, Always())).toEqual([
      [d.HIT, d.physical(1500, 1000, 100, 300)],
    ]);
  });

  it("kylin_range_sits_just_under_official_hits", () => {
    // official 絞滅劍陣 Lv20 on 紫衫女劍客 8049 (Lv74, 防禦 92) by a Lv198 麒麟: 外功 154, 物攻 2055, weapon
    // 1209..1245 (tthol-headless 2026-10-15). 玄學 106: 67063 / 67055, 103: 65702. B's unknown 玄學 term
    // leaves the hits 2..4 % above the range
    const a = atk(198, 2055, 0, 1e6, 0, { weaponMin: 1209, weaponMax: 1245, str: 154 });
    const t = mob({ level: 74, extraDef: 92 });
    const cases: [number, number[]][] = [
      [106, [67063, 67055]],
      [103, [65702]],
    ];
    for (const [wis, hits] of cases) {
      const [, hi] = d.damageRange({ ...a, wis }, t, JIAOMIE);
      for (const v of hits) {
        expect(hi).toBeLessThan(v);
        expect(v).toBeLessThan(hi * 1.04);
      }
    }
    const oldGuess = d.physical(2055 + 1245 + Math.floor((106 * 240) / 100), 1000, 74, 92); // 1129f88: 玄學 joined B
    expect(oldGuess).toBeLessThan(0.6 * 67063);
  });

  it("kylin_multi_hit_is_p3_strikes_of_matk_plus_p2", () => {
    // official 雙劍連擊 Lv10 (p1 420, p2 200, 4 hits) by a Lv198 麒麟 at 內勁 263: 1133 × 4 on 8049 (Lv74, 防禦 92),
    // 1094 on 8052 (Lv78, 117), 1046 on 8060 (Lv75, 145); 物攻, the weapon and 玄學 do not count
    const a = atk(198, 2055, 263, 1e6, 0, {
      weaponMin: 1209,
      weaponMax: 1245,
      weaponType: "SWORD",
      wis: 106,
      str: 154,
    });
    const cases: [number, number, number][] = [
      [74, 92, 1133],
      [78, 117, 1094],
      [75, 145, 1046],
    ];
    for (const [level, defence, v] of cases) {
      const t = mob({ level, extraDef: defence });
      const segs = d.playerHit(a, t, LIANJI, Always());
      expect(segs.length).toBe(4);
      expect(segs.every(([k, x]) => k === d.HIT && Math.abs(x - v) <= 1)).toBe(true); // R 1304.2 vs our 1304.6
      const total = segs.reduce((s, [, x]) => s + x, 0);
      expect(d.damageRange(a, t, LIANJI)).toEqual([total, total]);
    }
    expect(d.kylinWis(LIANJI, a)).toBe(0);
  });

  it("kylin_flat_adds_wis_times_p2_times_int_on_a_fixed_base", () => {
    // official 828 Lv10 (p1 350, p2 260) / 829 Lv10 (p1 500, p2 200) by a Lv198 麒麟, 玄學 106: raw R = p1 % × A +
    // 玄學 × p2 / 100 × 內力 with A 779.4 at 內勁 263 (內力 1) and 843.4 at 334 (內力 11) (tthol-headless 2026-10-15)
    const a = atk(198, 2055, 263, 1e6, 0, {
      weaponMin: 1209,
      weaponMax: 1245,
      weaponType: "SWORD",
      wis: 106,
      str: 154,
      int: 1,
    });
    const t = mob({ level: 74, extraDef: 0 });
    const skills = [
      makeSkill({ funcDmg: 51, p1: 350, p2: 260 }),
      makeSkill({ funcDmg: 51, p1: 500, p2: 200 }),
    ];
    const points: [number, number, number][] = [
      [263, 1, 779.4],
      [334, 11, 843.4],
    ];
    for (const skill of skills) {
      for (const [matk, int, base] of points) {
        const b = { ...a, matk, int };
        const raw = (skill.p1 / 100) * base + ((106 * skill.p2) / 100) * int;
        const [lo, hi] = d.damageRange(b, t, skill);
        expect(lo).toBe(hi);
        expect(Math.abs(hi - raw)).toBeLessThan(4);
      }
    }
    expect(d.kylinWis(skills[0], { ...a, int: 11 })).toBe(Math.floor((106 * 260 * 11) / 100));
  });

  it("xianglong_adds_agi_times_p2_over_50_to_the_base", () => {
    // 翔龍 378 Lv1 (func_dmg 14, p1 1600, p2 360): ⌊身法 · p2 / 50⌋ joins B and is multiplied with it
    const xl = makeSkill({ funcDmg: 14, p1: 1600, p2: 360, funcHitP1: 86 });
    const a = atk(100, 1000, 0, 1e6, 0, { agi: 50 });
    const t = mob({ level: 100, extraDef: 500 });
    expect(d.agiBonus(xl, a)).toBe(360);
    expect(d.playerHit(a, t, xl, Low())).toEqual([[d.HIT, d.physical(1000 + 360, 1600, 100, 500)]]);
    expect(d.playerHit({ ...a, agi: 0 }, t, xl, Low())).toEqual([
      [d.HIT, d.physical(1000, 1600, 100, 500)],
    ]);
    expect(d.agiBonus({ ...xl, funcDmg: 3 }, a)).toBe(0); // no 身法 term on another kind
  });

  it("xianglong_fits_the_official_test", () => {
    // bahamut sn 5235: 武器 avg 1003 + 物攻 724, 身法 216, Lv1, a near-0-defence 海馬 -> 9 hits avg 52070
    const xl = makeSkill({ funcDmg: 14, p1: 1600, p2: 360, funcHitP1: 86 });
    const a = atk(0, 724, 0, 1e6, 0, { agi: 216 });
    const got = d.physical(724 + 1003 + d.agiBonus(xl, a), xl.p1, 60, 0);
    expect(Math.abs(got - 52070) / 52070).toBeLessThan(0.01);
  });
});

describe("integer helpers match Python semantics", () => {
  it("floorDiv floors toward negative infinity", () => {
    expect(d.floorDiv(7, 2)).toBe(3);
    expect(d.floorDiv(-7, 2)).toBe(-4);
    expect(d.floorDiv(7, -2)).toBe(-4);
    expect(d.floorDiv(-6, 3)).toBe(-2);
    expect(d.floorDiv(0, 5)).toBe(0);
  });

  it("pyRound is banker's rounding", () => {
    expect([0.5, 1.5, 2.5, -0.5, -1.5, 2.4, 2.6].map(pyRound)).toEqual([0, 2, 2, 0, -2, 2, 3]);
  });
});
