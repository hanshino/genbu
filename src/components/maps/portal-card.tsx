"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRightIcon, MessageSquareIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { PortalExit, PortalOption, PortalPoint, StageMapImage } from "@/lib/queries/maps";
import type { StageKind } from "@/lib/types/stage";

/** 傳點名稱：單一目的地寫去哪；對話選單寫幾個目的地；同事件拆成多區時補區號。 */
export function portalTitle(exit: PortalExit): string {
  const base =
    exit.options.length > 1
      ? `對話選擇（${exit.options.length} 個目的地）`
      : `往${exit.options[0]?.dest.name ?? "未知地圖"}`;
  return exit.parts > 1 ? `${base}・第 ${exit.part} 區／共 ${exit.parts} 區` : base;
}

export const isSameMap = (o: PortalOption, kind: StageKind, id: number) =>
  o.dest.kind === kind && o.dest.id === id;

interface PortalCardProps {
  exit: PortalExit;
  stageKind: StageKind;
  stageId: number;
  optionKey: string | null;
  onOption: (key: string) => void;
  onClose: () => void;
}

export function PortalCard({
  exit,
  stageKind,
  stageId,
  optionKey,
  onOption,
  onClose,
}: PortalCardProps) {
  const option = exit.options.find((o) => o.key === optionKey) ?? null;
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium">{portalTitle(exit)}</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            傳點・{exit.cells.length} 個踩點格
          </div>
        </div>
        <Button variant="ghost" size="icon-xs" aria-label="關閉傳點資訊" onClick={onClose}>
          <XIcon />
        </Button>
      </div>

      {exit.options.length > 1 && (
        <div className="space-y-1">
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MessageSquareIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              對話選擇目的地
              {exit.prompt && <span className="block text-foreground">「{exit.prompt}」</span>}
            </span>
          </div>
          <div className="-mx-1 space-y-0.5">
            {exit.options.map((o) => (
              <Button
                key={o.key}
                variant="ghost"
                aria-pressed={o.key === optionKey}
                onClick={() => onOption(o.key)}
                className="h-auto w-full flex-col items-start gap-0 px-2 py-1.5 text-left whitespace-normal aria-pressed:bg-primary/8 aria-pressed:shadow-[inset_3px_0_0_var(--primary)]"
              >
                <span className="font-medium">{o.label ?? "（選項文字未收錄）"}</span>
                <span className="text-xs font-normal text-muted-foreground">→ {o.dest.name}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {option ? (
        <Destination option={option} sameMap={isSameMap(option, stageKind, stageId)} />
      ) : (
        <p className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
          選一個選項來看目的地
        </p>
      )}
    </div>
  );
}

function Destination({ option, sameMap }: { option: PortalOption; sameMap: boolean }) {
  const { dest, landings } = option;
  const img = sameMap ? null : dest.image;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-sm font-medium">通往{dest.name}</span>
        {option.instance && (
          <Badge variant="outline" className="font-normal">
            副本
          </Badge>
        )}
        {landings.length === 0 && <span className="text-xs text-muted-foreground">落點未收錄</span>}
      </div>
      {sameMap
        ? landings.length > 0 && (
            <p className="text-xs text-muted-foreground">目的地就是本圖，落點已標在地圖上。</p>
          )
        : img && <Thumb key={option.key} img={img} landings={landings} name={dest.name} />}
      {!sameMap && img && landings.length > 0 && (
        <p className="text-xs text-muted-foreground">
          縮圖上的點是傳過去後的落點（{landings.length} 處）。
        </p>
      )}
      {!sameMap && dest.kind != null && (
        <Link href={`/maps/${dest.id}`} className={cn(buttonVariants({ size: "sm" }), "w-full")}>
          前往{dest.name}
          <ArrowUpRightIcon data-icon="inline-end" />
        </Link>
      )}
    </div>
  );
}

/** 縮圖框固定 4:3；視窗以圖片像素表示，寬高比恆為 4:3。 */
type View = { x: number; y: number; w: number; h: number };
const FRAME = 4 / 3;

/** 整張圖塞進 4:3 框（contain），多出的部分是框底色。 */
export function fullView(imgW: number, imgH: number): View {
  if (imgW / imgH > FRAME) {
    const h = imgW / FRAME;
    return { x: 0, y: (imgH - h) / 2, w: imgW, h };
  }
  const w = imgH * FRAME;
  return { x: (imgW - w) / 2, y: 0, w, h: imgH };
}

/**
 * 落點附近約 60×45 格的視窗（兼顧周邊環境與落點辨識），落點散得更開就放大到全部框進來（四周留 4 格）。
 * 圖比視窗大時夾在圖內、不露出圖外空白；圖比視窗小的那一邊就置中。
 */
export function landingView(
  imgW: number,
  imgH: number,
  tile: number,
  landings: PortalPoint[],
): View {
  const xs = landings.map((p) => p[0]);
  const ys = landings.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const margin = 8 * tile;
  const w = Math.max(60 * tile, x1 - x0 + margin, (y1 - y0 + margin) * FRAME);
  const h = w / FRAME;
  const place = (center: number, size: number, total: number) =>
    size >= total ? (total - size) / 2 : Math.min(Math.max(center - size / 2, 0), total - size);
  return { x: place((x0 + x1) / 2, w, imgW), y: place((y0 + y1) / 2, h, imgH), w, h };
}

const pct = (n: number) => `${n * 100}%`;

function Thumb({
  img,
  landings,
  name,
}: {
  img: StageMapImage;
  landings: PortalPoint[];
  name: string;
}) {
  const [full, setFull] = React.useState(false);
  const hasLandings = landings.length > 0;
  const v =
    hasLandings && !full
      ? landingView(img.imgWidth, img.imgHeight, img.tilePx || 40, landings)
      : fullView(img.imgWidth, img.imgHeight);
  return (
    // 縮圖不是連結：只有下方按鈕會換頁，避免捲動或誤觸時被帶走。
    <div
      data-portal-thumb
      data-view={hasLandings && !full ? "landings" : "full"}
      className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-border/60 bg-muted"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- hotlink 直連，沿用 StageMapViewer 決策 */}
      <img
        src={img.url}
        alt={`${name} 地圖縮圖`}
        width={img.imgWidth}
        height={img.imgHeight}
        loading="lazy"
        decoding="async"
        draggable={false}
        // 只用定位與縮放裁出視窗，同一張圖、不另外請求。
        style={{
          left: pct(-v.x / v.w),
          top: pct(-v.y / v.h),
          width: pct(img.imgWidth / v.w),
          height: pct(img.imgHeight / v.h),
        }}
        className="absolute max-w-none select-none"
      />
      {landings.map(([x, y], i) => (
        <span
          key={i}
          aria-hidden
          data-portal-landing
          style={{ left: pct((x - v.x) / v.w), top: pct((y - v.y) / v.h) }}
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-[0_0_0_1px_rgb(0_0_0/0.4)]"
        />
      ))}
      {hasLandings && (
        <ToggleGroup
          aria-label="縮圖範圍"
          value={[full ? "full" : "landings"]}
          onValueChange={(value) => value[0] && setFull(value[0] === "full")}
          className="absolute top-1.5 right-1.5 bg-secondary/90 shadow-sm"
        >
          <ToggleGroupItem value="landings" size="sm">
            落點附近
          </ToggleGroupItem>
          <ToggleGroupItem value="full" size="sm">
            全圖
          </ToggleGroupItem>
        </ToggleGroup>
      )}
    </div>
  );
}
