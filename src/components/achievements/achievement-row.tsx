import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatReward } from "@/lib/format/achievement";
import type { AchievementRow as Row } from "@/lib/types/achievement";

export function AchievementRow({
  achievement,
  categoryLabel,
}: {
  achievement: Row;
  /** 搜尋結果列顯示「大分類 · 子分類」,分類瀏覽時省略 */
  categoryLabel?: string;
}) {
  const a = achievement;
  const reward = formatReward(a);
  return (
    <li className="space-y-1 px-4 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-medium">{a.name}</span>
        {a.points > 0 && (
          <Badge variant="secondary" className="font-normal">
            {a.points} 點
          </Badge>
        )}
        {a.resetType > 0 && (
          <Badge variant="outline" className="font-normal">
            週期重置
          </Badge>
        )}
        {categoryLabel && (
          <span className="ml-auto text-xs text-muted-foreground">{categoryLabel}</span>
        )}
      </div>
      {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
      {reward && (
        <p className="text-xs">
          <span className="text-muted-foreground">獎勵:</span>
          {reward.href ? (
            <Link
              href={reward.href}
              className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
            >
              {reward.label}
            </Link>
          ) : (
            reward.label
          )}
        </p>
      )}
      {a.prereqName && (
        <p className="text-xs text-muted-foreground">前置:{a.prereqName}</p>
      )}
    </li>
  );
}
