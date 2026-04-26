"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MissionGroupStats, MissionListItem } from "@/lib/types/mission";

interface Props {
  missions: MissionListItem[];
  groups: MissionGroupStats[];
}

function groupLabel(groupId: number | null): string {
  return groupId == null ? "未分類" : `分組 #${groupId}`;
}

export function MissionList({ missions, groups }: Props) {
  const [query, setQuery] = useState("");

  const trimmed = query.trim();
  const filtered = useMemo(() => {
    if (!trimmed) return missions;
    const q = trimmed.toLowerCase();
    // id 完全比對 / 名稱子字串比對
    const isNumeric = /^\d+$/.test(trimmed);
    return missions.filter((m) => {
      if (isNumeric && String(m.id) === trimmed) return true;
      if (m.name && m.name.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [missions, trimmed]);

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
        <p className="mt-1.5 text-xs text-muted-foreground">
          {filtered.length === 0
            ? "找不到符合的任務"
            : `顯示 ${filtered.length.toLocaleString()} / ${missions.length.toLocaleString()} 個任務`}
        </p>
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
                    {m.stepCount === 0 ? (
                      <span className="ml-auto text-xs text-muted-foreground">已停用</span>
                    ) : (
                      <span className="ml-auto font-mono text-xs text-muted-foreground">
                        {m.stepCount} 步驟
                      </span>
                    )}
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
