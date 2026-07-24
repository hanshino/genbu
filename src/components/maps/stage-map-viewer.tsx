"use client";

import * as React from "react";
import { EntityPortrait } from "@/components/common/entity-portrait";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { EntityImage } from "@/lib/queries/images";
import type { NpcPlacement, StageMapImage } from "@/lib/queries/maps";

interface StageMapViewerProps {
  stageName: string;
  image: StageMapImage | null;
  placements: NpcPlacement[];
}

interface NpcEntry {
  npcId: number;
  name: string | null;
  image: EntityImage | null;
}

export function StageMapViewer({ stageName, image, placements }: StageMapViewerProps) {
  const [hovered, setHovered] = React.useState<number | null>(null);

  const npcs = React.useMemo<NpcEntry[]>(() => {
    const seen = new Map<number, NpcEntry>();
    for (const p of placements) {
      if (!seen.has(p.npcId)) {
        seen.set(p.npcId, { npcId: p.npcId, name: p.name, image: p.image });
      }
    }
    return [...seen.values()];
  }, [placements]);

  if (!image && npcs.length === 0) return null;

  return (
    <section className="space-y-4">
      {image && (
        <figure className="relative overflow-hidden rounded-lg border border-border/60 bg-muted/20">
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
          {placements.map((p, i) => (
            <NpcDot
              key={`${p.npcId}-${p.rawX}-${p.rawY}-${i}`}
              placement={p}
              imgWidth={image.imgWidth}
              imgHeight={image.imgHeight}
              active={hovered === p.npcId}
              onActiveChange={(on) => setHovered(on ? p.npcId : null)}
            />
          ))}
        </figure>
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
                onMouseEnter={() => setHovered(n.npcId)}
                onMouseLeave={() => setHovered(null)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 transition-colors",
                  hovered === n.npcId && "bg-muted/50",
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

interface NpcDotProps {
  placement: NpcPlacement;
  imgWidth: number;
  imgHeight: number;
  active: boolean;
  onActiveChange: (active: boolean) => void;
}

function NpcDot({ placement, imgWidth, imgHeight, active, onActiveChange }: NpcDotProps) {
  const label = placement.name ?? `NPC #${placement.npcId}`;
  // raw_x/raw_y 是合成圖像素座標，直接換百分比即與圖片對齊（見 NpcPlacement 註解）。
  const left = (placement.rawX / imgWidth) * 100;
  const top = (placement.rawY / imgHeight) * 100;

  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        openOnHover
        delay={0}
        onMouseEnter={() => onActiveChange(true)}
        onMouseLeave={() => onActiveChange(false)}
        onFocus={() => onActiveChange(true)}
        onBlur={() => onActiveChange(false)}
        style={{ left: `${left}%`, top: `${top}%` }}
        className={cn(
          "absolute size-3 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full",
          "border-2 border-background bg-primary shadow outline-hidden",
          "ring-primary/50 transition-transform focus-visible:ring-4",
          active && "z-10 scale-150 ring-4",
        )}
      />
      <PopoverContent className="w-auto max-w-xs flex-row items-center gap-2.5">
        <EntityPortrait image={placement.image} alt={label} size="sm" />
        <span className="font-medium">{label}</span>
      </PopoverContent>
    </Popover>
  );
}
