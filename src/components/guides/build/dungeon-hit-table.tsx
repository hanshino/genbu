import Link from "next/link";
import { computeHitRequirement } from "@/lib/calc/hit-requirement";
import { getDungeonMonsterIds } from "@/lib/dungeon-monsters";
import { getGuideRef } from "@/lib/guide-refs";
import { getBuildSkills } from "@/lib/queries/build-calc";
import { getMonsterById } from "@/lib/queries/monsters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { GuideRefTag } from "../guide-ref-tag";

/**
 * 迷宮攻略裡每個副本最難打中的怪，與用指定招式打中它要撐的命中。
 * 怪物取自攻略內文（Monster 標籤、地圖上標的王），寶箱、機關閃躲只有個位數，取最大值時自然排除。
 * skills 是 [技能 id, 技能等級]；多招時每招一欄，依第一招排序。
 */
export function DungeonHitTable({ skills }: { skills: [number, number][] }) {
  const cols = skills.flatMap(([id, level]) => {
    const s = getBuildSkills([id])[0];
    const lv = s?.levels.find((l) => l.level === level);
    return s && lv ? [{ id, name: s.name, level, hit: lv.hit }] : [];
  });
  if (cols.length === 0) return null;
  const many = cols.length > 1;

  const rows = getDungeonMonsterIds()
    .map(({ guide, ids }) => {
      const hardest = ids
        .map(getMonsterById)
        .filter((m) => m != null && (m.base_dodge ?? 0) > 0)
        .reduce<ReturnType<typeof getMonsterById>>(
          (best, m) => (best && (best.base_dodge ?? 0) >= (m!.base_dodge ?? 0) ? best : m),
          null,
        );
      if (!hardest?.base_dodge) return null;
      const dodge = hardest.base_dodge;
      const needs = cols.map((c) => computeHitRequirement(dodge, c.hit, c.hit).minRequired);
      return { guide, monster: hardest, dodge, needs };
    })
    .filter((r) => r != null)
    .sort((a, b) => a.needs[0] - b.needs[0]);

  const head = "bg-muted/60 font-heading";
  return (
    <div className="bg-card my-5 overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={head}>副本</TableHead>
            <TableHead className={head}>最難打中的怪</TableHead>
            <TableHead className={cn(head, "hidden text-right sm:table-cell")}>閃躲</TableHead>
            {cols.map((c) => (
              <TableHead key={c.id} className={cn(head, "text-right")}>
                {many ? c.name : "需撐命中"}
                <span className="text-muted-foreground block text-[11px] font-normal">
                  {many ? `命中率 ${c.hit}%` : `${c.name} Lv${c.level}（${c.hit}%）`}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ guide, monster, dodge, needs }) => {
            const ref = getGuideRef("monster", monster.id);
            return (
              <TableRow key={guide.slug}>
                <TableCell className="whitespace-normal">
                  <Link
                    href={`/guides/${guide.slug}`}
                    className="text-primary decoration-primary/40 hover:decoration-primary underline underline-offset-4"
                  >
                    {guide.title}
                  </Link>
                  {guide.levelMin != null && (
                    <span className="text-muted-foreground ml-1.5 text-xs whitespace-nowrap tabular-nums">
                      {guide.levelMin} 級
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-normal">
                  {ref ? <GuideRefTag data={ref}>{monster.name}</GuideRefTag> : monster.name}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {dodge.toLocaleString()}
                </TableCell>
                {needs.map((n, i) => (
                  <TableCell key={cols[i].id} className="text-right font-medium tabular-nums">
                    {n.toLocaleString()}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
