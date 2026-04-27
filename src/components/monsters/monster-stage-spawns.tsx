import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { MonsterStageSpawn } from "@/lib/types/monster-spawn";

interface Props {
  spawns: MonsterStageSpawn[];
}

export function MonsterStageSpawns({ spawns }: Props) {
  if (spawns.length === 0) return null;

  const totalPoints = spawns.reduce((s, x) => s + x.spawnPoints, 0);

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">出沒地圖</h2>
        <span className="text-xs text-muted-foreground">
          {spawns.length} 張地圖 · 共 {totalPoints} 個刷怪點
        </span>
      </div>
      <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
        {spawns.map((s) => (
          <li key={`${s.stageKind}:${s.stageId}`}>
            <Link
              href={`/maps/${s.stageId}`}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 transition-colors hover:bg-muted/50"
            >
              <span className="font-mono text-xs text-muted-foreground">#{s.stageId}</span>
              <span className="font-medium">{s.stageName ?? `地圖 ${s.stageId}`}</span>
              {s.stageKind === "sestage" && (
                <Badge variant="outline" className="font-normal">
                  SE 地圖
                </Badge>
              )}
              {s.groupId != null && (
                <Badge variant="outline" className="font-normal">
                  區域 #{s.groupId}
                </Badge>
              )}
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                ×{s.spawnPoints}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        ×N 為該地圖上此怪的刷怪點數量（GENERATOR.OBD 解析）。
      </p>
    </section>
  );
}
