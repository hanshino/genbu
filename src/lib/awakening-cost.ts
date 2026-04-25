import type { AwakeningBonus, AwakeningStage } from "@/lib/types/awakening";

export interface CumulativeRow {
  stage: number;
  stageMoney: number;
  stageProb: number;
  materialName: string;
  materialAmount: number;
  bonuses: AwakeningBonus[];
  cumulativeBest: number;
  cumulativeExpected: number;
  /** 各覺醒符累計次數，最佳情況（不含失敗重抽） */
  cumulativeMaterials: Record<string, number>;
}

export function computeCumulative(stages: AwakeningStage[]): CumulativeRow[] {
  const rows: CumulativeRow[] = [];
  let runningBest = 0;
  let runningExpected = 0;
  const runningMaterials: Record<string, number> = {};

  for (const s of stages) {
    runningBest += s.money;
    runningExpected += s.successProb > 0 ? s.money / s.successProb : Infinity;
    runningMaterials[s.materialName] = (runningMaterials[s.materialName] ?? 0) + s.materialAmount;

    rows.push({
      stage: s.stage,
      stageMoney: s.money,
      stageProb: s.successProb,
      materialName: s.materialName,
      materialAmount: s.materialAmount,
      bonuses: s.bonuses,
      cumulativeBest: runningBest,
      cumulativeExpected: runningExpected,
      cumulativeMaterials: { ...runningMaterials },
    });
  }

  return rows;
}
