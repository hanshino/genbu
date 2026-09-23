import { Badge } from "@/components/ui/badge";
import { LinkListRow } from "@/components/common/link-list";
import { ItemLinkList, ItemSubSection } from "@/components/items/item-section-group";
import type { MissionUseOfItem } from "@/lib/types/mission";
import type { MissionTakingItem } from "@/lib/types/mission-logic";

function groupLabel(groupId: number | null): string {
  return groupId == null ? "未分類" : `分組 #${groupId}`;
}

/** 同一任務可能多處收走（不同對話分支），合併成一列、數量取最大。 */
function mergeTakes(takes: MissionTakingItem[]): MissionTakingItem[] {
  const map = new Map<number, MissionTakingItem>();
  for (const t of takes) {
    const prev = map.get(t.missionId);
    if (!prev) map.set(t.missionId, { ...t });
    else if (t.qty != null && (prev.qty == null || t.qty > prev.qty)) prev.qty = t.qty;
  }
  return [...map.values()];
}

/**
 * 任務對此道具的用途：
 * 1. takes：mission_rewards.take_item，確定會在任務中被收走。
 * 2. uses：mission_refs 只記錄「任務有引用此道具」，不區分繳交或獎勵；
 *    已出現在 takes 或 excludeIds（例如任務獎勵）的任務會被剔除，避免重複列出。
 */
export function MissionUsesSection({
  uses,
  takes = [],
  excludeIds = [],
}: {
  uses: MissionUseOfItem[];
  takes?: MissionTakingItem[];
  excludeIds?: number[];
}) {
  const merged = mergeTakes(takes);
  const hidden = new Set([...merged.map((t) => t.missionId), ...excludeIds]);
  const others = uses.filter((u) => !hidden.has(u.missionId));
  const precise = hidden.size > 0;

  return (
    <>
      {merged.length > 0 && (
        <ItemSubSection title="任務會收走" summary={`${merged.length} 個任務會收走`}>
          <ItemLinkList>
            {merged.map((t) => (
              <LinkListRow key={t.missionId} href={`/missions/${t.missionId}`}>
                <span className="font-mono text-xs text-muted-foreground">#{t.missionId}</span>
                <span className="font-medium">{t.missionName ?? `任務 ${t.missionId}`}</span>
                {t.qty != null && (
                  <span className="ml-auto font-mono text-xs text-muted-foreground">收走 ×{t.qty}</span>
                )}
              </LinkListRow>
            ))}
          </ItemLinkList>
        </ItemSubSection>
      )}

      {others.length > 0 && (
        <ItemSubSection
          title={precise ? "其他相關任務" : "任務需求"}
          summary={`${others.length} 個任務會用到`}
          footer="資料只記錄任務有引用此道具，未區分是繳交還是獎勵；實際用途請點入任務內容確認。"
        >
          <ItemLinkList>
            {others.map((u) => (
              <LinkListRow key={u.missionId} href={`/missions/${u.missionId}`}>
                <span className="font-mono text-xs text-muted-foreground">#{u.missionId}</span>
                <span className="font-medium">{u.missionName ?? `任務 ${u.missionId}`}</span>
                <Badge variant="outline" className="font-normal">
                  {groupLabel(u.groupId)}
                </Badge>
                {u.cycleTime != null && (
                  <Badge variant="outline" className="font-normal">
                    可重複
                  </Badge>
                )}
                {u.qty != null && (
                  <span className="ml-auto font-mono text-xs text-muted-foreground">需要 ×{u.qty}</span>
                )}
              </LinkListRow>
            ))}
          </ItemLinkList>
        </ItemSubSection>
      )}
    </>
  );
}
