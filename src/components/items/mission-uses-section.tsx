import { Badge } from "@/components/ui/badge";
import { LinkListRow, LinkListSection } from "@/components/common/link-list";
import { getMissionsUsingItem } from "@/lib/queries/missions";

function groupLabel(groupId: number | null): string {
  return groupId == null ? "未分類" : `分組 #${groupId}`;
}

export function MissionUsesSection({ itemId }: { itemId: number }) {
  const uses = getMissionsUsingItem(itemId);
  if (uses.length === 0) return null;

  return (
    <LinkListSection title="相關任務" summary={`${uses.length} 個任務需要此物品`}>
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
    </LinkListSection>
  );
}
