"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { effectiveProb, formatStat, levelOf } from "@/lib/meridian-sim";
import type { MeridianLevels, MeridianPoint, MeridianStatFlag } from "@/lib/types/meridian";
import { cn } from "@/lib/utils";
import { fmt, statName, statValue } from "./format";

const STAT_GROUPS: [string, string[]][] = [
  ["生存", ["HPMAX", "MPMAX", "HP", "MP", "HPRecover", "MPRecover"]],
  [
    "攻防",
    [
      "Atk",
      "MAtk",
      "ExtraDef",
      "MagicDef",
      "Hit",
      "Dodge",
      "Critical",
      "Hurt",
      "EnemyDef",
      "EnemyMDef",
    ],
  ],
  ["屬性", ["Str", "Pow", "Vit", "Dex", "Agi", "Wis", "Encumbrance"]],
  [
    "抗性",
    [
      "FireDef",
      "WaterDef",
      "LightningDef",
      "EarthDef",
      "BleedRes",
      "StunRes",
      "ShapeRes",
      "WeakenRes",
    ],
  ],
  ["經脈", ["AtribChanlProb", "AtribChanlExp"]],
];
const GROUPED = new Set(STAT_GROUPS.flatMap(([, l]) => l));

export const SectionLabel = ({ children }: { children: ReactNode }) => (
  <p className="mb-1.5 text-[0.7rem] tracking-wider text-muted-foreground">{children}</p>
);

export function PointDetail({
  point,
  channelName,
  levels,
  idx,
  bonus,
  onSelect,
  children,
}: {
  point: MeridianPoint;
  channelName: string;
  levels: MeridianLevels;
  idx: Map<number, MeridianPoint>;
  bonus: number;
  onSelect: (id: number) => void;
  children?: ReactNode;
}) {
  const L = levelOf(levels, point.id);
  const next = L + 1;
  const maxed = next > point.maxLevel;
  const lv = maxed ? null : point.levels[next - 1];

  // 這個穴位目前累積給的加成
  const own = new Map<string, { value: number; flag: MeridianStatFlag }>();
  for (const l of point.levels.slice(0, L)) {
    for (const s of l.stats) {
      const cur = own.get(s.stat);
      own.set(s.stat, { value: (cur?.value ?? 0) + s.value, flag: s.flag });
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <span className="font-heading text-xl font-semibold tracking-wider">{point.name}</span>
        {point.isRoot && (
          <Badge variant="outline" className="border-primary/35 bg-primary/10 text-primary">
            起手穴
          </Badge>
        )}
        <Badge variant="secondary">{channelName}</Badge>
        {L >= point.maxLevel && (
          <Badge variant="outline" className="border-chart-2/45 text-chart-2">
            已滿級
          </Badge>
        )}
        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {L} / {point.maxLevel} 級
        </span>
      </div>

      {own.size > 0 && (
        <div className="mb-3">
          <SectionLabel>目前這個穴位給的加成</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {[...own].map(([st, v]) => (
              <Badge
                key={st}
                variant="outline"
                className="border-chart-2/45 font-normal text-chart-2"
              >
                {formatStat(st, v.value, v.flag)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {maxed || !lv ? (
        <p className="text-sm text-muted-foreground">這個穴位已經點滿了。</p>
      ) : (
        <>
          <Separator className="my-3" />
          <SectionLabel>下一級 · Lv{next}</SectionLabel>
          <dl className="mb-2.5 grid grid-cols-[1fr_auto] gap-x-3.5 gap-y-1 text-sm">
            <dt className="text-muted-foreground">消耗丹田</dt>
            <dd className="text-right tabular-nums">
              {lv.cost != null ? `${fmt(lv.cost)} 丹田` : "任務取得"}
            </dd>
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              成功率
              {bonus > 0 && <EstBadge>推估</EstBadge>}
            </dt>
            <dd className="text-right tabular-nums">
              {effectiveProb(lv.prob, bonus)}%
              {bonus > 0 && (
                <span className="ml-1 text-muted-foreground">
                  ({lv.prob}% +{bonus})
                </span>
              )}
            </dd>
            {lv.stats.map((s) => (
              <div key={s.stat} className="contents">
                <dt className="text-muted-foreground">這級加成</dt>
                <dd className="text-right">{formatStat(s.stat, s.value, s.flag)}</dd>
              </div>
            ))}
          </dl>
          {lv.help && <p className="mb-2.5 text-sm text-muted-foreground">{lv.help}</p>}

          {lv.prereqs.length > 0 && (
            <>
              <SectionLabel>
                前置條件
                {lv.prereqs.some((r) => levelOf(levels, r.id) < r.level) &&
                  "（紅色的還沒達成，可以點過去）"}
              </SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {lv.prereqs.map((r) => {
                  const have = levelOf(levels, r.id);
                  const ok = have >= r.level;
                  return (
                    <Button
                      key={r.id}
                      variant="outline"
                      size="xs"
                      className={cn(
                        "rounded-full font-normal tabular-nums",
                        ok
                          ? "border-chart-2/45 text-chart-2"
                          : "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
                      )}
                      onClick={() => onSelect(r.id)}
                    >
                      {idx.get(r.id)?.name ?? r.id} Lv{r.level}
                      <span className="opacity-70">({have})</span>
                    </Button>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {children}
    </div>
  );
}

export function EstBadge({ children }: { children: ReactNode }) {
  return (
    <Badge
      variant="outline"
      className="h-4 border-chart-2/45 px-1.5 text-[0.65rem] font-normal text-chart-2"
    >
      {children}
    </Badge>
  );
}

export function StatTable({
  stats,
}: {
  stats: { stat: string; value: number; flag: MeridianStatFlag }[];
}) {
  const by = new Map(stats.filter((s) => s.value).map((s) => [s.stat, s]));
  const groups: [string, string[]][] = [
    ...STAT_GROUPS,
    ["其他", [...by.keys()].filter((k) => !GROUPED.has(k))],
  ];
  return (
    <Table className="text-[0.85rem]">
      <TableBody>
        {groups.map(([g, list]) => {
          const sub = list.filter((s) => by.has(s));
          if (!sub.length) return null;
          return [
            <TableRow key={g} className="border-0 hover:bg-transparent">
              <TableCell
                colSpan={2}
                className="px-0 pt-3 pb-1 text-[0.7rem] tracking-wider text-muted-foreground"
              >
                {g}
              </TableCell>
            </TableRow>,
            ...sub.map((s) => {
              const v = by.get(s)!;
              return (
                <TableRow key={s} className="border-dashed border-border/70">
                  <TableCell className="px-0 py-1">{statName(s)}</TableCell>
                  <TableCell className="px-0 py-1 text-right tabular-nums">
                    {statValue(s, v.value, v.flag)}
                  </TableCell>
                </TableRow>
              );
            }),
          ];
        })}
      </TableBody>
    </Table>
  );
}
