import Link from "next/link";
import { MapPinIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkListRow, LinkListSection } from "@/components/common/link-list";
import type { NpcMap, NpcMission } from "@/lib/types/npc";

const EVENT_LABEL: Record<string, string> = {
  accept: "接取",
  set_step: "設定進度",
  step_done: "步驟",
  complete: "完成",
  reset: "重置",
  timer35: "計時",
  timer36: "計時",
};

function mapHref(stageId: number, placementId?: number) {
  return placementId == null ? `/maps/${stageId}` : `/maps/${stageId}?npc=${placementId}`;
}

export function NpcMapsSection({ maps }: { maps: NpcMap[] }) {
  return (
    <LinkListSection title="出現地圖" summary="點地圖會標出 NPC 所在位置">
      {maps.map((m) => {
        const name = m.stageName ?? `地圖 #${m.stageId}`;
        const multi = m.placements.length > 1;
        return (
          <li key={`${m.stageKind}:${m.stageId}`} className="flex flex-wrap items-center gap-x-3">
            <Link
              href={mapHref(m.stageId, m.placements[0]?.placementId)}
              className="flex min-w-0 flex-1 items-baseline gap-x-3 px-4 py-2.5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
            >
              <span className="font-medium">{name}</span>
              {m.stageKind === "sestage" && (
                <Badge variant="outline" className="font-normal">
                  SE 地圖
                </Badge>
              )}
              <span className="ml-auto font-mono text-xs text-muted-foreground">#{m.stageId}</span>
            </Link>
            {/* 同一張地圖站多個點時各給一個入口；整列連結預設帶第 1 個 */}
            {multi && (
              <span className="flex flex-wrap gap-1 px-4 pb-2.5 sm:pb-0 sm:pl-0">
                {m.placements.map((p, i) => (
                  <Link
                    key={p.placementId}
                    href={mapHref(m.stageId, p.placementId)}
                    aria-label={`${name} 位置 ${i + 1}`}
                    className="inline-flex items-center gap-0.5 rounded-md border border-border/60 px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MapPinIcon className="size-3" aria-hidden />
                    {i + 1}
                  </Link>
                ))}
              </span>
            )}
          </li>
        );
      })}
    </LinkListSection>
  );
}

export function NpcMissionsSection({ missions }: { missions: NpcMission[] }) {
  if (missions.length === 0) return null;
  const byName = missions.some((m) => m.association === "name");
  return (
    <LinkListSection
      title="相關任務"
      summary={`${missions.length} 個任務`}
      footer={byName ? "標「依名稱比對」的任務是用 NPC 名稱對上的，可能是同名的其他 NPC。" : undefined}
    >
      {missions.map((m) => (
        <LinkListRow key={m.missionId} href={`/missions/${m.missionId}`}>
          <span className="font-medium">{m.missionName ?? `任務 #${m.missionId}`}</span>
          <span className="flex flex-wrap gap-1">
            {[...new Set(m.eventTypes.map((e) => EVENT_LABEL[e] ?? e))].map((label) => (
              <Badge key={label} variant="secondary" className="font-normal">
                {label}
              </Badge>
            ))}
          </span>
          {m.association === "name" && (
            <span className="ml-auto text-xs text-muted-foreground/80">依名稱比對</span>
          )}
        </LinkListRow>
      ))}
    </LinkListSection>
  );
}
