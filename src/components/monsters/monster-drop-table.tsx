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
import type { MonsterDropItem } from "@/lib/types/monster";

interface MonsterDropTableProps {
  drops: MonsterDropItem[];
}

export function MonsterDropTable({ drops }: MonsterDropTableProps) {
  if (drops.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-card px-6 py-12 text-center text-muted-foreground">
        無掉落資料
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <div className="border-b border-border/60 bg-card px-4 py-2 text-sm font-medium">
        掉落物 · 共 {drops.length} 項
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[90px]">編號</TableHead>
            <TableHead>名稱</TableHead>
            <TableHead className="w-[120px]">類型</TableHead>
            <TableHead className="w-[70px] text-right">等級</TableHead>
            <TableHead className="w-[90px] text-right">機率</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drops.map((d) => (
            <TableRow key={d.itemId}>
              <TableCell className="font-mono text-xs text-muted-foreground">{d.itemId}</TableCell>
              <TableCell>
                {d.name ? (
                  <Link href={`/items/${d.itemId}`} className="font-medium hover:underline">
                    {d.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">（道具資料缺失）</span>
                )}
              </TableCell>
              <TableCell>
                {d.type ? (
                  <Badge variant="secondary" className="font-normal">
                    {d.type}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {d.level != null ? d.level : "—"}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">{d.rate}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
