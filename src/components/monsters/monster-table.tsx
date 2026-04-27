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
import { monsterTypeLabel } from "@/lib/constants/monster-type";
import type { MonsterSummary } from "@/lib/types/monster";

interface MonsterTableProps {
  monsters: MonsterSummary[];
  sort: SortContext;
}

export function MonsterTable({ monsters, sort }: MonsterTableProps) {
  if (monsters.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-card px-6 py-12 text-center text-muted-foreground">
        找不到符合條件的怪物
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow>
            <SortableHead column="id" label="編號" className="w-[90px]" sort={sort} />
            <TableHead>名稱</TableHead>
            <TableHead className="w-[120px]">類型</TableHead>
            <TableHead className="w-[70px]">屬性</TableHead>
            <SortableHead column="level" label="等級" className="w-[80px]" right sort={sort} />
            <SortableHead column="hp" label="血量" className="w-[100px]" right sort={sort} />
            <TableHead className="w-[80px]">掉落</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {monsters.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-mono text-xs text-muted-foreground">{m.id}</TableCell>
              <TableCell>
                <Link href={`/monsters/${m.id}`} className="font-medium hover:underline">
                  {m.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{monsterTypeLabel(m.type)}</TableCell>
              <TableCell>
                {m.elemental ? (
                  <Badge variant="outline" className="font-normal">
                    {m.elemental}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">{m.level}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {m.hp != null ? m.hp.toLocaleString() : "—"}
              </TableCell>
              <TableCell>
                {m.hasDrop ? (
                  <Badge variant="secondary" className="font-normal">
                    有
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">無</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
