"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRightIcon, LocateFixedIcon, SkullIcon } from "lucide-react";
import { EntityPortrait } from "@/components/common/entity-portrait";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { EntityImage } from "@/lib/queries/images";
import type { NpcPlacement, StageMapImage, StageMonsterMarker } from "@/lib/queries/maps";

interface StageMapViewerProps {
  stageName: string;
  image: StageMapImage | null;
  placements: NpcPlacement[];
  /** 已由 buildMonsterMarkers 算好 highHp 與百分比座標；UI 不再做任何判斷。 */
  monsters?: StageMonsterMarker[];
}

interface NpcEntry {
  npcId: number;
  name: string | null;
  image: EntityImage | null;
}

/** 圖層 key：NPC 整組一個開關，怪物每種一個。 */
const NPC_LAYER = "npc";
const monsterLayer = (npcId: number) => `m:${npcId}`;

/** 一般怪物依清單順序輪用的顏色；形狀（菱形）才是和 NPC 區分的主要線索。 */
const SPECIES_COLORS = ["bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

type Highlight = { layer: string; npcId?: number } | null;

function formatRatio(r: number) {
  return r >= 100 ? Math.round(r).toLocaleString() : r.toFixed(1);
}

export function StageMapViewer({
  stageName,
  image,
  placements,
  monsters = [],
}: StageMapViewerProps) {
  const npcs = React.useMemo<NpcEntry[]>(() => {
    const seen = new Map<number, NpcEntry>();
    for (const p of placements) {
      if (!seen.has(p.npcId)) seen.set(p.npcId, { npcId: p.npcId, name: p.name, image: p.image });
    }
    return [...seen.values()];
  }, [placements]);

  // 高血量排最前面，其餘維持查詢順序（等級遞增）。
  const species = React.useMemo(
    () => [...monsters].sort((a, b) => Number(b.highHp) - Number(a.highHp)),
    [monsters],
  );
  const colorOf = React.useMemo(() => {
    const map = new Map<number, string>();
    let i = 0;
    for (const m of species)
      if (!m.highHp) map.set(m.npcId, SPECIES_COLORS[i++ % SPECIES_COLORS.length]);
    return map;
  }, [species]);

  // 能開關的圖層：有 NPC placement 的 NPC 組、有座標的怪物。
  const toggleable = React.useMemo(() => {
    const keys: string[] = [];
    if (placements.length > 0) keys.push(NPC_LAYER);
    for (const m of species) if (m.points.length > 0) keys.push(monsterLayer(m.npcId));
    return keys;
  }, [placements.length, species]);

  const [visible, setVisible] = React.useState<Set<string>>(() => {
    const init = new Set<string>([NPC_LAYER]);
    for (const m of monsters) if (m.highHp && m.points.length > 0) init.add(monsterLayer(m.npcId));
    return init;
  });
  const [highlight, setHighlight] = React.useState<Highlight>(null);

  const setLayer = (layer: string, on: boolean) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (on) next.add(layer);
      else next.delete(layer);
      return next;
    });
    if (!on && highlight?.layer === layer) setHighlight(null);
  };

  // 關閉時只清掉自己，避免切到另一個點時把新的標亮蓋掉。
  const toggleHighlight = (target: NonNullable<Highlight>, on: boolean) =>
    setHighlight((h) => {
      if (on) return target;
      return h?.layer === target.layer && h.npcId === target.npcId ? null : h;
    });

  // 被標亮的圖層若已隱藏就視同沒有標亮，避免其他點莫名變淡。
  const activeHighlight = highlight && visible.has(highlight.layer) ? highlight : null;
  const isDimmed = (layer: string, npcId?: number) =>
    activeHighlight != null &&
    (activeHighlight.layer !== layer ||
      (activeHighlight.npcId != null && activeHighlight.npcId !== npcId));
  const isEmphasized = (layer: string, npcId?: number) =>
    activeHighlight != null && !isDimmed(layer, npcId);

  if (!image && npcs.length === 0 && species.length === 0) return null;

  const totalPoints = species.reduce((s, m) => s + m.spawnPoints, 0);
  const showMap = image != null;
  const allOn = toggleable.every((k) => visible.has(k));
  const allOff = toggleable.every((k) => !visible.has(k));

  const monsterList = species.length > 0 && (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">怪物出沒</h2>
        <span className="text-xs text-muted-foreground">
          {species.length} 種 · 共 {totalPoints} 個刷怪點
        </span>
      </div>
      <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
        {species.map((m) => (
          <MonsterRow
            key={m.npcId}
            monster={m}
            color={colorOf.get(m.npcId)}
            interactive={showMap}
            checked={visible.has(monsterLayer(m.npcId))}
            onCheckedChange={(on) => setLayer(monsterLayer(m.npcId), on)}
            focused={activeHighlight?.layer === monsterLayer(m.npcId)}
            onFocusToggle={() =>
              setHighlight((h) =>
                h?.layer === monsterLayer(m.npcId) ? null : { layer: monsterLayer(m.npcId) },
              )
            }
          />
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        「高血量」＝HP 達本圖其他怪物 HP 中位數的 10 倍以上，只是數值比較，不代表遊戲內的首領設定。
      </p>
    </div>
  );

  return (
    <section className="space-y-6">
      {showMap ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
          <figure className="relative overflow-hidden rounded-lg border border-border/60 bg-muted/20 lg:order-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- hotlink 直連，沿用 EntityPortrait 決策 */}
            <img
              src={image.url}
              alt={`${stageName} 地圖`}
              width={image.imgWidth}
              height={image.imgHeight}
              loading="lazy"
              decoding="async"
              className="block h-auto w-full"
            />
            {visible.has(NPC_LAYER) &&
              placements.map((p, i) => (
                <NpcMarker
                  key={`${p.npcId}-${p.rawX}-${p.rawY}-${i}`}
                  placement={p}
                  imgWidth={image.imgWidth}
                  imgHeight={image.imgHeight}
                  dimmed={isDimmed(NPC_LAYER, p.npcId)}
                  emphasized={isEmphasized(NPC_LAYER, p.npcId)}
                  onOpenChange={(open) =>
                    toggleHighlight({ layer: NPC_LAYER, npcId: p.npcId }, open)
                  }
                />
              ))}
            {species.map(
              (m) =>
                visible.has(monsterLayer(m.npcId)) &&
                m.points.map((pt, i) => (
                  <MonsterMarker
                    key={`${m.npcId}-${i}`}
                    monster={m}
                    index={i}
                    left={pt.left}
                    top={pt.top}
                    color={colorOf.get(m.npcId)}
                    dimmed={isDimmed(monsterLayer(m.npcId))}
                    emphasized={isEmphasized(monsterLayer(m.npcId))}
                    onOpenChange={(open) => toggleHighlight({ layer: monsterLayer(m.npcId) }, open)}
                  />
                )),
            )}
          </figure>

          <aside
            aria-label="地圖標記"
            className="space-y-4 lg:sticky lg:top-18 lg:order-2 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto"
          >
            <div className="space-y-3 rounded-lg border border-border/60 bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium">地圖標記</h2>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={allOn}
                    onClick={() => setVisible(new Set(toggleable))}
                  >
                    全部顯示
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={allOff}
                    onClick={() => {
                      setVisible(new Set());
                      setHighlight(null);
                    }}
                  >
                    全部隱藏
                  </Button>
                </div>
              </div>
              {placements.length > 0 && (
                <div className="flex min-h-11 items-center gap-3 rounded-md px-1">
                  <Checkbox
                    id="npc-layer"
                    checked={visible.has(NPC_LAYER)}
                    onCheckedChange={(on) => setLayer(NPC_LAYER, on)}
                  />
                  <span
                    className="size-3 shrink-0 rounded-full border-2 border-background bg-primary shadow"
                    aria-hidden
                  />
                  <label htmlFor="npc-layer" className="flex-1 cursor-pointer text-sm font-medium">
                    NPC
                  </label>
                  <span className="font-mono text-xs text-muted-foreground">{npcs.length} 位</span>
                </div>
              )}
              <div className="space-y-1.5 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-2.5 rounded-full border-2 border-background bg-primary shadow"
                      aria-hidden
                    />
                    NPC
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <SpeciesSwatch highHp={false} color="bg-chart-3" />
                    怪物
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <SpeciesSwatch highHp />
                    高血量怪物
                  </span>
                </div>
                <p>點位是資料記錄的刷怪位置，不是怪物當下的即時位置。</p>
              </div>
              {toggleable.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  這張地圖沒有可標示位置的 NPC 或怪物。
                </p>
              )}
            </div>
            {monsterList}
          </aside>
        </div>
      ) : (
        monsterList
      )}

      {npcs.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-medium">
            出沒 NPC
            <span className="ml-2 text-sm font-normal text-muted-foreground">{npcs.length}</span>
          </h2>
          <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
            {npcs.map((n) => (
              <li
                key={n.npcId}
                // ponytail: 清單 hover 只是加強提示；地圖點本身可用鍵盤／觸控開啟。
                onMouseEnter={() => toggleHighlight({ layer: NPC_LAYER, npcId: n.npcId }, true)}
                onMouseLeave={() => toggleHighlight({ layer: NPC_LAYER, npcId: n.npcId }, false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 transition-colors",
                  isEmphasized(NPC_LAYER, n.npcId) && "bg-muted/50",
                )}
              >
                <EntityPortrait image={n.image} alt={n.name ?? "NPC"} size="sm" />
                <span className="font-medium">{n.name ?? `NPC #${n.npcId}`}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">#{n.npcId}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function SpeciesSwatch({ highHp, color }: { highHp: boolean; color?: string }) {
  if (highHp) {
    return (
      <span
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-background bg-destructive text-white shadow"
        aria-hidden
      >
        <SkullIcon className="size-2.5" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "size-2.5 shrink-0 rotate-45 rounded-[2px] border-2 border-background shadow",
        color,
      )}
      aria-hidden
    />
  );
}

function HighHpBadge() {
  return (
    <Badge variant="destructive">
      <SkullIcon aria-hidden />
      高血量
    </Badge>
  );
}

function hpRatioText(m: StageMonsterMarker) {
  return m.hpRatio != null ? `HP 約為本圖其他怪物 HP 中位數的 ${formatRatio(m.hpRatio)} 倍` : null;
}

interface MonsterRowProps {
  monster: StageMonsterMarker;
  color?: string;
  /** 無地圖圖片時只顯示資訊與連結，不放假的開關。 */
  interactive: boolean;
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
  focused: boolean;
  onFocusToggle: () => void;
}

function MonsterRow({
  monster: m,
  color,
  interactive,
  checked,
  onCheckedChange,
  focused,
  onFocusToggle,
}: MonsterRowProps) {
  const located = m.points.length;
  const noCoords = located === 0;
  const checkboxId = `monster-layer-${m.npcId}`;
  const statusId = `monster-layer-${m.npcId}-status`;

  let pointText = `×${m.spawnPoints}`;
  if (interactive && noCoords) pointText = `共 ${m.spawnPoints} 點，無可用座標，無法標在地圖上`;
  else if (interactive && located < m.spawnPoints)
    pointText = `地圖可標 ${located} / 共 ${m.spawnPoints} 點`;

  const info = (
    <div className="min-w-0 flex-1 space-y-0.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {interactive ? (
          <label htmlFor={checkboxId} className={cn("font-medium", !noCoords && "cursor-pointer")}>
            {m.name}
          </label>
        ) : (
          <span className="font-medium">{m.name}</span>
        )}
        {m.highHp && <HighHpBadge />}
      </div>
      <div className="flex flex-wrap gap-x-2 font-mono text-xs text-muted-foreground">
        <span>Lv {m.level}</span>
        {m.hp != null && m.hp > 0 && <span>HP {m.hp.toLocaleString()}</span>}
        <span id={statusId}>{pointText}</span>
      </div>
      {m.highHp && hpRatioText(m) && (
        <p className="text-xs text-muted-foreground">{hpRatioText(m)}</p>
      )}
    </div>
  );

  return (
    <li
      className={cn(
        "flex min-h-11 items-center gap-3 px-3 py-2 transition-colors",
        focused && "bg-muted/60",
      )}
    >
      {interactive && (
        <Checkbox
          id={checkboxId}
          checked={checked}
          disabled={noCoords}
          aria-describedby={statusId}
          onCheckedChange={onCheckedChange}
        />
      )}
      <SpeciesSwatch highHp={m.highHp} color={color} />
      {info}
      {interactive && !noCoords && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`在地圖上標亮 ${m.name}`}
          aria-pressed={focused}
          disabled={!checked}
          onClick={onFocusToggle}
          className={cn(focused && "bg-muted text-foreground")}
        >
          <LocateFixedIcon />
        </Button>
      )}
      <Link
        href={`/monsters/${m.npcId}`}
        aria-label={`${m.name} 怪物資料`}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronRightIcon className="size-4" />
      </Link>
    </li>
  );
}

