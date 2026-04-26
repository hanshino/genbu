import { Badge } from "@/components/ui/badge";
import { getMissionDialogue } from "@/lib/queries/messages";
import type { MissionMessageRole } from "@/lib/types/message";

const ROLE_LABELS: Record<MissionMessageRole, string> = {
  accept: "接取",
  progress: "進度變更",
  set_state: "設定步驟",
  check_progress: "進度檢查",
  gated_off: "未達條件",
};

const ROLE_PRIORITY: Record<MissionMessageRole, number> = {
  accept: 0,
  set_state: 1,
  progress: 2,
  check_progress: 3,
  gated_off: 4,
};

function sortRoles(roles: MissionMessageRole[]): MissionMessageRole[] {
  return [...roles].sort((a, b) => ROLE_PRIORITY[a] - ROLE_PRIORITY[b]);
}

/**
 * 從 trigger DSL 反查出來的對話清單。Opcode 推斷的命中率約 88–93%（見
 * docs/msg-trigger-codes.md），餘下因擴充 opcode 未解碼可能漏連。
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
                      {sortRoles(e.roles).map((r) => (
                        <Badge
                          key={r}
                          variant="outline"
                          className="font-normal"
                        >
                          {ROLE_LABELS[r]}
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
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        從 trigger DSL 推斷（opcode 27/28/13/33/34/35/36），約 90% 任務語意命中率；
        罕用 opcode 尚未解碼，可能有少數對話漏連。
      </p>
    </section>
  );
}
