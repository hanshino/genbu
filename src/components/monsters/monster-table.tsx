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
import { SpawnMapsCell } from "@/components/monsters/spawn-maps-cell";
import { EntityPortrait } from "@/components/common/entity-portrait";
import { EmptyResult } from "@/components/common/empty-result";
import { monsterTypeLabel } from "@/lib/constants/monster-type";
import type { MonsterSummary } from "@/lib/types/monster";
import type { MonsterStageSpawn } from "@/lib/types/monster-spawn";
import type { EntityImage } from "@/lib/queries/images";
import { MONSTER_COLUMNS, type MonsterColumnKey } from "@/lib/constants/monster-columns";
import { NumericCell, STICKY_ID_COL, stickyNameCol } from "@/components/common/column-cells";
import { cn } from "@/lib/utils";

interface MonsterTableProps {
  monsters: MonsterSummary[];
  sort: SortContext;
  spawnsByMonster: Map<number, MonsterStageSpawn[]>;
  portraitMap: Map<number, EntityImage>;
  search?: string;
  unfilteredTotal?: number;
  columns: readonly MonsterColumnKey[];
}

export function MonsterTable({
  monsters,
  sort,
  spawnsByMonster,
  portraitMap,
  search = "",
  unfilteredTotal,
  columns,
}: MonsterTableProps) {
  if (monsters.length === 0) {
    return (
      <EmptyResult
        noun="怪物"
        search={search}
        unfilteredTotal={unfilteredTotal}
        basePath="/monsters"
      />
    );
  }

  const show = new Set(columns);
  const numericCols = MONSTER_COLUMNS.numeric.filter((c) => show.has(c.key));
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
            {show.has("spawns") && <TableHead className="hidden md:table-cell">出沒地點</TableHead>}
            {show.has("type") && <TableHead className="w-[120px]">類型</TableHead>}
            {show.has("elemental") && <TableHead className="w-[70px]">屬性</TableHead>}
            {show.has("level") && (
              <SortableHead column="level" label="等級" className="w-[80px]" right sort={sort} />
            )}
            {show.has("hp") && (
              <SortableHead column="hp" label="血量" className="w-[100px]" right sort={sort} />
            )}
            {show.has("hasDrop") && <TableHead className="w-[80px]">掉落</TableHead>}
            {numericCols.map((c) => (
              <SortableHead key={c.key} column={c.key} label={c.label} right sort={sort} />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {monsters.map((m) => (
            <TableRow key={m.id} className="group/row">
              {show.has("id") && (
                <TableCell className={cn("font-mono text-xs text-muted-foreground", STICKY_ID_COL)}>
                  {m.id}
                </TableCell>
              )}
              <TableCell className={nameCol}>
                <div className="flex items-center gap-2">
                  <EntityPortrait image={portraitMap.get(m.id) ?? null} alt={m.name} size="sm" />
                  <Link href={`/monsters/${m.id}`} className="font-medium hover:underline">
                    {m.name}
                  </Link>
                </div>
              </TableCell>
              {show.has("spawns") && (
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  <SpawnMapsCell spawns={spawnsByMonster.get(m.id)} />
                </TableCell>
              )}
              {show.has("type") && (
                <TableCell className="text-muted-foreground">{monsterTypeLabel(m.type)}</TableCell>
              )}
              {show.has("elemental") && (
                <TableCell>
                  {m.elemental ? (
                    <Badge variant="outline" className="font-normal">
                      {m.elemental}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              )}
              {show.has("level") && (
                <TableCell className="text-right font-mono tabular-nums">{m.level}</TableCell>
              )}
              {show.has("hp") && (
                <TableCell className="text-right font-mono tabular-nums">
                  {m.hp != null ? m.hp.toLocaleString() : "—"}
                </TableCell>
              )}
              {show.has("hasDrop") && (
                <TableCell>
                  {m.hasDrop ? (
                    <Badge variant="secondary" className="font-normal">
                      有
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">無</span>
                  )}
                </TableCell>
              )}
              {numericCols.map((c) => (
                <NumericCell key={c.key} value={m[c.key]} />
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
