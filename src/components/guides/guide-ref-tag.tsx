"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { PreviewCard } from "@base-ui/react/preview-card";
import {
  ArrowRightIcon,
  MapIcon,
  PackageIcon,
  ScrollTextIcon,
  SkullIcon,
  SparklesIcon,
} from "lucide-react";
import type { GuideRef, GuideRefIcon, GuideRefKind } from "@/lib/guide-refs";
import { cn } from "@/lib/utils";

const KIND = {
  item: { label: "道具", Icon: PackageIcon },
  map: { label: "地圖", Icon: MapIcon },
  monster: { label: "怪物", Icon: SkullIcon },
  skill: { label: "技能", Icon: SparklesIcon },
  mission: { label: "任務", Icon: ScrollTextIcon },
} satisfies Record<GuideRefKind, { label: string; Icon: typeof PackageIcon }>;

/**
 * 遊戲圖：載入失敗退回 lucide icon。
 * 只有「放大」時才用 nearest-neighbor（像素圖放大才清楚）；
 * 縮小（怪物立繪、inline 小圖）交給瀏覽器平滑，避免鋸齒。
 */
function GameIcon({
  icon,
  kind,
  box,
  className,
  fallbackClassName,
}: {
  icon: GuideRefIcon | null;
  kind: GuideRefKind;
  box: number;
  className: string;
  fallbackClassName: string;
}) {
  const [broken, setBroken] = useState(false);
  const { Icon } = KIND[kind];
  if (!icon || broken) return <Icon className={fallbackClassName} aria-hidden />;
  const upscale = Math.max(icon.width ?? 0, icon.height ?? 0) < box;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 與 ItemIcon 相同：hotlink 直連，不走 next/image optimizer
    <img
      src={icon.url}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      // SSR 的圖可能在 hydration 前就載入失敗，onError 來不及掛上，mount 時補查一次
      ref={(el) => {
        if (el?.complete && el.naturalWidth === 0) setBroken(true);
      }}
      className={cn("object-contain", upscale && "[image-rendering:pixelated]", className)}
    />
  );
}

/**
 * 內文資料標籤：本身是連結，點了就跳到資料頁。
 * - 滑鼠：hover 開預覽，點擊跳頁
 * - 鍵盤：focus 開預覽，Enter 跳頁
 * - 觸控：第一下 tap 開預覽（攔下導航），預覽開著時再 tap 才跳頁；卡內也有「查看完整資料」
 */
export function GuideRefTag({ data, children }: { data: GuideRef; children?: ReactNode }) {
  const { label, Icon } = KIND[data.kind];
  const [open, setOpen] = useState(false);
  const pointerType = useRef<string>("");

  return (
    <PreviewCard.Root open={open} onOpenChange={setOpen}>
      <PreviewCard.Trigger
        delay={200}
        closeDelay={120}
        render={<Link href={data.href} />}
        onPointerDown={(e) => {
          pointerType.current = e.pointerType;
        }}
        onClick={(e) => {
          if (pointerType.current === "touch" && !open) {
            e.preventDefault();
            setOpen(true);
          }
          pointerType.current = "";
        }}
        className="decoration-primary/60 hover:bg-primary/10 hover:decoration-primary data-popup-open:bg-primary/10 focus-visible:ring-ring rounded-sm px-px whitespace-nowrap underline decoration-dashed decoration-1 underline-offset-[5px] outline-none focus-visible:ring-2 motion-safe:transition-colors"
      >
        <GameIcon
          icon={data.icon}
          kind={data.kind}
          box={22}
          className="mr-0.5 -my-[0.2em] inline-block size-[1.35em] align-middle"
          fallbackClassName="text-primary mr-0.5 inline size-[0.78em] align-[-0.05em]"
        />
        {children ?? data.name}
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner side="top" sideOffset={8} collisionPadding={12} className="z-50">
          <PreviewCard.Popup className="bg-card text-popover-foreground data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 flex w-68 origin-(--transform-origin) flex-col rounded-xl border p-3.5 text-[13.5px] leading-relaxed shadow-[0_18px_40px_-18px_oklch(0.22_0.015_260/0.45)] duration-100 outline-none motion-reduce:animate-none dark:shadow-[0_18px_40px_-16px_oklch(0_0_0/0.75)]">
            <div className="mb-2 flex items-center gap-3">
              {data.icon ? (
                <span className="bg-muted/60 grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border">
                  <GameIcon
                    icon={data.icon}
                    kind={data.kind}
                    box={48}
                    className="size-full"
                    fallbackClassName="text-primary size-5"
                  />
                </span>
              ) : (
                <span className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-lg">
                  <Icon className="size-4" aria-hidden />
                </span>
              )}
              <span className="min-w-0">
                <span className="font-heading text-foreground block text-[15px] leading-snug font-medium">
                  {data.name}
                </span>
                <span className="text-muted-foreground block text-[11.5px]">{label}</span>
              </span>
            </div>
            {data.facts.length > 0 && (
              <ul className="text-muted-foreground space-y-0.5 text-[13px]">
                {data.facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
            <Link
              href={data.href}
              className="text-primary focus-visible:ring-ring mt-2.5 inline-flex items-center gap-1 self-start rounded-sm text-[13px] outline-none hover:underline focus-visible:ring-2"
            >
              查看完整資料
              <ArrowRightIcon className="size-3.5" aria-hidden />
            </Link>
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}
