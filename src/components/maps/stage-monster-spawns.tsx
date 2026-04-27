import Link from "next/link";
import type { StageMonsterSpawn } from "@/lib/types/monster-spawn";

interface Props {
  monsters: StageMonsterSpawn[];
}

export function StageMonsterSpawns({ monsters }: Props) {
  if (monsters.length === 0) return null;

  const totalPoints = monsters.reduce((s, m) => s + m.spawnPoints, 0);

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">怪物出沒</h2>
        <span className="text-xs text-muted-foreground">
          {monsters.length} 種 · 共 {totalPoints} 個刷怪點
        </span>
      </div>
      <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
        {monsters.map((m) => (
          <li key={m.npcId}>
            <Link
              href={`/monsters/${m.npcId}`}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 transition-colors hover:bg-muted/50"
            >
              <span className="font-mono text-xs text-muted-foreground">#{m.npcId}</span>
              <span className="font-medium">{m.name}</span>
              <span className="text-xs text-muted-foreground">Lv {m.level}</span>
              {m.hp != null && m.hp > 0 && (
                <span className="font-mono text-xs text-muted-foreground">
                  HP {m.hp.toLocaleString()}
                </span>
              )}
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                ×{m.spawnPoints}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        ×N 為該怪物在此地圖的刷怪點數量（GENERATOR.OBD 解析）。
      </p>
    </section>
  );
}
