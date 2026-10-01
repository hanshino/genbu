"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MapPinIcon, SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NpcPortrait } from "@/components/missions/npc-portrait";
import { useUrlFilters } from "@/lib/hooks/use-url-filters";
import type { NpcSummary } from "@/lib/types/npc";

interface Props {
  npcs: NpcSummary[];
}

const URL_KEYS = ["q"] as const;
// 卡片只預覽前幾張地圖，完整清單在詳情頁
const PREVIEW_MAPS = 3;

export function NpcList({ npcs }: Props) {
  const { values, update, composition } = useUrlFilters(URL_KEYS);
  const trimmed = values.q.trim();

  const filtered = useMemo(() => {
    if (!trimmed) return npcs;
    const q = trimmed.toLowerCase();
    return npcs.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.mapNames.some((m) => m.toLowerCase().includes(q)),
    );
  }, [npcs, trimmed]);

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-30 -mx-4 border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="搜尋 NPC 或地圖名稱…（例如：易容師）"
            aria-label="搜尋 NPC"
            value={values.q}
            onChange={(e) => update({ q: e.target.value })}
            {...composition}
            className="pl-9"
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {filtered.length === 0
            ? "找不到符合的 NPC"
            : `顯示 ${filtered.length.toLocaleString()} / ${npcs.length.toLocaleString()} 位 NPC`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-border/60 bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          找不到符合「{trimmed}」的 NPC
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n) => {
            const preview = n.mapNames.slice(0, PREVIEW_MAPS);
            const rest = n.mapCount - preview.length;
            return (
              <li key={n.id}>
                <Link
                  href={`/npcs/${n.id}`}
                  className="flex h-full items-center gap-3 rounded-lg border border-border/60 bg-card p-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <NpcPortrait image={n.image} name={n.name} className="size-14" />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block truncate font-medium">{n.name}</span>
                    <span className="flex items-start gap-1 text-xs text-muted-foreground">
                      <MapPinIcon className="mt-0.5 size-3 shrink-0" aria-hidden />
                      {n.mapCount === 0 ? (
                        <span className="italic">沒有出現在任何地圖</span>
                      ) : (
                        <span className="line-clamp-2">
                          {preview.join("、")}
                          {rest > 0 && ` 等 ${n.mapCount} 張`}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
