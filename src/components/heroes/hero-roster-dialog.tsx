"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogCloseButton,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { HeroSummary } from "@/lib/types/hero";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heroes: HeroSummary[];
  mainHeroId: number;
  /** 已勾選的 companions（不含主英雄，主英雄一律自動保留）。 */
  selectedIds: Set<number>;
  onChange: (next: Set<number>) => void;
}

export function HeroRosterDialog({
  open,
  onOpenChange,
  heroes,
  mainHeroId,
  selectedIds,
  onChange,
}: Props) {
  const [query, setQuery] = useState("");

  const trimmed = query.trim();
  const matches = useMemo(() => {
    if (trimmed.length === 0) return heroes;
    const asNum = Number(trimmed);
    const idMatch = Number.isInteger(asNum) ? asNum : null;
    return heroes.filter((h) => h.id === idMatch || h.name.includes(trimmed));
  }, [heroes, trimmed]);

  // 依原始 group 分段；query 已依 group、id 排序，順序切段即可。
  const groups = useMemo(() => {
    const out: { groupId: string; heroes: HeroSummary[] }[] = [];
    for (const hero of matches) {
      const last = out.at(-1);
      if (last?.groupId === hero.groupId) last.heroes.push(hero);
      else out.push({ groupId: hero.groupId, heroes: [hero] });
    }
    return out;
  }, [matches]);

  function toggle(id: number, checked: boolean) {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onChange(next);
  }

  function toggleGroup(groupHeroes: HeroSummary[]) {
    const selectable = groupHeroes.filter((h) => h.id !== mainHeroId);
    const allOn = selectable.every((h) => selectedIds.has(h.id));
    const next = new Set(selectedIds);
    for (const h of selectable) {
      if (allOn) next.delete(h.id);
      else next.add(h.id);
    }
    onChange(next);
  }

  // 主英雄一律計入可使用人數，即使沒被勾選。
  const poolSize = selectedIds.has(mainHeroId) ? selectedIds.size : selectedIds.size + 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="flex max-h-[86vh] w-[calc(100vw-2rem)] max-w-2xl flex-col p-0">
        <DialogHeader className="mb-0 border-b border-border/60 p-4 pr-12">
          <DialogTitle>管理可使用英雄</DialogTitle>
          <DialogDescription>
            勾選你實際擁有的英雄，可用名稱或編號搜尋。主英雄一律自動保留。
          </DialogDescription>
          <DialogCloseButton />
        </DialogHeader>

        <div className="space-y-2 border-b border-border/60 bg-muted/30 p-4">
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋名稱或編號…"
              aria-label="搜尋英雄名稱或編號"
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">分組快速選取</span>
            {groups.map((group) => {
              const selectable = group.heroes.filter((h) => h.id !== mainHeroId);
              const on = selectable.length > 0 && selectable.every((h) => selectedIds.has(h.id));
              return (
                <Button
                  key={group.groupId}
                  type="button"
                  variant={on ? "secondary" : "outline"}
                  size="xs"
                  aria-pressed={on}
                  onClick={() => toggleGroup(group.heroes)}
                >
                  分組 {group.groupId}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {groups.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              找不到符合「{trimmed}」的英雄。試試其他名稱或英雄編號。
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.groupId}>
                <h3 className="sticky top-0 z-10 border-b border-border/60 bg-card/95 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
                  分組 {group.groupId}
                </h3>
                <ul>
                  {group.heroes.map((hero) => {
                    const isMain = hero.id === mainHeroId;
                    const checked = isMain || selectedIds.has(hero.id);
                    return (
                      <li
                        key={hero.id}
                        className="flex items-center gap-3 border-b border-border/40 px-4 py-2 last:border-0"
                      >
                        <Checkbox
                          id={`roster-hero-${hero.id}`}
                          checked={checked}
                          disabled={isMain}
                          onCheckedChange={(value) => toggle(hero.id, value === true)}
                        />
                        <label
                          htmlFor={`roster-hero-${hero.id}`}
                          className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
                        >
                          <span className="font-medium">{hero.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            #{hero.id}
                          </span>
                          {isMain && (
                            <Badge variant="outline" className="font-normal">
                              主英雄 · 自動保留
                            </Badge>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>

        <DialogFooter className="mt-0 items-center justify-start gap-2 border-t border-border/60 p-4">
          <span className="text-sm text-muted-foreground">
            可使用 <span className="font-mono text-foreground">{poolSize}</span> / {heroes.length}{" "}
            位
          </span>
          <span className="ml-auto flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(new Set(heroes.map((h) => h.id)))}
            >
              全選
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onChange(new Set())}>
              清除
            </Button>
            <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
              完成
            </Button>
          </span>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
