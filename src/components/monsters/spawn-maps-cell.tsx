import Link from "next/link";
import type { MonsterStageSpawn } from "@/lib/types/monster-spawn";

export const MAX_SPAWN_MAPS_SHOWN = 3;

export function SpawnMapsCell({ spawns }: { spawns: MonsterStageSpawn[] | undefined }) {
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
