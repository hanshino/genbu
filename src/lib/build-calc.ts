/**
 * 配點計算器：再加 1 點外功或玄學，主攻招一發多幾點傷害。
 *
 * 傷害一律用「未扣怪物防禦」的值（目標防禦 0）：外功那塊和玄學那塊都在同一個 K/(K+D) 裡，
 * 兩者的比例跟打哪隻怪無關，所以不用選怪。武器傷害和裝備物攻是固定加項，邊際值裡會抵掉，這裡不放。
 * 公式來源：六圍 → 物攻見 src/configs/stat-sim.ts，技能傷害見 src/lib/combat/damage.ts（tthol-combat 移植）。
 */
import { ESTIMATED_POINT_FROM, meleeAttack, pointCost, SECTS } from "@/configs/stat-sim";
import { expectedDamage, makeAttacker, makeSkill, makeTarget } from "@/lib/combat/damage";
import type { SectId } from "@/lib/types/stat-sim";

/** 主攻招某一級的傷害參數（magic.func_dmg / func_dmg_p1..p4）。 */
export interface CalcSkillLevel {
  funcDmg: number;
  p1: number;
  p2: number;
  p3: number;
  p4: number;
}

/** 激攻類 buff 的 status 參數：物攻 + p3 + ⌊施放者玄學 × p4 / p5⌋（tthol_data 2026-10-03 實測激攻靈壇）。 */
export interface JigongParams {
  p3: number;
  p4: number;
  p5: number;
}

/**
 * 幻甲類 buff 的 status 參數：防禦與護勁 + p1 + 玄學部分。
 * 玄學部分 = p2 − ⌊p3 / (玄學 + 70)⌋ 是只用 4 個實測點擬合的候選式（tthol_data 2026-10-13），未驗證。
 */
export interface HuanjiaParams {
  p1: number;
  p2: number;
  p3: number;
}

export interface CalcInput {
  sectId: SectId;
  level: number;
  /** 自己點的外功、玄學（不含裝備），決定下一點的加點成本。 */
  strBase: number;
  wisBase: number;
  /** 裝備、被動加的外功、玄學：會進物攻的分階，但不影響加點成本。 */
  gearStr: number;
  gearWis: number;
  skill: CalcSkillLevel;
  /** 自己放的激攻；沒學或靠隊友放為 null。 */
  jigong: JigongParams | null;
  huanjia: HuanjiaParams | null;
}

export interface StatGain {
  /** 再加 1 點，主攻招一發多幾點傷害（未扣防禦）。 */
  damage: number;
  /** 這 1 點要花幾個屬性點。 */
  cost: number;
  /**
   * 接下來 GAIN_WINDOW 點平均，每花 1 個屬性點多幾點傷害。
   * 不用單點的 damage / cost：激攻取整、物攻分階取整都會讓單點的增量忽大忽小，判斷會跟著跳。
   */
  perPoint: number;
  /** 下一點的成本已進入估計範圍（自己點的達 146 以上）。 */
  estimated: boolean;
}

export interface CalcResult {
  /** 目前一發的傷害（未扣防禦）。 */
  damage: number;
  str: StatGain;
  wis: StatGain;
  /** perPoint 差在 2% 內視為差不多。 */
  pick: "str" | "wis" | "even";
  /** 加 1 點玄學的附帶效果。 */
  wisExtras: { mp: number; mdef: number; huanjia: number | null };
}

/** 激攻加的物攻。 */
export function jigongAttack(params: JigongParams, wis: number): number {
  return params.p3 + Math.floor((wis * params.p4) / params.p5);
}

/** 幻甲加的防禦（= 護勁），候選式。 */
export function huanjiaDefence(params: HuanjiaParams, wis: number): number {
  return params.p1 + params.p2 - Math.floor(params.p3 / (wis + 70));
}

/** 主攻招一發的期望傷害（未扣防禦、必中）。 */
export function castDamage(
  input: CalcInput,
  strBase = input.strBase,
  wisBase = input.wisBase,
): number {
  const str = strBase + input.gearStr;
  const wis = wisBase + input.gearWis;
  const atk = meleeAttack(str) + (input.jigong ? jigongAttack(input.jigong, wis) : 0);
  const attacker = makeAttacker({ level: input.level, atk, matk: 0, hit: 1e9, crit: 0, wis, str });
  const target = makeTarget({ level: input.level, extraDef: 0, magicDef: 0 });
  return expectedDamage(attacker, target, makeSkill(input.skill));
}

/** 判斷外功、玄學哪個划算時，看接下來幾點的平均。 */
export const GAIN_WINDOW = 5;

function gain(input: CalcInput, stat: "str" | "wis"): StatGain {
  const base = stat === "str" ? input.strBase : input.wisBase;
  const next =
    stat === "str"
      ? castDamage(input, input.strBase + 1, input.wisBase)
      : castDamage(input, input.strBase, input.wisBase + 1);
  const damage = next - castDamage(input);
  const cost = pointCost(base + 1);
  return {
    damage,
    cost,
    perPoint: averageGain(input, stat, base, GAIN_WINDOW),
    estimated: base + 1 >= ESTIMATED_POINT_FROM,
  };
}

export function calculate(input: CalcInput): CalcResult {
  const str = gain(input, "str");
  const wis = gain(input, "wis");
  const hi = Math.max(str.perPoint, wis.perPoint);
  const pick =
    hi <= 0 || Math.abs(str.perPoint - wis.perPoint) <= hi * 0.02
      ? "even"
      : str.perPoint > wis.perPoint
        ? "str"
        : "wis";
  const sect = SECTS[input.sectId];
  const w = input.wisBase + input.gearWis;
  return {
    damage: castDamage(input),
    str,
    wis,
    pick,
    wisExtras: {
      mp: sect.mp.wis,
      mdef: sect.mdef(0, w + 1) - sect.mdef(0, w),
      huanjia: input.huanjia
        ? huanjiaDefence(input.huanjia, w + 1) - huanjiaDefence(input.huanjia, w)
        : null,
    },
  };
}

export interface CurvePoint {
  /** 自己點的數值。 */
  value: number;
  /** 外功停在 value 時，接下來每花 1 屬性點多幾點傷害（玄學不變）。 */
  str: number;
  /** 玄學停在 value 時，同上（外功不變）。 */
  wis: number;
}

/** 從 value 再點 n 點，平均每個屬性點多幾點傷害。 */
function averageGain(input: CalcInput, stat: "str" | "wis", value: number, n: number): number {
  const at = (v: number) =>
    stat === "str" ? castDamage(input, v, input.wisBase) : castDamage(input, input.strBase, v);
  let cost = 0;
  for (let i = 1; i <= n; i++) cost += pointCost(value + i);
  return (at(value + n) - at(value)) / cost;
}

/**
 * 邊際效應曲線：兩條線各自只動一個屬性，另一個固定在輸入值。
 * 激攻的 ⌊玄學 × p4 / p5⌋ 會讓每點的增量 1、2 交替，圖會鋸齒狀；window > 1 取接下來 window 點的平均。
 */
export function marginalCurve(input: CalcInput, from = 1, to = 200, window = 1): CurvePoint[] {
  const out: CurvePoint[] = [];
  for (let v = from; v <= to; v++) {
    out.push({
      value: v,
      str: averageGain(input, "str", v, window),
      wis: averageGain(input, "wis", v, window),
    });
  }
  return out;
}
