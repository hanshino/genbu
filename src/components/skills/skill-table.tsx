import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { magicClanListLabel } from "@/lib/constants/magic-clan";
import { magicTargetLabel } from "@/lib/constants/magic-target";
import { magicAttribLabel, MAGIC_ATTRIB_COLOR } from "@/lib/constants/magic-attrib";
import { magicSkillTypeLabel } from "@/lib/constants/magic-skill-type";
import type { MagicSummary } from "@/lib/types/magic";

export function SkillTable({ skills }: { skills: MagicSummary[] }) {
  if (skills.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-card px-6 py-12 text-center text-muted-foreground">
        找不到符合條件的技能
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[90px]">編號</TableHead>
            <TableHead>名稱</TableHead>
            <TableHead className="w-[120px]">門派</TableHead>
            <TableHead className="w-[110px]">分類</TableHead>
            <TableHead className="w-[120px]">作用目標</TableHead>
            <TableHead className="w-[70px]">屬性</TableHead>
            <TableHead className="w-[80px] text-right">最高 Lv</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {skills.map((s) => {
            const attribLabel = magicAttribLabel(s.attrib);
            const attribColor = s.attrib != null ? MAGIC_ATTRIB_COLOR[s.attrib] : null;
            const clanDisplay = magicClanListLabel(s.clan, s.skill_type);
            return (
              <TableRow key={`${s.id}-${s.firstLevel}`}>
                <TableCell className="font-mono text-xs text-muted-foreground">{s.id}</TableCell>
                <TableCell>
                  <Link
                    href={`/skills/${s.id}?level=${s.firstLevel}`}
                    className="font-medium hover:underline"
                  >
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {clanDisplay.kind === "clan" ? (
                    <Badge variant="secondary" className="font-normal">
                      {clanDisplay.label}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">{clanDisplay.label}</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {magicSkillTypeLabel(s.skill_type)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {magicTargetLabel(s.target)}
                </TableCell>
                <TableCell>
                  {attribLabel ? (
                    <Badge variant="outline" className={`font-normal ${attribColor ?? ""}`}>
                      {attribLabel}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{s.maxLevel}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
