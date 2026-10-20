import { GAIN_WINDOW, marginalCurve, type CalcInput } from "@/lib/build-calc";

/** 前 20 點每點只要 1～2 個屬性點，值大到會把後面壓扁；100 等以後也沒人停在那裡。 */
export const CURVE_START = 20;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 曲線畫到哪：至少 160，目前點數往後再多看 30 點。 */
export function curveEnd(input: CalcInput): number {
  return Math.min(250, Math.max(160, input.strBase + 30, input.wisBase + 30));
}

/** 圖用的曲線：每點取接下來 GAIN_WINDOW 點的平均，跟計算器的判斷一致。 */
export function curveData(input: CalcInput, from = CURVE_START) {
  return marginalCurve(input, from, curveEnd(input), GAIN_WINDOW).map((p) => ({
    value: p.value,
    str: round1(p.str),
    wis: round1(p.wis),
  }));
}

/** 圖的表格版：每 10 點一列。 */
export function curveRows(input: CalcInput, step = 10) {
  return curveData(input, step).filter((p) => p.value % step === 0);
}
