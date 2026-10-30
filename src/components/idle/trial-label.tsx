"use client";

import { badgeVariants } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * 頁面標題旁的「試玩版」標籤，說明收在小浮層裡。
 * ponytail: 用 Popover + openOnHover 而不是 Tooltip，因為 Tooltip 在手機點了不會開。
 */
export function TrialBadge() {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={0}
        className={cn(badgeVariants({ variant: "secondary" }), "h-6 cursor-help px-2.5 text-[13px]")}
      >
        試玩版
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-auto max-w-xs px-3 py-2 text-xs">
        測試中，數值與存檔可能調整或重置。
      </PopoverContent>
    </Popover>
  );
}
