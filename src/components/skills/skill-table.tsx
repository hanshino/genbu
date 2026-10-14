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
import { SortableHead, type SortContext } from "@/components/common/sortable-head";
import { EmptyResult } from "@/components/common/empty-result";
import { magicClanListLabel } from "@/lib/constants/magic-clan";
import { magicTargetLabel } from "@/lib/constants/magic-target";
import { magicAttribLabel, MAGIC_ATTRIB_COLOR } from "@/lib/constants/magic-attrib";
import { magicSkillTypeLabel } from "@/lib/constants/magic-skill-type";
import type { MagicSummary } from "@/lib/types/magic";
import { ItemIcon } from "@/components/common/item-icon";
import { pickMagicIcon, type EntityImage } from "@/lib/queries/images";
import { SKILL_COLUMNS, type SkillColumnKey } from "@/lib/constants/skill-columns";
import { NumericCell, STICKY_ID_COL, stickyNameCol } from "@/components/common/column-cells";
import { cn } from "@/lib/utils";

interface SkillTableProps {
  skills: MagicSummary[];
  sort: SortContext;
  search?: string;
  unfilteredTotal?: number;
  iconMap: Map<number, Map<number, EntityImage>>;
  columns: readonly SkillColumnKey[];
}

export function SkillTable({
  skills,
  sort,
  search = "",
  unfilteredTotal,
  iconMap,
  columns,
}: SkillTableProps) {
  if (skills.length === 0) {
    return (
      <EmptyResult
        noun="技能"
        search={search}
        unfilteredTotal={unfilteredTotal}
        basePath="/skills"
      />
    );
  }

  const show = new Set(columns);
  const numericCols = SKILL_COLUMNS.numeric.filter((c) => show.has(c.key));
  const nameCol = stickyNameCol(show.has("id"));

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <Table>
        <TableHeader>
          <TableRow className="group/row">
            {show.has("id") && (
              <SortableHead column="id" label="編號" className={STICKY_ID_COL} sort={sort} />
            )}
            <TableHead className={nameCol}>名稱</TableHead>
            {show.has("clan") && <TableHead className="w-[120px]">門派</TableHead>}
            {show.has("skillType") && <TableHead className="w-[110px]">分類</TableHead>}
            {show.has("target") && <TableHead className="w-[120px]">作用目標</TableHead>}
            {show.has("attrib") && <TableHead className="w-[70px]">屬性</TableHead>}
            {show.has("maxLevel") && (
              <SortableHead
                column="maxLevel"
                label="最高 Lv"
                className="w-[80px]"
                right
                sort={sort}
              />
            )}
            {numericCols.map((c) => (
              <SortableHead
                key={c.key}
                column={c.key}
                label={c.label}
                hint="最高等級數值"
                right
                sort={sort}
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {skills.map((s) => {
            const attribLabel = magicAttribLabel(s.attrib);
            const attribColor = s.attrib != null ? MAGIC_ATTRIB_COLOR[s.attrib] : null;
            const clanDisplay = magicClanListLabel(s.clan, s.skill_type);
            return (
              <TableRow key={`${s.id}-${s.firstLevel}`} className="group/row">
                {show.has("id") && (
                  <TableCell
                    className={cn("font-mono text-xs text-muted-foreground", STICKY_ID_COL)}
                  >
                    {s.id}
                  </TableCell>
                )}
                <TableCell className={nameCol}>
                  <Link
                    href={`/skills/${s.id}?level=${s.firstLevel}`}
                    className="group/name inline-flex items-center gap-2.5 font-medium"
                  >
                    <ItemIcon
                      image={pickMagicIcon(iconMap.get(s.id), s.firstLevel)}
                      alt=""
                      className="size-8 transition-colors group-hover/name:border-primary/50"
                    />
                    <span className="group-hover/name:underline">{s.name}</span>
                  </Link>
                </TableCell>
                {show.has("clan") && (
                  <TableCell>
                    {clanDisplay.kind === "clan" ? (
                      <Badge variant="secondary" className="font-normal">
                        {clanDisplay.label}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">{clanDisplay.label}</span>
                    )}
                  </TableCell>
                )}
                {show.has("skillType") && (
                  <TableCell className="text-muted-foreground">
                    {magicSkillTypeLabel(s.skill_type)}
                  </TableCell>
                )}
                {show.has("target") && (
                  <TableCell className="text-muted-foreground">
                    {magicTargetLabel(s.target)}
                  </TableCell>
                )}
                {show.has("attrib") && (
                  <TableCell>
                    {attribLabel ? (
                      <Badge variant="outline" className={`font-normal ${attribColor ?? ""}`}>
                        {attribLabel}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}
                {show.has("maxLevel") && (
                  <TableCell className="text-right font-mono tabular-nums">{s.maxLevel}</TableCell>
                )}
                {numericCols.map((c) => (
                  <NumericCell key={c.key} value={s[c.key]} />
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
