import { PlusIcon, PencilLineIcon, MinusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function SummaryBadges({
  summary,
}: {
  summary: { added: number; changed: number; removed: number };
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge
        variant="outline"
        className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
      >
        <PlusIcon aria-hidden />
        {`${summary.added} 新增`}
      </Badge>
      <Badge
        variant="outline"
        className="border-amber-500/40 text-amber-600 dark:text-amber-400"
      >
        <PencilLineIcon aria-hidden />
        {`${summary.changed} 變更`}
      </Badge>
      <Badge variant="outline" className="border-red-500/40 text-red-600 dark:text-red-400">
        <MinusIcon aria-hidden />
        {`${summary.removed} 下架`}
      </Badge>
    </div>
  );
}
