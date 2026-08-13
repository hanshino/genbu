"use client";

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HERO_BONUS_KEYS, type HeroBonusKey, type HeroTeamResult } from "@/lib/hero-team-optimizer";
import { HERO_BONUS_LABELS } from "@/lib/hero-bonus-labels";
import type { HeroCombination } from "@/lib/types/hero";

interface Props {
  result: HeroTeamResult;
  rank: number;
  target: HeroBonusKey;
  heroNames: Map<number, string>;
  /** 第一名才顯示的說明，需帶入目前可用人數。 */
  poolSize: number;
}

export function HeroTeamResultCard({ result, rank, target, heroNames, poolSize }: Props) {
  const isTop = rank === 1;
  const linkCount = result.mainHeroLinks.length + result.companionLinks.length;
  const label = HERO_BONUS_LABELS[target];
  const name = (id: number) => heroNames.get(id) ?? `英雄 #${id}`;

  return (
    <article
      className={cn(
        "rounded-lg border bg-card",
        isTop ? "border-primary/50 ring-1 ring-primary/20" : "border-border/60",
      )}
    >
      <div className="flex flex-wrap items-start gap-3 p-4">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-md border font-mono text-xs font-semibold",
            isTop
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border/60 bg-muted text-muted-foreground",
          )}
        >
          {rank}
        </span>

        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="sr-only">
            第 {rank} 組：{name(result.mainHeroId)} 與 {result.companionIds.length} 位相惜英雄
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            <li>
              <Badge variant="secondary" className="font-normal">
                {name(result.mainHeroId)}
                <span className="text-muted-foreground">· 主</span>
              </Badge>
            </li>
            {result.companionIds.map((id) => (
              <li key={id}>
                <Badge variant="outline" className="font-normal">
                  {name(id)}
                  <span className="font-mono text-muted-foreground">#{id}</span>
                </Badge>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {isTop
              ? `在目前可使用的 ${poolSize} 位英雄中，這組的${label}連結加成總和最高`
              : `${result.companionIds.length} 位相惜英雄 · 啟動 ${linkCount} 條連結`}
          </p>
        </div>

        <p className="shrink-0 text-right">
          <span className="block font-mono text-xl font-semibold tabular-nums">
            +{result.targetScore.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </p>
      </div>

      <div className="border-t border-border/60 px-4 py-3">
        <p className="mb-2 text-xs text-muted-foreground">連結加成總和</p>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {HERO_BONUS_KEYS.map((key) => {
            const value = result.totals[key];
            const on = key === target;
            return (
              <div
                key={key}
                className={cn(
                  "min-w-0 rounded-md border px-2 py-1.5",
                  on ? "border-primary/50 bg-primary/10" : "border-border/60 bg-muted/40",
                )}
              >
                <dt className="truncate text-xs text-muted-foreground">{HERO_BONUS_LABELS[key]}</dt>
                <dd
                  className={cn(
                    "font-mono text-sm tabular-nums",
                    value === 0 && "font-normal text-muted-foreground",
                  )}
                >
                  {value === 0 ? "0" : `+${value.toLocaleString()}`}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>

      <Collapsible className="border-t border-border/60">
        <CollapsibleTrigger className="group/trigger flex w-full items-center gap-1.5 px-4 py-2.5 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground">
          <ChevronRightIcon
            className="size-3.5 transition-transform group-data-panel-open/trigger:rotate-90"
            aria-hidden
          />
          展開啟動連結明細（{linkCount} 條）
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <div className="space-y-4 px-4 pt-1 pb-4">
            <LinkGroup
              title={`含主英雄的連結（${result.mainHeroLinks.length}）`}
              links={result.mainHeroLinks}
              target={target}
              emptyText="這組沒有含主英雄的完整連結。"
            />
            <LinkGroup
              title={`相惜英雄彼此連結（${result.companionLinks.length}）`}
              links={result.companionLinks}
              target={target}
              emptyText="相惜英雄之間沒有完整連結，加成全部來自含主英雄的連結。"
            />
          </div>
        </CollapsiblePanel>
      </Collapsible>
    </article>
  );
}

function LinkGroup({
  title,
  links,
  target,
  emptyText,
}: {
  title: string;
  links: HeroCombination[];
  target: HeroBonusKey;
  emptyText: string;
}) {
  return (
    <section className="space-y-1.5">
      <h4 className="text-xs text-muted-foreground">{title}</h4>
      {links.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-dotted border-border/60 pb-2 last:border-0 last:pb-0"
            >
              <span className="text-sm font-medium">{link.name}</span>
              <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                {link.members.map((m) => m.name).join(" ＋ ")}
              </span>
              <span className="flex flex-wrap gap-1">
                {HERO_BONUS_KEYS.filter((key) => link.bonus[key]).map((key) => (
                  <Badge
                    key={key}
                    variant={key === target ? "secondary" : "outline"}
                    className="font-normal"
                  >
                    {HERO_BONUS_LABELS[key]} +{link.bonus[key]!.toLocaleString()}
                  </Badge>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
