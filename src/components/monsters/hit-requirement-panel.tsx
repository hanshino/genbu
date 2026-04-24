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
  // 怪物沒記閃躲值 → 無法算命中需求，只顯示說明讓玩家知道為什麼空著
  if (dodge == null || dodge <= 0) {
    return (
      <section className="space-y-2">
        <PanelHeader school={school} />
        <div className="rounded-lg border border-border/60 bg-card px-6 py-8 text-center text-sm text-muted-foreground">
          此怪物沒有閃躲資料
        </div>
      </section>
    );
  }

  const picks = SKILL_PICKS[school];
  const hitInfo = getSkillHitInfoBatch(picks);

  const rows = hitInfo.map((info) => {
    const req = computeHitRequirement(dodge, info.minP1, info.maxP1);
    return { ...info, ...req };
  });

  return (
    <section className="space-y-2">
      <PanelHeader school={school} />
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <Table className="min-w-[480px]">
          <TableHeader>
            <TableRow>
              <TableHead>技能</TableHead>
              <TableHead className="w-[110px] text-right">命中率參數1</TableHead>
              <TableHead className="w-[120px] text-right">需要命中</TableHead>
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
                    {r.minP1 === r.maxP1 ? r.minP1 : `${r.minP1}→${r.maxP1}`}
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
        閃躲 {dodge.toLocaleString()} · 公式：需要命中 = ⌈怪閃 × 100 ÷ 命中率參數1⌉；跨級成長的技能顯示範圍（p1 越高需命中越低）。
      </p>
    </section>
  );
}

function PanelHeader({ school }: { school: SkillSchool }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">命中需求</h2>
      <SchoolSelect value={school} />
    </div>
  );
}
