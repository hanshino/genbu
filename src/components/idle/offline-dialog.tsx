"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import type { IdleSummary } from "@/lib/idle/types";
import { formatNumber, formatOfflineDuration } from "@/lib/idle/view";
import { cn } from "@/lib/utils";

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border-border/60 flex flex-col gap-0.5 rounded-lg border p-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <b className={cn("text-xl tabular-nums", accent && "text-primary")}>{value}</b>
    </div>
  );
}

export function OfflineDialog({
  summary,
  stageName,
  onClose,
  onAllocate,
}: {
  summary: IdleSummary | null;
  stageName: string;
  onClose: () => void;
  onAllocate: () => void;
}) {
  const duration = summary ? formatOfflineDuration(summary) : null;
  return (
    <Dialog open={summary !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className="w-[calc(100%-2rem)] max-w-md">
        {summary && duration && (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl">歡迎回來</DialogTitle>
              <DialogDescription>
                離開期間角色在{stageName}掛機了{" "}
                <b className="text-foreground">
                  {duration.text}
                  {duration.capped ? "（上限）" : ""}
                </b>
                。
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="擊倒" value={formatNumber(summary.kills)} />
              <Stat
                label="等級"
                value={
                  summary.levelUps > 0 ? `Lv.${summary.levelBefore} → Lv.${summary.levelAfter}` : `Lv.${summary.levelAfter}`
                }
              />
              <Stat label="金錢" value={`+${formatNumber(summary.money)}`} />
              <Stat label="新屬性點" value={`${summary.pointsGained} 點`} accent={summary.pointsGained > 0} />
            </div>
            {summary.blocked ? (
              <p className="text-destructive mt-4 text-sm leading-relaxed">
                角色目前命中不足，打不到怪，已停在原地。配點加強命中後會繼續。
              </p>
            ) : (
              summary.pointsGained > 0 && (
                <p className="text-muted-foreground mt-4 text-[13px] leading-relaxed">
                  升級拿到的屬性點還沒分配，配點後擊倒速度會再提升。
                </p>
              )
            )}
            <DialogFooter className="flex-wrap">
              <Button variant="outline" className="h-11 px-4" onClick={onClose}>
                稍後
              </Button>
              <Button className="h-11 px-4" onClick={onAllocate}>
                去配點
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogPopup>
    </Dialog>
  );
}
