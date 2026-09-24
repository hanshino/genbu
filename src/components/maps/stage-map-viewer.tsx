"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRightIcon, EyeIcon, EyeOffIcon, InfoIcon, XIcon } from "lucide-react";
import { EntityPortrait } from "@/components/common/entity-portrait";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { EntityImage } from "@/lib/queries/images";
import type { NpcPlacement, StageMapImage, StageMonsterMarker } from "@/lib/queries/maps";

export interface MapMonster extends StageMonsterMarker {
  image?: EntityImage | null;
}

interface StageMapViewerProps {
  stageName: string;
  image: StageMapImage | null;
  placements: NpcPlacement[];
  /** 已由 buildMonsterMarkers 算好 highHp 與百分比座標；UI 不再做任何判斷。 */
  monsters?: MapMonster[];
  /** 清單右側欄（出入口、同區域地圖、相關任務），由 Server Component 傳入。 */
  aside?: React.ReactNode;
}

interface Entity {
  key: string;
  kind: "m" | "n";
  /** 地圖與清單共用的識別：怪物 1..N、NPC A..Z/AA.. */
  tag: string;
  /** 怪物才有；NPC 用前景色方塊。 */
  color?: string;
  npcId: number;
  name: string;
  image: EntityImage | null;
  points: { left: number; top: number }[];
  monster?: MapMonster;
}

interface MapPoint {
  pid: string;
  entity: Entity;
  index: number;
  left: number;
  top: number;
}

/** 螢幕上兩點距離小於這個像素就合成一個數字圈。 */
const CLUSTER_PX = 24;
const MARKER_COLORS = 12; // 對應 globals.css 的 --marker-1..12

const markerColor = (i: number) => `var(--marker-${(i % MARKER_COLORS) + 1})`;

/** 0→A … 25→Z、26→AA …（NPC 超過 26 位的地圖也有唯一代號）。 */
export function letterTag(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
}

/**
 * 貪婪分群：依序把點丟進第一個質心距離 < threshold 的群，否則自成一群。
 * threshold <= 0 時不分群。
 * ponytail: O(n × 群數)，本站單圖最多約 300 點無感；上千點再換 grid bucket。
 */
export function clusterPoints<T extends { x: number; y: number }>(
  points: T[],
  threshold: number,
): { x: number; y: number; members: T[] }[] {
  const groups: { x: number; y: number; members: T[] }[] = [];
  for (const p of points) {
    const g =
      threshold > 0 ? groups.find((c) => Math.hypot(c.x - p.x, c.y - p.y) < threshold) : undefined;
    if (!g) {
      groups.push({ x: p.x, y: p.y, members: [p] });
      continue;
    }
    g.members.push(p);
    g.x = g.members.reduce((s, q) => s + q.x, 0) / g.members.length;
    g.y = g.members.reduce((s, q) => s + q.y, 0) / g.members.length;
  }
  return groups;
}

function formatRatio(r: number) {
  return r >= 100 ? Math.round(r).toLocaleString() : r.toFixed(1);
}

function useElementWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function StageMapViewer({
  stageName,
  image,
  placements,
  monsters = [],
  aside,
}: StageMapViewerProps) {
  const entities = React.useMemo<Entity[]>(() => {
    const list: Entity[] = monsters.map((m, i) => ({
      key: `m:${m.npcId}`,
      kind: "m",
      tag: String(i + 1),
      color: markerColor(i),
      npcId: m.npcId,
      name: m.name,
      image: m.image ?? null,
      points: m.points,
      monster: m,
    }));
    const npcs = new Map<number, Entity>();
    for (const p of placements) {
      let e = npcs.get(p.npcId);
      if (!e) {
        e = {
          key: `n:${p.npcId}`,
          kind: "n",
          tag: letterTag(npcs.size),
          npcId: p.npcId,
          name: p.name ?? `NPC #${p.npcId}`,
          image: p.image,
          points: [],
        };
        npcs.set(p.npcId, e);
      }
      // raw_x/raw_y 是合成圖像素座標，直接換百分比即與圖片對齊（見 NpcPlacement 註解）。
      if (image && image.imgWidth > 0 && image.imgHeight > 0) {
        e.points.push({
          left: (p.rawX / image.imgWidth) * 100,
          top: (p.rawY / image.imgHeight) * 100,
        });
      }
    }
    return [...list, ...npcs.values()];
  }, [monsters, placements, image]);

  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set());
  const [pinned, setPinned] = React.useState<string | null>(null);
  const [hoverKey, setHoverKey] = React.useState<string | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [mapRef, width] = useElementWidth<HTMLDivElement>();
  const figureRef = React.useRef<HTMLElement>(null);
  // 首次出現時標記依序落下；之後重新分群產生的新標記不再延遲。
  const [settled, setSettled] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setSettled(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const monstersE = entities.filter((e) => e.kind === "m");
  const npcsE = entities.filter((e) => e.kind === "n");
  const byKey = new Map(entities.map((e) => [e.key, e]));
  const showMap = image != null;

  const rawActive = hoverKey ?? pinned;
  const active = rawActive && !hidden.has(rawActive) ? rawActive : null;
  const pinnedEntity = pinned && !hidden.has(pinned) ? byKey.get(pinned) : undefined;

  const markers = React.useMemo(() => {
    if (!image) return [];
    const heightPx = (width * image.imgHeight) / image.imgWidth;
    const visible: (MapPoint & { x: number; y: number })[] = [];
    for (const e of entities) {
      if (hidden.has(e.key)) continue;
      e.points.forEach((p, index) =>
        visible.push({
          pid: `${e.key}#${index}`,
          entity: e,
          index,
          left: p.left,
          top: p.top,
          x: (p.left / 100) * width,
          y: (p.top / 100) * heightPx,
        }),
      );
    }
    // 標亮中的種類不參與分群，永遠單獨畫在最上層。
    const solo = visible.filter((p) => p.entity.key === active);
    const rest = visible.filter((p) => p.entity.key !== active);
    // 還沒量到寬度（SSR / 測試環境）就不分群。
    const groups = clusterPoints(rest, width > 0 ? CLUSTER_PX : 0);
    return [
      ...groups.map((g) =>
        g.members.length === 1
          ? { type: "point" as const, point: g.members[0], solo: false }
          : {
              type: "cluster" as const,
              id: `c:${g.members.map((m) => m.pid).join("|")}`,
              left: g.members.reduce((s, m) => s + m.left, 0) / g.members.length,
              top: g.members.reduce((s, m) => s + m.top, 0) / g.members.length,
              members: g.members,
            },
      ),
      ...solo.map((point) => ({ type: "point" as const, point, solo: true })),
    ];
  }, [entities, hidden, active, width, image]);

  if (!image && entities.length === 0) return aside ? <Layout aside={aside} /> : null;

  const toggleHidden = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setHoverKey(null);
  };
  const setGroupHidden = (list: Entity[], hide: boolean) =>
    setHidden((prev) => {
      const next = new Set(prev);
      for (const e of list) {
        if (hide) next.add(e.key);
        else next.delete(e.key);
      }
      return next;
    });

  const pin = (key: string) => {
    const next = pinned === key ? null : key;
    setPinned(next);
    setHoverKey(null);
    setHidden((prev) => {
      if (!prev.has(key)) return prev;
      const s = new Set(prev);
      s.delete(key);
      return s;
    });
    if (next && figureRef.current) {
      const r = figureRef.current.getBoundingClientRect();
      const seen = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
      if (seen < r.height * 0.6)
        figureRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const openChange = (id: string) => (open: boolean) =>
    setOpenId((cur) => (open ? id : cur === id ? null : cur));

  const hasCoords = entities.some((e) => e.points.length > 0);
  const totalSpawns = monstersE.reduce((s, e) => s + (e.monster?.spawnPoints ?? 0), 0);

  const mapCard = showMap && (
    <section aria-label="地圖" className="rounded-lg border border-border/60 bg-card">
      <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
        {monstersE.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <MarkerBadge entity={{ kind: "m", tag: "1", color: markerColor(0) }} />
            怪物（編號同下方清單）
          </span>
        )}
        {npcsE.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <MarkerBadge entity={{ kind: "n", tag: "A" }} />
            NPC
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <ClusterDot
            count={3}
            colors={[markerColor(1), markerColor(0), markerColor(2)]}
            className="size-[22px]"
          />
          重疊的點，點開看
        </span>
        <span className="w-full md:hidden">地圖可左右滑動</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {hidden.size > 0 && (
            <span className="inline-flex items-center gap-1">
              已隱藏 {hidden.size} 項
              <Button variant="ghost" size="xs" onClick={() => setHidden(new Set())}>
                全部顯示
              </Button>
            </span>
          )}
          {pinnedEntity && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-background py-0.5 pr-0.5 pl-1 text-foreground">
              <MarkerBadge entity={pinnedEntity} />
              <span className="font-medium">{pinnedEntity.name}</span>
              {pinnedEntity.monster && (
                <span className="text-muted-foreground tabular-nums">
                  Lv {pinnedEntity.monster.level}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="取消標亮"
                onClick={() => setPinned(null)}
              >
                <XIcon />
              </Button>
            </span>
          )}
        </div>
      </div>
      <figure
        ref={figureRef}
        className="m-2 overflow-x-auto rounded-md bg-muted/40"
        style={{ "--map-ar": image.imgWidth / image.imgHeight } as React.CSSProperties}
      >
        <div
          ref={mapRef}
          className="relative w-[160%] md:mx-auto md:w-full md:max-w-[calc(85vh*var(--map-ar))]"
          onClick={(e) => {
            const t = e.target as HTMLElement;
            if (t === e.currentTarget || t.tagName === "IMG") {
              setPinned(null);
              setOpenId(null);
            }
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- hotlink 直連，沿用 EntityPortrait 決策 */}
          <img
            src={image.url}
            alt={`${stageName} 地圖`}
            width={image.imgWidth}
            height={image.imgHeight}
            decoding="async"
            draggable={false}
            className="block h-auto w-full select-none"
          />
          {markers.map((m, i) => {
            const delay = settled ? undefined : `${150 + i * 12}ms`;
            if (m.type === "cluster") {
              return (
                <ClusterMarker
                  key={m.id}
                  left={m.left}
                  top={m.top}
                  members={m.members}
                  dimmed={active != null}
                  delay={delay}
                  open={openId === m.id}
                  onOpenChange={openChange(m.id)}
                  onPick={(p) => {
                    setPinned(p.entity.key);
                    setOpenId(p.pid);
                  }}
                />
              );
            }
            const p = m.point;
            return (
              <PointMarker
                key={p.pid}
                point={p}
                byName={entities}
                solo={m.solo}
                dimmed={active != null && !m.solo}
                delay={delay}
                open={openId === p.pid}
                onOpenChange={openChange(p.pid)}
                onSelect={() => setPinned(p.entity.key)}
              />
            );
          })}
        </div>
      </figure>
    </section>
  );

  const interactive = showMap && hasCoords;
  const rowProps = (e: Entity) => {
    const canPin = interactive && e.points.length > 0;
    return {
      "data-state": pinned === e.key && !hidden.has(e.key) ? "selected" : undefined,
      className: cn(
        "group/row",
        canPin && "cursor-pointer",
        hidden.has(e.key) && "[&>td:not(:has([data-row-skip]))]:opacity-45",
      ),
      style:
        pinned === e.key && !hidden.has(e.key)
          ? { boxShadow: `inset 3px 0 0 ${e.color ?? "var(--foreground)"}` }
          : undefined,
      onClick: canPin
        ? (ev: React.MouseEvent) => {
            if ((ev.target as HTMLElement).closest("[data-row-skip]")) return;
            pin(e.key);
          }
        : undefined,
      onMouseEnter: canPin && !hidden.has(e.key) ? () => setHoverKey(e.key) : undefined,
      onMouseLeave: canPin ? () => setHoverKey(null) : undefined,
    };
  };

  const nameCell = (e: Entity, extra?: React.ReactNode) => {
    const canPin = interactive && e.points.length > 0;
    const label = (
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium">{e.name}</span>
        {e.monster?.highHp && <HighHpBadge monster={e.monster} />}
      </span>
    );
    return (
      <TableCell className="w-full max-w-0">
        {canPin ? (
          // 列本身可點；這顆按鈕讓鍵盤與輔助工具也能標亮（click 會冒泡給列處理）。
          <button
            type="button"
            aria-pressed={pinned === e.key && !hidden.has(e.key)}
            aria-label={`在地圖上標亮 ${e.name}${e.monster ? ` Lv ${e.monster.level}` : ""}`}
            className="block w-full min-w-0 rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {label}
            {extra}
          </button>
        ) : (
          <>
            {label}
            {extra}
          </>
        )}
      </TableCell>
    );
  };

  const eyeCell = (e: Entity) =>
    interactive && (
      <TableCell className="w-10 px-1 text-center" data-row-skip>
        <Button
          variant="ghost"
          size="icon-sm"
          data-row-skip
          disabled={e.points.length === 0}
          aria-pressed={!hidden.has(e.key)}
          aria-label={`在地圖上顯示 ${e.name}${e.monster ? ` Lv ${e.monster.level}` : ""}`}
          onClick={() => toggleHidden(e.key)}
          className={cn(hidden.has(e.key) ? "text-muted-foreground/70" : "text-foreground/70")}
        >
          {hidden.has(e.key) ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      </TableCell>
    );

  const groupToggle = (list: Entity[]) => {
    if (!interactive) return null;
    const toggleable = list.filter((e) => e.points.length > 0);
    if (toggleable.length === 0) return null;
    const allHidden = toggleable.every((e) => hidden.has(e.key));
    return (
      <Button
        variant="ghost"
        size="xs"
        className="text-muted-foreground"
        onClick={() => setGroupHidden(toggleable, !allHidden)}
      >
        {allHidden ? "全部顯示" : "全部隱藏"}
      </Button>
    );
  };

  const note = (
    <p className="flex gap-2 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
      <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        地圖上的點是遊戲資料（GENERATOR.OBD）記錄的刷怪位置，不是怪物當下在哪；劇情或任務腳本叫出來的怪不在其中。
        {monstersE.some((e) => e.monster?.highHp) &&
          "標「高血量」的怪，HP 是本圖其他怪物中位數的 10 倍以上，只是數字比較，不是遊戲裡的首領設定。"}
        預設入口與登出點是遊戲設定的預設落點，不是完整的傳送路線。
      </span>
    </p>
  );

  const listCard = entities.length > 0 && (
    <section
      aria-label="地圖上的怪物與 NPC"
      className="overflow-hidden rounded-lg border border-border/60 bg-card"
    >
      {monstersE.length > 0 && (
        <>
          <SectionHead title="怪物" summary={`${monstersE.length} 種・${totalSpawns} 個刷怪點`}>
            {groupToggle(monstersE)}
          </SectionHead>
          <Table>
            <TableHeader className="bg-muted/40 text-xs [&_th]:h-8 [&_th]:font-normal [&_th]:text-muted-foreground">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 pl-4">
                  <span className="sr-only">編號</span>
                </TableHead>
                <TableHead className="hidden w-12 sm:table-cell">
                  <span className="sr-only">頭像</span>
                </TableHead>
                <TableHead>名稱</TableHead>
                <TableHead className="hidden text-right sm:table-cell">等級</TableHead>
                <TableHead className="hidden text-right sm:table-cell">HP</TableHead>
                <TableHead className="text-right">刷怪點</TableHead>
                {interactive && <TableHead className="text-center">顯示</TableHead>}
                <TableHead className="pr-4">
                  <span className="sr-only">資料</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monstersE.map((e) => {
                const m = e.monster!;
                const located = e.points.length;
                return (
                  <TableRow key={e.key} {...rowProps(e)}>
                    <TableCell className="pl-4">
                      <MarkerBadge entity={e} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <EntityPortrait image={e.image} alt={m.name} size="sm" />
                    </TableCell>
                    {nameCell(
                      e,
                      <span className="block text-xs text-muted-foreground tabular-nums sm:hidden">
                        <span className="font-medium text-foreground">Lv {m.level}</span>
                        {m.hp != null && m.hp > 0 && ` · HP ${m.hp.toLocaleString()}`}
                      </span>,
                    )}
                    <TableCell className="hidden text-right font-medium tabular-nums sm:table-cell">
                      Lv {m.level}
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                      {m.hp != null && m.hp > 0 ? m.hp.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground tabular-nums sm:text-sm">
                      {showMap && located < m.spawnPoints ? (
                        <span
                          title={
                            located === 0
                              ? "沒有可用座標，無法標在地圖上"
                              : `地圖上可標 ${located} 點`
                          }
                        >
                          {located}/{m.spawnPoints} 點
                        </span>
                      ) : (
                        `${m.spawnPoints} 點`
                      )}
                    </TableCell>
                    {eyeCell(e)}
                    <TableCell className="pr-3" data-row-skip>
                      <Link
                        href={`/monsters/${m.npcId}`}
                        data-row-skip
                        aria-label={`${m.name} Lv ${m.level} 怪物資料`}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "px-1.5 text-xs text-muted-foreground",
                        )}
                      >
                        <span className="hidden sm:inline">資料</span>
                        <ChevronRightIcon />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}
      {npcsE.length > 0 && (
        <>
          <SectionHead
            title="NPC"
            summary={`${npcsE.length} 位`}
            className={cn(monstersE.length > 0 && "border-t border-border/60 pt-5")}
          >
            {groupToggle(npcsE)}
          </SectionHead>
          <Table>
            <TableBody className="border-t border-border/60">
              {npcsE.map((e) => (
                <TableRow key={e.key} {...rowProps(e)}>
                  <TableCell className="w-10 pl-4">
                    <MarkerBadge entity={e} />
                  </TableCell>
                  <TableCell className="w-12">
                    <EntityPortrait image={e.image} alt={e.name} size="sm" />
                  </TableCell>
                  {nameCell(e)}
                  {eyeCell(e)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
      <div className="border-t border-border/60 bg-muted/40">{note}</div>
    </section>
  );

  return (
    <div className="space-y-6">
      {mapCard}
      <Layout aside={aside}>{listCard}</Layout>
    </div>
  );
}

function Layout({ aside, children }: { aside?: React.ReactNode; children?: React.ReactNode }) {
  if (!children) return aside ? <div className="space-y-4">{aside}</div> : null;
  if (!aside) return <>{children}</>;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      {children}
      <aside className="space-y-4">{aside}</aside>
    </div>
  );
}

function SectionHead({
  title,
  summary,
  className,
  children,
}: {
  title: string;
  summary: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-4 pt-4 pb-2", className)}>
      <h2 className="font-sans text-base font-medium">
        {title}
        <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
          {summary}
        </span>
      </h2>
      {children}
    </div>
  );
}

function MarkerBadge({
  entity,
  className,
}: {
  entity: Pick<Entity, "kind" | "tag" | "color">;
  className?: string;
}) {
  if (entity.kind === "n") {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-grid h-5 min-w-5 shrink-0 place-items-center rounded-[5px] border-2 border-foreground bg-card px-0.5 text-[10px] leading-none font-bold text-foreground",
          className,
        )}
      >
        {entity.tag}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      style={{ background: entity.color }}
      className={cn(
        "inline-grid size-[22px] shrink-0 place-items-center rounded-full text-[11px] leading-none font-bold text-white tabular-nums",
        className,
      )}
    >
      {entity.tag}
    </span>
  );
}

function ClusterDot({
  count,
  colors,
  className,
}: {
  count: number;
  colors: string[];
  className?: string;
}) {
  const stops = colors
    .map((c, i) => `${c} ${(i / colors.length) * 100}% ${((i + 1) / colors.length) * 100}%`)
    .join(",");
  return (
    <span
      aria-hidden
      className={cn("inline-grid size-[26px] shrink-0 rounded-full p-[3px]", className)}
      style={{ background: `conic-gradient(${stops})` }}
    >
      <span className="grid place-items-center rounded-full bg-card text-[11px] leading-none font-bold text-foreground tabular-nums">
        {count}
      </span>
    </span>
  );
}

function HighHpBadge({ monster }: { monster: MapMonster }) {
  const badge = (
    <Badge
      variant="outline"
      className="h-4 rounded-sm border-primary/30 px-1 text-[11px] font-normal text-primary/85"
    >
      高血量
    </Badge>
  );
  if (monster.hpRatio == null) return badge;
  return (
    <Tooltip>
      <TooltipTrigger render={badge} data-row-skip />
      <TooltipContent>HP 約為本圖其他怪物中位數的 {formatRatio(monster.hpRatio)} 倍</TooltipContent>
    </Tooltip>
  );
}

const markerBase =
  "absolute z-[2] grid size-8 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full outline-hidden transition-[opacity,scale] duration-200 hover:z-[4] hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/70";

function enterStyle(delay: string | undefined, left: number, top: number): React.CSSProperties {
  return { left: `${left}%`, top: `${top}%`, animationDelay: delay };
}
const enterClass = "animate-in fade-in zoom-in-50 duration-400 [animation-fill-mode:both]";

interface PointMarkerProps {
  point: MapPoint;
  byName: Entity[];
  solo: boolean;
  dimmed: boolean;
  delay?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: () => void;
}

function PointMarker({
  point,
  byName,
  solo,
  dimmed,
  delay,
  open,
  onOpenChange,
  onSelect,
}: PointMarkerProps) {
  const e = point.entity;
  const m = e.monster;
  const total = e.points.length;
  const label = m
    ? `${e.name} Lv ${m.level}${total > 1 ? `（刷怪點 ${point.index + 1}/${total}）` : ""}`
    : e.name;
  const sameNameMonster =
    e.kind === "n" ? byName.find((o) => o.kind === "m" && o.name === e.name) : undefined;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        aria-label={label}
        openOnHover
        delay={0}
        onClick={onSelect}
        data-dimmed={dimmed || undefined}
        style={enterStyle(delay, point.left, point.top)}
        className={cn(
          markerBase,
          enterClass,
          dimmed && "z-[1] opacity-30",
          solo && "z-[3] scale-115",
        )}
      >
        {e.kind === "m" ? (
          <span
            className="grid size-[22px] place-items-center rounded-full border-2 border-white text-[11px] leading-none font-bold text-white tabular-nums shadow-[0_1px_3px_rgb(0_0_0/0.45)]"
            style={{ background: e.color }}
          >
            {e.tag}
          </span>
        ) : (
          <span className="grid h-5 min-w-5 place-items-center rounded-[5px] border-2 border-foreground bg-card px-0.5 text-[10px] leading-none font-bold text-foreground shadow-[0_1px_3px_rgb(0_0_0/0.45)]">
            {e.tag}
          </span>
        )}
        {solo && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0.5 animate-ping rounded-full border-2 border-white [animation-fill-mode:forwards] [animation-iteration-count:2]"
          />
        )}
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 flex-row items-start gap-3">
        <EntityPortrait image={e.image} alt={e.name} size="sm" className="size-11" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <MarkerBadge entity={e} />
            <span className="truncate font-medium">{e.name}</span>
          </div>
          {m ? (
            <>
              <div className="flex items-baseline gap-3 tabular-nums">
                <span className="font-medium">Lv {m.level}</span>
                {m.hp != null && m.hp > 0 && (
                  <span className="text-xs text-muted-foreground">HP {m.hp.toLocaleString()}</span>
                )}
              </div>
              {total > 1 && (
                <div className="text-xs text-muted-foreground tabular-nums">
                  刷怪點 {point.index + 1} / {total}
                </div>
              )}
              {m.highHp && m.hpRatio != null && (
                <div className="text-xs text-muted-foreground">
                  高血量：HP 約為本圖其他怪物中位數的 {formatRatio(m.hpRatio)} 倍
                </div>
              )}
              <Link
                href={`/monsters/${m.npcId}`}
                className="inline-flex items-center gap-0.5 pt-0.5 text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                怪物資料
                <ChevronRightIcon className="size-3.5" aria-hidden />
              </Link>
            </>
          ) : (
            <div className="text-xs text-muted-foreground">
              NPC{sameNameMonster && `，同名怪物見 ${sameNameMonster.tag} 號`}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ClusterMarkerProps {
  left: number;
  top: number;
  members: MapPoint[];
  dimmed: boolean;
  delay?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (p: MapPoint) => void;
}

function ClusterMarker({
  left,
  top,
  members,
  dimmed,
  delay,
  open,
  onOpenChange,
  onPick,
}: ClusterMarkerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        aria-label={`${members.length} 個重疊的標記：${members.map((p) => p.entity.name).join("、")}`}
        openOnHover
        delay={0}
        data-dimmed={dimmed || undefined}
        style={enterStyle(delay, left, top)}
        className={cn(markerBase, enterClass, dimmed && "z-[1] opacity-30")}
      >
        <ClusterDot
          count={members.length}
          colors={members.map((p) => p.entity.color ?? "var(--foreground)")}
          className="shadow-[0_1px_4px_rgb(0_0_0/0.5)]"
        />
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 gap-1.5">
        <div className="text-xs text-muted-foreground">這裡有 {members.length} 個標記</div>
        <div className="-mx-1 space-y-0.5">
          {members.map((p) => (
            <button
              key={p.pid}
              type="button"
              onClick={() => onPick(p)}
              className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <MarkerBadge entity={p.entity} />
              <span className="min-w-0 flex-1 truncate">{p.entity.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {p.entity.monster
                  ? `Lv ${p.entity.monster.level}${p.entity.monster.hp ? ` · HP ${p.entity.monster.hp.toLocaleString()}` : ""}`
                  : "NPC"}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
