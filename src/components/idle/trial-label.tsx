import { Badge } from "@/components/ui/badge";

/** 頁面標題旁的「試玩版」標籤。 */
export function TrialBadge() {
  return (
    <Badge variant="secondary" className="h-6 px-2.5 text-[13px]">
      試玩版
    </Badge>
  );
}

/** 標題下的提醒：測試期間數值與存檔可能調整或重置。 */
export function TrialNote({ className }: { className?: string }) {
  return (
    <p className={`text-muted-foreground text-xs ${className ?? ""}`}>
      測試中，數值與存檔可能調整或重置。
    </p>
  );
}
