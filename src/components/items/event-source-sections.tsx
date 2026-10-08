import { LinkListRow } from "@/components/common/link-list";
import { TimedBadge } from "@/components/common/reward-view";
import { ItemLinkList, ItemSubSection } from "@/components/items/item-section-group";
import type { NpcDialogueItem } from "@/lib/types/mission-logic";
import type { MapEventItemSource } from "@/lib/types/stage";

export function NpcDialogueSourcesSection({ rewards }: { rewards: NpcDialogueItem[] }) {
  if (rewards.length === 0) return null;
  const count = new Set(rewards.map((r) => r.npcName)).size;
  return (
    <ItemSubSection title="NPC 對話" summary={`${count} 位 NPC 對話中給予`}>
      <ItemLinkList>
        {rewards.map((r, i) => (
          <LinkListRow key={i} href={r.npcId == null ? undefined : `/npcs/${r.npcId}`}>
            <span className="font-medium">{r.npcName || "未收錄 NPC"}</span>
            {r.durationMin != null && <TimedBadge durationMin={r.durationMin} />}
            {r.qty != null && <span className="ml-auto font-mono text-xs text-muted-foreground">×{r.qty}</span>}
          </LinkListRow>
        ))}
      </ItemLinkList>
    </ItemSubSection>
  );
}

export function NpcDialogueUsesSection({ takes }: { takes: NpcDialogueItem[] }) {
  if (takes.length === 0) return null;
  const count = new Set(takes.map((t) => t.npcName)).size;
  return (
    <ItemSubSection title="NPC 對話中收走" summary={`${count} 位 NPC 對話中收走`}>
      <ItemLinkList>
        {takes.map((t, i) => (
          <LinkListRow key={i} href={t.npcId == null ? undefined : `/npcs/${t.npcId}`}>
            <span className="font-medium">{t.npcName || "未收錄 NPC"}</span>
            {t.qty != null && (
              <span className="ml-auto font-mono text-xs text-muted-foreground">收走 ×{t.qty}</span>
            )}
          </LinkListRow>
        ))}
      </ItemLinkList>
    </ItemSubSection>
  );
}

export function MapEventSourcesSection({ sources }: { sources: MapEventItemSource[] }) {
  if (sources.length === 0) return null;
  return (
    <ItemSubSection
      title="地圖事件"
      summary={`${sources.length} 張地圖`}
      footer="事件可能另有條件限制，實際觸發方式以遊戲內為準。"
    >
      <ItemLinkList>
        {sources.map((s) => (
          <LinkListRow key={`${s.stageKind}:${s.stageId}`} href={`/maps/${s.stageId}`}>
            <span className="font-mono text-xs text-muted-foreground">#{s.stageId}</span>
            <span className="font-medium">{s.stageName ?? `地圖 ${s.stageId}`}</span>
            {s.rewards.map((r, i) => (
              <span
                key={i}
                className="flex basis-full flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
              >
                <span>
                  {r.bind === "death" ? "怪物死亡觸發" : r.bind === "zone" ? "走上區域觸發" : "未綁定觸發點"}
                  {r.monsterName && `：${r.monsterName}`}
                </span>
                {r.durationMin != null && <TimedBadge durationMin={r.durationMin} />}
                {r.qty != null && <span className="ml-auto font-mono">×{r.qty}</span>}
              </span>
            ))}
          </LinkListRow>
        ))}
      </ItemLinkList>
    </ItemSubSection>
  );
}
