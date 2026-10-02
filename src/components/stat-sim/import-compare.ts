import { ATTRIBUTE_KEYS, type PanelResult, type PanelStatKey } from "@/lib/types/stat-sim";
import type { ImportPanel } from "@/lib/types/stat-sim-import";
import type { ImportCompareRow } from "./import-compare-card";
import { STAT_LABELS } from "./labels";

const GROUPS: Array<[string, PanelStatKey[]]> = [
  ["生存", ["hp", "mp"]],
  ["攻防", ["atk", "matk", "def", "mdef"]],
  ["命中與迴避", ["hit", "dodge", "critical", "uncanny_dodge"]],
  ["其他", ["attack_speed", "run_speed", "weight_cap"]],
];

/** weaponTypes 為選填的目前裝備上下文；只有面板本身時仍可依引擎估計原因辨識遠程。 */
export function buildCompareRows(
  panel: ImportPanel, result: PanelResult, weaponTypes: string[] = [],
): ImportCompareRow[] {
  const rows: ImportCompareRow[] = [];
  for (const key of ATTRIBUTE_KEYS) {
    const game = panel.attributes?.[key];
    if (game === undefined) continue;
    const sim = result.attributes[key].value;
    rows.push({ key, label: STAT_LABELS[key], group: "六圍", game, sim,
      ...(sim !== null && game !== sim ? { reason: "可能有屬性丹藥" } : {}),
    });
  }
  for (const [group, keys] of GROUPS) {
    for (const key of keys) {
      const game = panel.stats?.[key];
      if (game === undefined) continue;
      const stat = result.stats[key];
      const sim = stat.value;
      const reasons: string[] = [];
      if (sim === null || game !== sim) {
        if (["atk", "matk", "def", "mdef", "hp", "mp"].includes(key)) {
          reasons.push("英雄／陣法、符類藥水或經脈");
        }
        if (key === "weight_cap") reasons.push("已知誤差，生效中的藥水也會增加");
        if (key === "atk" && (weaponTypes.some((type) => ["BOW", "HIDDEN_WEAPON"].includes(type)) ||
          stat.estimateReasons.some((reason) => reason.includes("遠程物攻")))) reasons.push("遠程物攻公式未定");
        if (key === "attack_speed" && (weaponTypes.some((type) => type !== "SHIELD") ||
          stat.estimateReasons.some((reason) => reason.includes("武器攻速")))) reasons.push("攻速換算未解");
      }
      rows.push({ key, label: STAT_LABELS[key], group, game, sim,
        ...(reasons.length ? { reason: reasons.join("；") } : {}),
      });
    }
  }
  return rows;
}
