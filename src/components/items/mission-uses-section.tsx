import { Badge } from "@/components/ui/badge";
import { LinkListRow } from "@/components/common/link-list";
import { ItemLinkList, ItemSubSection } from "@/components/items/item-section-group";
import type { MissionUseOfItem } from "@/lib/types/mission";

function groupLabel(groupId: number | null): string {
  return groupId == null ? "未分類" : `分組 #${groupId}`;
}

/**
 * 任務「需要」此物品 —— 是用途，不是取得來源。
 * 資料來源 mission_refs 只記錄任務引用了哪些道具，並未區分繳交與獎勵，
 * 因此不可據此宣稱「可由任務獲得」。
 */
export function MissionUsesSection({ uses }: { uses: MissionUseOfItem[] }) {
  if (uses.length === 0) return null;

  return (
    <ItemSubSection
      title="任務需求"
      summary={`${uses.length} 個任務會用到`}
      footer="資料只記錄任務有引用此道具，未區分是繳交還是獎勵；實際用途請點入任務內容確認。"
    >
      <ItemLinkList>
        {uses.map((u) => (
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
  );
}
