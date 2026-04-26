import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getMissionsUsingItem } from "@/lib/queries/missions";

function groupLabel(groupId: number | null): string {
  return groupId == null ? "未分類" : `分組 #${groupId}`;
}

/**
 * 「需要此物品的任務」反查。對應 mission_refs 的 ref_type='item' AND item_id=?。
 * 一個任務同物品可能在多個步驟出現；這裡已 GROUP BY mission 並取 MAX(qty)。
 */
export function MissionUsesSection({ itemId }: { itemId: number }) {
  const uses = getMissionsUsingItem(itemId);
  if (uses.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium">相關任務</h2>
        <span className="text-xs text-muted-foreground">
          {uses.length} 個任務需要此物品
        </span>
      </div>

      <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
        {uses.map((u) => (
          <li key={u.missionId}>
            <Link
              href={`/missions/${u.missionId}`}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 transition-colors hover:bg-muted/50"
            >
              <span className="font-mono text-xs text-muted-foreground">
                #{u.missionId}
              </span>
              <span className="font-medium">
                {u.missionName ?? `任務 ${u.missionId}`}
              </span>
              <Badge variant="outline" className="font-normal">
                {groupLabel(u.groupId)}
              </Badge>
              {u.cycleTime != null && (
                <Badge variant="outline" className="font-normal">
                  可重複
                </Badge>
              )}
              {u.qty != null && (
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  需要 ×{u.qty}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
