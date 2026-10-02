import { STAT_LABELS, formatStat } from "@/lib/meridian-sim";
import type { MeridianStatFlag } from "@/lib/types/meridian";

const nf = new Intl.NumberFormat("zh-TW");
export const fmt = (n: number) => nf.format(Math.round(n));

export function fmtExp(n: number) {
  if (n <= 0) return "0";
  const yi = n / 1e8;
  return (yi >= 100 ? fmt(yi) : yi.toFixed(1).replace(/\.0$/, "")) + " 億";
}

export const statName = (s: string) => STAT_LABELS[s] ?? s;

/** formatStat 會帶標籤（「物攻 +5」），表格與遊戲視窗只要數值那段。 */
export function statValue(stat: string, value: number, flag: MeridianStatFlag) {
  const full = formatStat(stat, value, flag);
  const prefix = `${statName(stat)} `;
  return full.startsWith(prefix) ? full.slice(prefix.length) : full;
}
