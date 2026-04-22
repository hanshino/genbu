import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MonsterDropSource } from "@/lib/types/monster";

export function ItemDropList({ sources }: { sources: MonsterDropSource[] }) {
  if (sources.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">掉落來源</h2>
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[90px]">編號</TableHead>
              <TableHead>怪物</TableHead>
              <TableHead className="w-[80px] text-right">等級</TableHead>
              <TableHead className="w-[120px] text-right">掉落率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{m.id}</TableCell>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="text-right">{m.level}</TableCell>
                <TableCell className="text-right font-mono">{m.rate.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">掉落率為遊戲原始數值，數值越高機率越大</p>
    </section>
  );
}
