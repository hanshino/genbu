import { describe, expect, it } from "vitest";
import { meleeAttack, pointCost } from "@/configs/stat-sim";
import {
  calculate,
  castDamage,
  GAIN_WINDOW,
  huanjiaDefence,
  jigongAttack,
  marginalCurve,
  type CalcInput,
} from "@/lib/build-calc";

// 幽冥刺擊 Lv20、天外天 Lv160
const base: CalcInput = {
  sectId: 8,
  level: 160,
  strBase: 68,
  wisBase: 86,
  gearStr: 0,
  gearWis: 0,
  skill: { funcDmg: 10, p1: 2250, p2: 150, p3: 0, p4: 0 },
  jigong: null,
  huanjia: null,
};

// 激攻靈壇 Lv10（status 200）、幻甲靈壇 Lv10（status 145）
const JIGONG = { p3: 160, p4: 145, p5: 92 };
const HUANJIA = { p1: 150, p2: 150, p3: 7700 };

describe("castDamage", () => {
  it("未扣防禦時是 ⌊p1·物攻/100⌋ + p2·玄學", () => {
    expect(castDamage(base)).toBe(Math.floor((2250 * meleeAttack(68)) / 100) + 150 * 86);
  });

  it("裝備外功算進物攻分階", () => {
    expect(castDamage({ ...base, gearStr: 60 })).toBe(
      Math.floor((2250 * meleeAttack(128)) / 100) + 150 * 86,
    );
  });

  it("激攻用總玄學加物攻", () => {
    const input = { ...base, gearWis: 10, jigong: JIGONG };
    const atk = meleeAttack(68) + jigongAttack(JIGONG, 96);
    expect(castDamage(input)).toBe(Math.floor((2250 * atk) / 100) + 150 * 96);
  });
});

describe("calculate", () => {
  it("沒激攻時玄學 +1 正好多 p2，成本照自己點的玄學算", () => {
    const r = calculate(base);
    expect(r.wis.damage).toBe(150);
    expect(r.wis.cost).toBe(pointCost(87));
    expect(r.wis.perPoint).toBeCloseTo(150 / pointCost(87));
    expect(r.str.cost).toBe(pointCost(69));
  });

  it("裝備外功多時外功比較划算，自己放激攻時玄學比較划算", () => {
    expect(calculate({ ...base, gearStr: 60 }).pick).toBe("str");
    expect(calculate({ ...base, strBase: 40, wisBase: 67, jigong: JIGONG }).pick).toBe("wis");
  });

  it("玄學附帶真氣 11、護勁差值與幻甲差值", () => {
    const r = calculate({ ...base, huanjia: HUANJIA });
    expect(r.wisExtras.mp).toBe(11);
    expect(r.wisExtras.mdef).toBeGreaterThanOrEqual(1);
    expect(r.wisExtras.huanjia).toBe(huanjiaDefence(HUANJIA, 87) - huanjiaDefence(HUANJIA, 86));
    expect(calculate(base).wisExtras.huanjia).toBeNull();
  });

  it("自己點的到 146 起標成估計值", () => {
    expect(calculate({ ...base, strBase: 144 }).str.estimated).toBe(false);
    expect(calculate({ ...base, strBase: 145 }).str.estimated).toBe(true);
  });
});

describe("buff 公式", () => {
  it("激攻靈壇 Lv5 實測：玄學 97 → +236、85 → +220", () => {
    const lv5 = { p3: 110, p4: 120, p5: 92 };
    expect(jigongAttack(lv5, 97)).toBe(236);
    expect(jigongAttack(lv5, 85)).toBe(220);
  });

  it("幻甲靈壇 Lv3 候選式吻合 4 個實測點", () => {
    const lv3 = { p1: 80, p2: 110, p3: 7700 };
    expect([113, 118, 122, 127].map((w) => huanjiaDefence(lv3, w))).toEqual([148, 150, 150, 151]);
  });
});

describe("marginalCurve", () => {
  it("每一點一筆，值等於把該屬性設成那點時的 calculate", () => {
    const curve = marginalCurve(base, 1, 50, GAIN_WINDOW);
    expect(curve).toHaveLength(50);
    expect(curve[29].value).toBe(30);
    expect(curve[29].str).toBeCloseTo(calculate({ ...base, strBase: 30 }).str.perPoint);
    expect(curve[29].wis).toBeCloseTo(calculate({ ...base, wisBase: 30 }).wis.perPoint);
  });
});

describe("marginalCurve window", () => {
  it("取接下來 n 點的平均：總傷害差除以總成本", () => {
    const input = { ...base, jigong: JIGONG };
    const [p] = marginalCurve(input, 60, 60, 5);
    const cost = [61, 62, 63, 64, 65].reduce((s, v) => s + pointCost(v), 0);
    expect(p.wis).toBeCloseTo((castDamage(input, 68, 65) - castDamage(input, 68, 60)) / cost);
    expect(p.str).toBeCloseTo((castDamage(input, 65, 86) - castDamage(input, 60, 86)) / cost);
  });
});
