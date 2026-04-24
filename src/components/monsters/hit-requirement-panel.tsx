import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSkillHitInfoBatch } from "@/lib/queries/magic";
import { SKILL_PICKS, type SkillSchool } from "@/lib/constants/skill-picks";
import { computeHitRequirement } from "@/lib/calc/hit-requirement";
import { SchoolSelect } from "@/components/monsters/school-select";

interface HitRequirementPanelProps {
  dodge: number | null;
  school: SkillSchool;
}

export function HitRequirementPanel({ dodge, school }: HitRequirementPanelProps) {
  // 怪物沒閃躲資料 → 算不出命中需求，仍保留 header 讓玩家知道有這個功能只是不適用
  if (dodge == null || dodge <= 0) {
    return (
      <div className="space-y-2">
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <PanelHeader school={school} />
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            此怪物沒有閃躲資料
          </div>
        </div>
      </div>
    );
  }

  const picks = SKILL_PICKS[school];
  const hitInfo = getSkillHitInfoBatch(picks);

  const rows = hitInfo.map((info) => {
    const req = computeHitRequirement(dodge, info.minP1, info.maxP1);
    return { ...info, ...req };
  });

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <PanelHeader school={school} />
        <Table className="min-w-[480px]">
          <TableHeader>
            <TableRow>
              <TableHead>技能</TableHead>
              <TableHead className="w-[110px] text-right">命中率</TableHead>
              <TableHead className="w-[120px] text-right">需撐命中</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                  此流派暫無可算命中的技能
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={`${r.id}-${r.name}`}>
                  <TableCell>
                    <Link
                      href={`/skills/${r.id}?level=${r.firstLevel}`}
                      className="font-medium hover:underline"
                    >
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {r.minP1 === r.maxP1 ? r.minP1 : `${r.minP1}–${r.maxP1}`}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {r.minRequired === r.maxRequired
                      ? r.minRequired.toLocaleString()
                      : `${r.minRequired.toLocaleString()}–${r.maxRequired.toLocaleString()}`}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        此怪閃躲 {dodge.toLocaleString()}，需撐命中 = 怪閃 × 100 ÷ 技能命中率（無條件進位）；技能跨級若有成長則顯示範圍。
      </p>
    </div>
  );
}

function PanelHeader({ school }: { school: SkillSchool }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-card px-4 py-2">
      <span className="text-sm font-medium">命中需求 · {school}</span>
      <SchoolSelect value={school} />
    </div>
  );
}
