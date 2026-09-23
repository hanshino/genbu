import { Badge } from "@/components/ui/badge";
import { getMissionDialogue } from "@/lib/queries/messages";
import type { MissionEvent, MissionEventKind } from "@/lib/types/message";

const EVENT_PRIORITY: Record<MissionEventKind, number> = {
  accept: 0,
  set_step: 1,
  step_done: 2,
  complete: 3,
  reset: 4,
  timer35: 5,
  timer36: 5,
};

function sortEvents(events: MissionEvent[]): MissionEvent[] {
  return [...events].sort((a, b) => EVENT_PRIORITY[a.event] - EVENT_PRIORITY[b.event]);
}

/** 1 時辰 = 10 分鐘（見 op_defs A35/A36 note）。 */
function formatMinutes(minutes: number): string {
  if (minutes === -1) return "無限時";
  const shichen = minutes / 10;
  return `限時 ${minutes} 分（${shichen} 時辰）`;
}

function eventLabel(e: MissionEvent): string {
  switch (e.event) {
    case "accept":
      return "接取";
    case "set_step":
      return `設定進度 step ${e.step}`;
    case "step_done":
      return `完成步驟 ${e.step}`;
    case "complete":
      return "任務完成";
    case "reset":
      return "重置";
    case "timer35":
    case "timer36":
      return formatMinutes(e.minutes ?? -1);
  }
}

/**
 * 從 mission_events（上游已解析的任務語意事件）反查出來的對話清單。
 * 完整 opcode 對照表見 docs/msg-trigger-codes.md。
 */
export function MissionDialogueSection({ missionId }: { missionId: number }) {
  const groups = getMissionDialogue(missionId);
  if (groups.length === 0) return null;

  const totalEntries = groups.reduce((s, g) => s + g.entries.length, 0);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium">相關對話</h2>
        <span className="text-xs text-muted-foreground">
          {totalEntries} 段對話 · 跨 {groups.length} 個地圖檔
        </span>
      </div>

      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.fileNo} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                MSG{g.fileNo}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {g.entries.length} 段
              </span>
            </div>

            <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
              {g.entries.map((e) => (
                <li key={`${e.fileNo}-${e.msgId}`} className="space-y-2 p-3">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
                    <span className="font-mono text-muted-foreground">
                      #{e.msgId}
                    </span>
                    {e.speaker && (
                      <span className="font-medium">{e.speaker}</span>
                    )}
                    <div className="ml-auto flex flex-wrap gap-1">
                      {sortEvents(e.events).map((ev, i) => (
                        <Badge
                          key={`${ev.event}-${ev.step}-${ev.minutes}-${i}`}
                          variant="outline"
                          className="font-normal"
                        >
                          {eventLabel(ev)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {e.text ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {e.text}
                    </p>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">（無台詞）</p>
                  )}
                  {e.options.length > 0 && (
                    <ul className="space-y-0.5 border-l-2 border-border/60 pl-3 text-sm">
                      {e.options.map((o) => (
                        <li key={o.index} className="flex items-baseline gap-2">
                          <span className="text-muted-foreground">→</span>
                          <span>{o.text ?? "（空白選項）"}</span>
                          {o.jumpTo != null && (
                            <span className="font-mono text-xs text-muted-foreground">
                              jump #{o.jumpTo}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {e.options.length === 0 && e.jumpTo != null && (
                    <p className="text-xs text-muted-foreground">
                      自動接續 → #{e.jumpTo}
                    </p>
                  )}
                  {e.triggerOps.length > 0 && (
                    <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {e.triggerOps.map((op, i) => (
                        <li
                          key={`${op.kind}${op.op}-${i}`}
                          className={op.likely ? "italic text-muted-foreground/70" : undefined}
                          title={op.likely ? "語意為推測" : undefined}
                        >
                          {op.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        任務事件語意（接取/進度/完成/重置/計時器）與逐條 trigger 釋義由上游解析
        寫入 mission_events / trigger_ops / op_defs；斜體標示為推測語意
        （op_defs.confidence ≠ confirmed）。
      </p>
    </section>
  );
}
