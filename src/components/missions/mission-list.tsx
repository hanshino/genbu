"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  ChevronsUpIcon,
  FlagIcon,
  GiftIcon,
  HourglassIcon,
  LogInIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { MissionGroupStats, MissionListItem } from "@/lib/types/mission";

interface Props {
  missions: MissionListItem[];
  groups: MissionGroupStats[];
}

const FACTION_ALL = "__all__";

function groupLabel(groupId: number | null): string {
  return groupId == null ? "未分類" : `分組 #${groupId}`;
}

/** 空字串 / 非數字 → null。 */
function parseLevel(s: string): number | null {
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function MissionMeta({ m }: { m: MissionListItem }) {
  const parts: ReactNode[] = [];
  if (m.acceptNpcs) {
    parts.push(
      <span key="npc" className="inline-flex min-w-0 items-center gap-1">
        <LogInIcon className="size-3 shrink-0" aria-hidden />
        <span className="sr-only">接取 NPC：</span>
        <span className="truncate">{m.acceptNpcs.join("、")}</span>
      </span>,
    );
  }
  if (m.minLevel != null) {
    parts.push(
      <span key="lv" className="inline-flex items-center gap-1">
        <ChevronsUpIcon className="size-3 shrink-0" aria-hidden />
        <span className="font-mono">Lv {m.minLevel}+</span>
      </span>,
    );
  }
  if (m.factions) {
    parts.push(
      <span key="faction" className="inline-flex items-center gap-1">
        <FlagIcon className="size-3 shrink-0" aria-hidden />
        {m.factions.join("、")}
      </span>,
    );
  }
  if (m.hasReward) {
    parts.push(
      <span key="reward" className="inline-flex items-center gap-1">
        <GiftIcon className="size-3 shrink-0" aria-hidden />
        有獎勵
      </span>,
    );
  }
  if (parts.length === 0) return null;
  return (
    <span className="flex basis-full flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      {parts}
    </span>
  );
}

export function MissionList({ missions, groups }: Props) {
  const [query, setQuery] = useState("");
  const [faction, setFaction] = useState(FACTION_ALL);
  const [levelMin, setLevelMin] = useState("");
  const [levelMax, setLevelMax] = useState("");
  const [rewardOnly, setRewardOnly] = useState(false);
  const [timedOnly, setTimedOnly] = useState(false);

  // 門派選項直接從資料裡出現過的門派組出來（op=2 summary 內的名稱）
  const factionOptions = useMemo(
    () => [...new Set(missions.flatMap((m) => m.factions ?? []))],
    [missions],
  );

  const trimmed = query.trim();
  const lo = parseLevel(levelMin);
  const hi = parseLevel(levelMax);
  const hasFilter =
    faction !== FACTION_ALL || lo != null || hi != null || rewardOnly || timedOnly;

  const filtered = useMemo(() => {
    const q = trimmed.toLowerCase();
    const isNumeric = /^\d+$/.test(trimmed);
    return missions.filter((m) => {
      // id 完全比對 / 名稱子字串比對
      if (
        trimmed &&
        !(isNumeric && String(m.id) === trimmed) &&
        !(m.name && m.name.toLowerCase().includes(q))
      ) {
        return false;
      }
      if (faction !== FACTION_ALL && !m.factions?.includes(faction)) return false;
      if (rewardOnly && !m.hasReward) return false;
      if (timedOnly && !m.timed) return false;
      // ponytail: 無等級需求視為 Lv 1，所以只填上限時它們仍會出現
      const lv = m.minLevel ?? 1;
      if (lo != null && lv < lo) return false;
      if (hi != null && lv > hi) return false;
      return true;
    });
  }, [missions, trimmed, faction, rewardOnly, timedOnly, lo, hi]);

  const grouped = useMemo(() => {
    const map = new Map<number | null, MissionListItem[]>();
    for (const m of filtered) {
      const list = map.get(m.groupId) ?? [];
      list.push(m);
      map.set(m.groupId, list);
    }
    // 排序：先有 group（升冪），再 null
    const order = [
      ...groups.filter((g) => g.groupId != null).map((g) => g.groupId as number),
      null,
    ];
    return order
      .filter((gid) => map.has(gid))
      .map((gid) => ({ groupId: gid, items: map.get(gid)! }));
  }, [filtered, groups]);

  // 只顯示「實際存在於 filtered 結果中」的分組 chip，否則點下去會跳到空段
  const visibleGroupIds = useMemo(
    () => new Set(grouped.map((g) => g.groupId)),
    [grouped],
  );

  const clearFilters = () => {
    setFaction(FACTION_ALL);
    setLevelMin("");
    setLevelMax("");
    setRewardOnly(false);
    setTimedOnly(false);
  };

  const chipBase =
    "rounded-md border border-border/60 bg-card px-2.5 py-1 font-mono text-xs";

  return (
    <div className="space-y-4">
      {groups.length > 1 && (
        <div className="-mx-1 flex flex-wrap gap-1.5 px-1">
          {groups.map((g) => {
            const key = g.groupId ?? "uncat";
            const label = g.groupId == null ? "未分類" : `#${g.groupId}`;
            if (!visibleGroupIds.has(g.groupId)) {
              return (
                <span
                  key={key}
                  aria-disabled
                  className={cn(chipBase, "text-muted-foreground/50")}
                >
                  {label}
                </span>
              );
            }
            return (
              <a
                key={key}
                href={`#g-${key}`}
                className={cn(
                  chipBase,
                  "text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                {label}
              </a>
            );
          })}
        </div>
      )}

      {/* Sticky 搜尋列：navbar (h-14) 之下 */}
      <div className="sticky top-14 z-30 -mx-4 border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="搜尋任務名稱或 ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {/* 高度固定一行（h-4），分組標題的 sticky offset 依賴這個高度 */}
        <div className="mt-1.5 flex h-4 items-center gap-2 text-xs text-muted-foreground">
          <span>
            {filtered.length === 0
              ? "找不到符合的任務"
              : `顯示 ${filtered.length.toLocaleString()} / ${missions.length.toLocaleString()} 個任務`}
          </span>
          {hasFilter && (
            <Button
              variant="ghost"
              size="xs"
              onClick={clearFilters}
              className="-my-1 px-1.5 text-muted-foreground"
            >
              <XIcon aria-hidden />
              清除篩選
            </Button>
          )}
        </div>
      </div>

      {/* 篩選列：不 sticky，捲動時收進搜尋列下方；清除鈕留在 sticky 列 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Select value={faction} onValueChange={(v) => setFaction(v ?? FACTION_ALL)}>
          <SelectTrigger className="w-[132px]" aria-label="門派">
            <SelectValue>
              {(v: unknown) => (v == null || v === FACTION_ALL ? "全部門派" : String(v))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FACTION_ALL}>全部門派</SelectItem>
            {factionOptions.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-sm text-muted-foreground">需求等級</span>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="下限"
            aria-label="需求等級下限"
            value={levelMin}
            onChange={(e) => setLevelMin(e.target.value)}
            className="w-20"
          />
          <span aria-hidden className="text-muted-foreground">
            –
          </span>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="上限"
            aria-label="需求等級上限"
            value={levelMax}
            onChange={(e) => setLevelMax(e.target.value)}
            className="w-20"
          />
        </div>
        <div className="flex items-center gap-x-4 text-sm">
          <label className="inline-flex min-h-11 cursor-pointer select-none items-center gap-2 py-1">
            <Checkbox
              checked={rewardOnly}
              onCheckedChange={(checked) => setRewardOnly(checked === true)}
            />
            <span>有獎勵</span>
          </label>
          <label className="inline-flex min-h-11 cursor-pointer select-none items-center gap-2 py-1">
            <Checkbox
              checked={timedOnly}
              onCheckedChange={(checked) => setTimedOnly(checked === true)}
            />
            <span>限時任務</span>
          </label>
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="rounded-lg border border-border/60 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          找不到符合的任務
        </p>
      )}

      <div className="space-y-6 pt-2">
        {grouped.map(({ groupId, items }) => (
          <section
            key={groupId ?? "uncat"}
            id={`g-${groupId ?? "uncat"}`}
            className="scroll-mt-[7.5rem] space-y-2"
          >
            {/* Sticky 分組標題：搜尋列之下（top = navbar 14 + search ~12 = ~6.5rem） */}
            <div className="sticky top-[6.5rem] z-20 -mx-4 flex items-baseline gap-2 border-b border-border/60 bg-background/95 px-4 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <h2 className="text-sm font-medium">{groupLabel(groupId)}</h2>
              <span className="text-xs text-muted-foreground">{items.length} 個任務</span>
            </div>
            <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
              {items.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/missions/${m.id}`}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <span className="font-mono text-xs text-muted-foreground">#{m.id}</span>
                    <span
                      className={
                        m.stepCount === 0
                          ? "text-muted-foreground italic"
                          : "font-medium"
                      }
                    >
                      {m.name ?? `任務 ${m.id}`}
                    </span>
                    {m.cycleTime != null && (
                      <Badge variant="outline" className="font-normal">
                        可重複
                      </Badge>
                    )}
                    {m.timed && (
                      <Badge variant="outline" className="font-normal">
                        <HourglassIcon aria-hidden />
                        限時
                      </Badge>
                    )}
                    {m.stepCount === 0 ? (
                      <span className="ml-auto text-xs text-muted-foreground">已停用</span>
                    ) : (
                      <span className="ml-auto font-mono text-xs text-muted-foreground">
                        {m.stepCount} 步驟
                      </span>
                    )}
                    <MissionMeta m={m} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
