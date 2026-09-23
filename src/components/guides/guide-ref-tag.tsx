"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon, MapIcon, PackageIcon, SkullIcon, SparklesIcon } from "lucide-react";
import type { GuideRef, GuideRefKind } from "@/lib/guide-refs";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

const KIND = {
  item: { label: "道具", Icon: PackageIcon },
  map: { label: "地圖", Icon: MapIcon },
  monster: { label: "怪物", Icon: SkullIcon },
  skill: { label: "技能", Icon: SparklesIcon },
} satisfies Record<GuideRefKind, { label: string; Icon: typeof PackageIcon }>;

/** 內文裡的資料標籤：桌機 hover、手機 tap 開迷你卡。 */
export function GuideRefTag({ data, children }: { data: GuideRef; children?: ReactNode }) {
  const { label, Icon } = KIND[data.kind];
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={120}
        closeDelay={120}
        className="decoration-primary/60 hover:bg-primary/10 data-popup-open:bg-primary/10 focus-visible:ring-ring inline cursor-pointer rounded-sm px-px underline decoration-dashed decoration-1 underline-offset-[5px] outline-none focus-visible:ring-2 motion-safe:transition-colors"
      >
        <Icon className="text-primary mr-0.5 inline size-[0.78em] align-[-0.05em]" aria-hidden />
        {children ?? data.name}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={8}
        className="bg-card w-68 gap-0 rounded-xl border p-3.5 text-[13.5px] leading-relaxed shadow-[0_18px_40px_-18px_oklch(0.22_0.015_260/0.45)] ring-0 motion-reduce:animate-none dark:shadow-[0_18px_40px_-16px_oklch(0_0_0/0.75)]"
      >
        <div className="mb-2 flex items-center gap-2.5">
          <span className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-lg">
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <PopoverTitle className="font-heading text-foreground text-[15px] leading-snug font-medium">
              {data.name}
            </PopoverTitle>
            <span className="text-muted-foreground block text-[11.5px]">{label}</span>
          </span>
        </div>
        {data.facts.length > 0 && (
          <PopoverDescription render={<ul />} className="space-y-0.5 text-[13px]">
            {data.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </PopoverDescription>
        )}
        <Link
          href={data.href}
          className="text-primary focus-visible:ring-ring mt-2.5 inline-flex items-center gap-1 self-start rounded-sm text-[13px] outline-none hover:underline focus-visible:ring-2"
        >
          查看完整資料
          <ArrowRightIcon className="size-3.5" aria-hidden />
        </Link>
      </PopoverContent>
    </Popover>
  );
}
