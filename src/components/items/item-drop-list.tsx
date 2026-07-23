import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MonsterDropSource } from "@/lib/types/monster";
import type { MonsterStageSpawn } from "@/lib/types/monster-spawn";

const MAX_SPAWN_MAPS_SHOWN = 3;

function SpawnMapsCell({ spawns }: { spawns: MonsterStageSpawn[] | undefined }) {
  if (!spawns || spawns.length === 0) return <>—</>;
  const shown = spawns.slice(0, MAX_SPAWN_MAPS_SHOWN);
  return (
    <>
      {shown.map((s, i) => (
        <span key={`${s.stageKind}-${s.stageId}`}>
          {i > 0 && "、"}
          <Link href={`/maps/${s.stageId}`} className="hover:underline">
            {s.stageName ?? "未知地圖"}
          </Link>
        </span>
      ))}
      {spawns.length > MAX_SPAWN_MAPS_SHOWN && `…等 ${spawns.length} 張`}
    </>
  );
}

export function ItemDropList({
  sources,
  spawnsByMonster,
}: {
  sources: MonsterDropSource[];
  spawnsByMonster: Map<number, MonsterStageSpawn[]>;
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
                  <Link href={`/monsters/${m.id}`} className="font-medium hover:underline">
                    {m.name}
                  </Link>
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