const markerTriggerClass =
  "absolute flex size-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full outline-hidden transition-opacity focus-visible:ring-4 focus-visible:ring-ring/60";

interface NpcMarkerProps {
  placement: NpcPlacement;
  imgWidth: number;
  imgHeight: number;
  dimmed: boolean;
  emphasized: boolean;
  onOpenChange: (open: boolean) => void;
}

function NpcMarker({
  placement,
  imgWidth,
  imgHeight,
  dimmed,
  emphasized,
  onOpenChange,
}: NpcMarkerProps) {
  const label = placement.name ?? `NPC #${placement.npcId}`;
  // raw_x/raw_y 是合成圖像素座標，直接換百分比即與圖片對齊（見 NpcPlacement 註解）。
  const left = (placement.rawX / imgWidth) * 100;
  const top = (placement.rawY / imgHeight) * 100;

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger
        aria-label={label}
        openOnHover
        delay={0}
        style={{ left: `${left}%`, top: `${top}%` }}
        className={cn(
          markerTriggerClass,
          dimmed && "pointer-events-none opacity-30",
          emphasized && "z-10",
        )}
      >
        <span
          className={cn(
            "size-3 rounded-full border-2 border-background bg-primary shadow transition-transform",
            emphasized && "scale-150 ring-4 ring-primary/50",
          )}
          aria-hidden
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-xs flex-row items-center gap-2.5">
        <EntityPortrait image={placement.image} alt={label} size="sm" />
        <span className="font-medium">{label}</span>
      </PopoverContent>
    </Popover>
  );
}

