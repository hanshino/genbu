import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SpawnMapsCell } from "@/components/monsters/spawn-maps-cell";
import { EntityPortrait } from "@/components/common/entity-portrait";
import type { MonsterDropSource } from "@/lib/types/monster";
import type { MonsterStageSpawn } from "@/lib/types/monster-spawn";
import type { EntityImage } from "@/lib/queries/images";

export function ItemDropList({
  sources,
  spawnsByMonster,
  portraitMap,
}: {
  sources: MonsterDropSource[];
  spawnsByMonster: Map<number, MonsterStageSpawn[]>;
  portraitMap: Map<number, EntityImage>;
}) {
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
              <TableHead>出沒地圖</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{m.id}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <EntityPortrait
                      image={portraitMap.get(m.id) ?? null}
                      alt={m.name}
                      size="sm"
                    />
                    <Link href={`/monsters/${m.id}`} className="font-medium hover:underline">
                      {m.name}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className="text-right">{m.level}</TableCell>
                <TableCell className="text-right font-mono">{m.rate.toLocaleString()}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <SpawnMapsCell spawns={spawnsByMonster.get(m.id)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">掉落率為遊戲原始數值，數值越高機率越大</p>
    </section>
  );
}
