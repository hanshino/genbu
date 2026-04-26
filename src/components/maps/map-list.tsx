"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { sortStageFlags } from "@/lib/constants/stage-flags";
import { StageFlagBadge } from "@/components/maps/stage-flag-badge";
import type { StageGroupStats, StageListItem } from "@/lib/types/stage";

interface Props {
  stages: StageListItem[];
  groups: StageGroupStats[];
}

export function MapList({ stages, groups }: Props) {
  const [query, setQuery] = useState("");

  const trimmed = query.trim();
  const filtered = useMemo(() => {
    if (!trimmed) return stages;
    const q = trimmed.toLowerCase();
    const isNumeric = /^\d+$/.test(trimmed);
    return stages.filter((s) => {
      if (isNumeric && String(s.id) === trimmed) return true;
      if (s.name.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [stages, trimmed]);

  const grouped = useMemo(() => {
    const map = new Map<number | null, StageListItem[]>();
    for (const s of filtered) {
      const list = map.get(s.groupId) ?? [];
      list.push(s);
      map.set(s.groupId, list);
    }
    const order = [...groups.map((g) => g.groupId as number | null), null];
    return order
      .filter((gid) => map.has(gid))
      .map((gid) => ({ groupId: gid, items: map.get(gid)! }));
  }, [filtered, groups]);

  const visibleGroupIds = useMemo(
    () => new Set(grouped.map((g) => g.groupId)),
    [grouped],
  );

  const previewById = useMemo(() => {
    const m = new Map<number, string>();
    for (const g of groups) m.set(g.groupId, g.preview);
    return m;
  }, [groups]);

  const chipBase =
    "rounded-md border border-border/60 bg-card px-2.5 py-1 font-mono text-xs";

  return (
    <div className="space-y-4">
      {groups.length > 1 && (
        <div className="-mx-1 flex flex-wrap gap-1.5 px-1">
          {groups.map((g) => {
            const key = g.groupId;
            const label = `#${g.groupId}`;
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
                title={g.preview}
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

      {/* Sticky 搜尋列 */}
      <div className="sticky top-14 z-30 -mx-4 border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="搜尋地圖名稱或 ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {filtered.length === 0
            ? "找不到符合的地圖"
            : `顯示 ${filtered.length.toLocaleString()} / ${stages.length.toLocaleString()} 張地圖`}
        </p>
      </div>

      {filtered.length === 0 && (
        <p className="rounded-lg border border-border/60 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          找不到符合的地圖
        </p>
      )}

      <div className="space-y-6 pt-2">
        {grouped.map(({ groupId, items }) => {
          const preview = groupId != null ? previewById.get(groupId) : null;
          return (
            <section
              key={groupId ?? "uncat"}
              id={`g-${groupId ?? "uncat"}`}
              className="scroll-mt-[7.5rem] space-y-2"
            >
              <div className="sticky top-[6.5rem] z-20 -mx-4 flex items-baseline gap-2 border-b border-border/60 bg-background/95 px-4 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <h2 className="text-sm font-medium">
                  {groupId == null ? "未分類" : `區域 #${groupId}`}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {items.length} 張
                </span>
                {preview && (
                  <span className="ml-2 hidden truncate text-xs text-muted-foreground/80 sm:inline">
                    {preview}
                  </span>
                )}
              </div>
              <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
                {items.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/maps/${s.id}`}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        #{s.id}
                      </span>
                      <span className="font-medium">{s.name}</span>
                      {s.kind === "sestage" && (
                        <span className="rounded border border-border/60 px-1 font-mono text-[0.65rem] text-muted-foreground">
                          SE
                        </span>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {sortStageFlags(s.flags).map((f) => (
                          <StageFlagBadge key={f} flag={f} size="xs" />
                        ))}
                      </div>
                      {s.inboundCount > 0 && (
                        <span
                          className="ml-auto font-mono text-xs text-muted-foreground"
                          title="多少張地圖把這裡列為預設出生 / 登出點"
                        >
                          ←{s.inboundCount}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