interface MonsterMarkerProps {
  monster: StageMonsterMarker;
  index: number;
  left: number;
  top: number;
  color?: string;
  dimmed: boolean;
  emphasized: boolean;
  onOpenChange: (open: boolean) => void;
}

function MonsterMarker({
  monster: m,
  index,
  left,
  top,
  color,
  dimmed,
  emphasized,
  onOpenChange,
}: MonsterMarkerProps) {
  const total = m.points.length;
  const label = total > 1 ? `${m.name}（刷怪點 ${index + 1}/${total}）` : m.name;

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger
        aria-label={label}
        openOnHover
        delay={0}
        style={{ left: `${left}%`, top: `${top}%` }}
        className={cn(
          markerTriggerClass,
          m.highHp && "z-[5]",
          dimmed && "pointer-events-none opacity-30",
          emphasized && "z-10",
        )}
      >
        {m.highHp ? (
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full border-2 border-background bg-destructive text-white shadow-md transition-transform",
              emphasized && "scale-125 ring-4 ring-destructive/40",
            )}
            aria-hidden
          >
            <SkullIcon className="size-3" strokeWidth={2.5} />
          </span>
        ) : (
          <span
            className={cn(
              "size-3 rotate-45 rounded-[2px] border-2 border-background shadow transition-transform",
              color,
              emphasized && "scale-150 ring-4 ring-foreground/30",
            )}
            aria-hidden
          />
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{m.name}</span>
          {m.highHp && <HighHpBadge />}
        </div>
        <div className="flex flex-wrap gap-x-2 font-mono text-xs text-muted-foreground">
          <span>Lv {m.level}</span>
          {m.hp != null && m.hp > 0 && <span>HP {m.hp.toLocaleString()}</span>}
          {total > 1 && (
            <span>
              刷怪點 {index + 1}/{total}
            </span>
          )}
        </div>
        {m.highHp && hpRatioText(m) && (
          <p className="text-xs text-muted-foreground">{hpRatioText(m)}（10 倍以上標為高血量）</p>
        )}
        <Link
          href={`/monsters/${m.npcId}`}
          className="inline-flex items-center gap-0.5 self-start text-xs font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid"
        >
          查看怪物資料
          <ChevronRightIcon className="size-3.5" aria-hidden />
        </Link>
      </PopoverContent>
    </Popover>
  );
}
