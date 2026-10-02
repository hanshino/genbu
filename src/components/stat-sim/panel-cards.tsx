"use client";

import { ArrowLeftRightIcon, CheckIcon, CircleAlertIcon, TriangleAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { costBandForNextCost } from "@/lib/stat-sim";
import { ATTRIBUTE_KEYS, type CharacterV1, type PanelResult } from "@/lib/types/stat-sim";
import { cn } from "@/lib/utils";
import { STAT_LABELS, fmt, signed, statOf, type ViewKey } from "./labels";

const HIDDEN_IN_GAME: ViewKey[] = ["hit", "dodge", "critical", "uncanny_dodge"];

const box = "overflow-hidden rounded-xl bg-card text-sm ring-1 ring-foreground/10";
const head = "flex items-baseline gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5";

function Leader({
  k,
  v,
  className,
}: {
  k: React.ReactNode;
  v: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-baseline gap-2 py-0.5 text-xs text-muted-foreground", className)}
    >
      <span>{k}</span>
      <span className="flex-1 translate-y-[-3px] border-b border-dotted border-border" />
      <span className="font-mono text-foreground">{v}</span>
    </div>
  );
}

export function SourceCard({ panel, statKey }: { panel: PanelResult; statKey: ViewKey }) {
  const s = statOf(panel, statKey);
  return (
    <section className={box} aria-label="來源明細" data-testid="source-card">
      <header className={head}>
        <h2 className="font-heading text-sm font-semibold">{STAT_LABELS[statKey]}</h2>
        {s.estimated && <Badge variant="outline">估計</Badge>}
        <span className="ml-auto font-mono text-lg font-medium" data-testid="source-total">
          {s.value == null ? "—" : fmt(s.value)}
        </span>
      </header>
      <div className="px-4 pt-2.5 pb-3">
        {s.breakdown.length === 0 && (
          <p className="text-xs text-muted-foreground">沒有任何來源。</p>
        )}
        {s.breakdown.map((b, i) => (
          <Leader key={i} k={b.label} v={signed(b.amount)} />
        ))}
        {s.breakdown.length > 0 && (
          <Leader
            k="合計"
            v={s.value == null ? "—" : fmt(s.value)}
            className="mt-1.5 border-t border-border/60 pt-1.5 font-medium text-foreground"
          />
        )}
        {HIDDEN_IN_GAME.includes(statKey) && (
          <p className="mt-2 text-xs text-muted-foreground">
            遊戲角色視窗用擋板蓋住這一項，這裡由模擬器推算。
          </p>
        )}
        {s.value == null && <p className="mt-2 text-xs text-destructive">這一項目前算不出來。</p>}
        {s.estimateReasons.map((r) => (
          <p key={r} className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
            <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {r}
          </p>
        ))}
      </div>
    </section>
  );
}

export function ExtraCard({
  panel,
  onSelect,
}: {
  panel: PanelResult;
  onSelect: (key: ViewKey) => void;
}) {
  return (
    <section className={cn(box, "px-4 py-3")} aria-label="補充數值">
      <h3 className="mb-2 font-heading text-xs tracking-[0.1em] text-muted-foreground">補充</h3>
      {(["run_speed", "weight_cap"] as const).map((key) => {
        const s = panel.stats[key];
        return (
          <button
            key={key}
            type="button"
            className="block w-full rounded-md text-left hover:bg-muted/50"
            onClick={() => onSelect(key)}
          >
            <Leader
              k={STAT_LABELS[key]}
              v={
                <>
                  {s.value == null ? "—" : fmt(s.value)}
                  {s.estimated && (
                    <Badge variant="outline" className="ml-1.5">
                      近似
                    </Badge>
                  )}
                </>
              }
              className="text-[13px]"
            />
          </button>
        );
      })}
    </section>
  );
}

export function CostBandCard({ character, panel }: { character: CharacterV1; panel: PanelResult }) {
  return (
    <section className={cn(box, "px-4 py-3")} aria-label="配點檢查">
      <h3 className="mb-1 font-heading text-xs tracking-[0.1em] text-muted-foreground">配點檢查</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        對照遊戲裡「外功+」等欄位的成本：成本對不上，代表裝備或含裝數值填錯了。
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ATTRIBUTE_KEYS.map((key) => {
          const cost = panel.points.nextCost[key];
          const band = costBandForNextCost(cost);
          return (
            <span
              key={key}
              className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {STAT_LABELS[key]}成本 <b className="font-mono font-medium text-foreground">{cost}</b>{" "}
              → 不含裝{" "}
              <b className="font-mono font-medium text-foreground">
                {band.min}–{band.max}
              </b>
              （目前 {character.attributes[key]}）
            </span>
          );
        })}
      </div>
    </section>
  );
}

export function IssuesCard({ panel }: { panel: PanelResult }) {
  if (panel.issues.length === 0) {
    return (
      <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <CheckIcon className="size-3.5 text-primary" aria-hidden />
        沒有需要注意的地方。
      </p>
    );
  }
  return (
    <section className={cn(box, "px-4 py-3")} aria-label="提醒">
      <h3 className="mb-2 font-heading text-xs tracking-[0.1em] text-muted-foreground">提醒</h3>
      <ul className="space-y-1.5">
        {panel.issues.map((issue, i) => (
          <li
            key={`${issue.code}:${i}`}
            className={cn(
              "flex items-start gap-1.5 text-xs",
              issue.severity === "error" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {issue.severity === "error" ? (
              <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            ) : (
              <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            )}
            {issue.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ComingSoonCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section
        className="rounded-xl border border-dashed border-border px-4 py-3"
        aria-label="換裝比較（即將推出）"
      >
        <div className="mb-2 flex items-center gap-2">
          <ArrowLeftRightIcon className="size-4 text-muted-foreground" aria-hidden />
          <h3 className="font-heading text-sm text-muted-foreground">換裝比較</h3>
          <Badge variant="outline" className="ml-auto border-dashed text-muted-foreground">
            即將推出
          </Badge>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          把另一套裝備放進預備欄，面板直接顯示每一項的差值。
        </p>
      </section>
      <section
        className="rounded-xl border border-dashed border-border px-4 py-3"
        aria-label="CP 值（即將推出）"
      >
        <div className="mb-2 flex items-center gap-2">
          <h3 className="font-heading text-sm text-muted-foreground">CP 值</h3>
          <Badge variant="outline" className="ml-auto border-dashed text-muted-foreground">
            即將推出
          </Badge>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          用強化材料與市價換算每一點數值的成本，幫你判斷下一步先投資哪裡。
        </p>
      </section>
    </div>
  );
}
