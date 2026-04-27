import { Badge } from "@/components/ui/badge";
import { LinkListRow, LinkListSection } from "@/components/common/link-list";
import type { MonsterStageSpawn } from "@/lib/types/monster-spawn";

interface Props {
  spawns: MonsterStageSpawn[];
}

export function MonsterStageSpawns({ spawns }: Props) {
  if (spawns.length === 0) return null;

  const totalPoints = spawns.reduce((s, x) => s + x.spawnPoints, 0);

  return (
    <LinkListSection
      title="出沒地圖"
      summary={`${spawns.length} 張地圖 · 共 ${totalPoints} 個刷怪點`}
      footer="×N 為該地圖上此怪的刷怪點數量（GENERATOR.OBD 解析）。"
    >
      {spawns.map((s) => (
        <LinkListRow key={`${s.stageKind}:${s.stageId}`} href={`/maps/${s.stageId}`}>
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
          <span className="ml-auto font-mono text-xs text-muted-foreground">×{s.spawnPoints}</span>
        </LinkListRow>
      ))}
    </LinkListSection>
  );
}
