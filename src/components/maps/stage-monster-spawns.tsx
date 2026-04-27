import { LinkListRow, LinkListSection } from "@/components/common/link-list";
import type { StageMonsterSpawn } from "@/lib/types/monster-spawn";

interface Props {
  monsters: StageMonsterSpawn[];
}

export function StageMonsterSpawns({ monsters }: Props) {
  if (monsters.length === 0) return null;

  const totalPoints = monsters.reduce((s, m) => s + m.spawnPoints, 0);

  return (
    <LinkListSection
      title="怪物出沒"
      summary={`${monsters.length} 種 · 共 ${totalPoints} 個刷怪點`}
      footer="×N 為該怪物在此地圖的刷怪點數量（GENERATOR.OBD 解析）。"
    >
      {monsters.map((m) => (
        <LinkListRow key={m.npcId} href={`/monsters/${m.npcId}`}>
          <span className="font-mono text-xs text-muted-foreground">#{m.npcId}</span>
          <span className="font-medium">{m.name}</span>
          <span className="text-xs text-muted-foreground">Lv {m.level}</span>
          {m.hp != null && m.hp > 0 && (
            <span className="font-mono text-xs text-muted-foreground">
              HP {m.hp.toLocaleString()}
            </span>
          )}
          <span className="ml-auto font-mono text-xs text-muted-foreground">×{m.spawnPoints}</span>
        </LinkListRow>
      ))}
    </LinkListSection>
  );
}
