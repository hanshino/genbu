"use client";

import { CircleCheckIcon, InfoIcon, LinkIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EQUIP_SLOTS } from "@/lib/types/stat-sim";
import type { ImportDiagnostic } from "@/lib/types/stat-sim-import";
import { cn } from "@/lib/utils";
import { fmt } from "./labels";

export interface ImportResultCardProps {
  characterName: string;
  renamed: boolean;
  app: string;
  /** ISO 時間 */
  at: string;
  summary: {
    sectName: string;
    level: number;
    rebirthPoints: number;
    equipCount: number;
    passiveCount: number;
    meridianHref: string | null;
  };
  diagnostics: ImportDiagnostic[];
  onClose: () => void;
}

const pad = (n: number) => String(n).padStart(2, "0");
function formatAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const GROUPS = [
  {
    severity: "warning",
    title: "需要注意",
    Icon: TriangleAlertIcon,
    tone: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500/70",
  },
  {
    severity: "info",
    title: "已自動調整",
    Icon: InfoIcon,
    tone: "text-muted-foreground",
    bar: "bg-border",
  },
] as const;

export function ImportResultCard({
  characterName,
  renamed,
  app,
  at,
  summary,
  diagnostics,
  onClose,
}: ImportResultCardProps) {
  const cells: Array<[string, React.ReactNode, boolean?]> = [
    ["門派", summary.sectName, true],
    ["等級", summary.level],
    [
      "轉生點數",
      <span key="r" className={cn(summary.rebirthPoints === 0 && "text-muted-foreground")}>
        {fmt(summary.rebirthPoints)}
      </span>,
    ],
    ["裝備", `${summary.equipCount} / ${EQUIP_SLOTS.length}`],
    ["被動", summary.passiveCount],
    [
      "經脈",
      <span key="m" className={cn(!summary.meridianHref && "text-muted-foreground")}>
        {summary.meridianHref ? "有" : "無"}
      </span>,
      true,
    ],
  ];

  return (
    <section
      aria-label="匯入結果"
      className="overflow-hidden rounded-xl bg-card text-sm ring-1 ring-foreground/10"
    >
      <header className="flex items-center gap-2.5 border-b border-border/60 bg-muted/30 py-2.5 pr-2.5 pl-4">
        <CircleCheckIcon
          className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-hidden
        />
        <h3 className="min-w-0 truncate font-heading text-sm font-semibold">
          已匯入「{characterName}」
        </h3>
        <Badge variant="outline" className="ml-auto">
          新增角色
        </Badge>
        <Button size="icon-sm" variant="ghost" aria-label="關閉匯入結果" onClick={onClose}>
          <XIcon />
        </Button>
      </header>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border/60 bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
        <span>
          來源<b className="ml-2 font-mono font-medium text-foreground/80">{app}</b>
        </span>
        <span>
          讀取時間<b className="ml-2 font-mono font-medium text-foreground/80">{formatAt(at)}</b>
        </span>
        {renamed && <span>原名撞名，已自動改名</span>}
      </div>

      <dl className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-px bg-border/60">
        {cells.map(([k, v, text]) => (
          <div key={k} className="bg-card px-3 py-2">
            <dt className="text-[11px] leading-snug text-muted-foreground">{k}</dt>
            <dd className={cn("mt-0.5 text-sm font-medium", text ? "font-heading" : "font-mono")}>
              {v}
            </dd>
          </div>
        ))}
      </dl>

      {summary.meridianHref && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <span className="flex-1">經脈資料有讀到，但屬性模擬器目前還沒把經脈算進面板。</span>
          <a
            href={summary.meridianHref}
            className="inline-flex items-center gap-1 rounded-sm font-medium whitespace-nowrap text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <LinkIcon className="size-3.5" aria-hidden />
            在經脈模擬器開啟
          </a>
        </div>
      )}

      {diagnostics.length === 0 ? (
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-border/60 px-4 py-3.5 text-[13px]">
          <CircleCheckIcon
            className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
          全部都對得上，沒有要提醒你的地方。
          <span className="text-xs text-muted-foreground">直接去右邊面板看數字就行。</span>
        </p>
      ) : (
        GROUPS.map(({ severity, title, Icon, tone, bar }) => {
          const items = diagnostics.filter((d) => d.severity === severity);
          if (items.length === 0) return null;
          return (
            <section
              key={severity}
              aria-label={title}
              className="border-t border-border/60 px-4 py-3"
            >
              <h4 className="mb-2 flex items-center gap-1.5 font-heading text-xs tracking-[0.06em]">
                <Icon className={cn("size-3.5 shrink-0", tone)} aria-hidden />
                {title}
                <Badge variant="secondary" className="ml-auto">
                  {items.length} 項
                </Badge>
              </h4>
              <ul className="flex flex-col gap-1.5">
                {items.map((d, i) => (
                  <li
                    key={`${d.code}-${i}`}
                    className="grid grid-cols-[4px_minmax(0,1fr)] gap-2.5 overflow-hidden rounded-lg border border-border/60 bg-muted/30 py-2 pr-3 text-xs leading-relaxed font-medium"
                  >
                    <span className={bar} aria-hidden />
                    {d.message}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </section>
  );
}
