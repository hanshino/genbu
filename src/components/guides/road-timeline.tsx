"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, ClockIcon, MapPinIcon } from "lucide-react";
import type { GuideMeta } from "@/lib/guides";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { STAGE_LABEL, levelRange, stageStyle, stopBadgeClass } from "./stages";

const SOON = "soon";

function findStop(level: number, stops: GuideMeta[]): string | null {
  const hit = stops.find(
    (s) => (s.levelMin ?? 1) <= level && (s.levelMax == null || level < s.levelMax),
  );
  if (hit) return hit.slug;
  const lastMax = stops.at(-1)?.levelMax;
  return lastMax != null && level >= lastMax ? SOON : null;
}

/*
 * 桌機欄位：等級字 0–104px｜軸線中心 123px｜卡片從 150px 起。
 * 圓點 left = 123 - 151(卡片 padding edge) - 7.5(半徑) = -35.5px。
 * 手機：軸線中心 6px、卡片從 26px 起，等級字收進卡片。
 */
const nodeClass =
  "bg-background absolute top-6 left-[-27.5px] z-10 box-border size-[13px] rounded-full border-[3px] border-(--stop) sm:top-[26px] sm:left-[-35.5px] sm:size-[15px]";
const lvClass =
  "font-heading mb-1 flex items-baseline gap-2 leading-tight sm:absolute sm:top-[18px] sm:left-[-150px] sm:mb-0 sm:block sm:w-[104px] sm:text-right";
const lvNumClass =
  "font-mono text-xl font-semibold tracking-tight whitespace-nowrap sm:block sm:text-[22px]";

export function RoadTimeline({ stops }: { stops: GuideMeta[] }) {
  const [target, setTarget] = useState<string | null>(null);
  const soonRange = stops.at(-1)?.levelMax;

  function locate(id: string | null) {
    setTarget(id);
    if (!id) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(`stop-${id}`)
      ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  return (
    <>
      <section
        aria-labelledby="level-locator"
        className="bg-muted mt-8 mb-2 rounded-xl border px-5 py-4"
      >
        <h2
          id="level-locator"
          className="font-heading mb-3 flex items-center gap-2 text-[15px] tracking-normal"
        >
          <MapPinIcon className="text-primary size-4" aria-hidden />
          你現在幾級？
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {stops.map((s) => (
            <Button
              key={s.slug}
              type="button"
              variant="outline"
              aria-pressed={target === s.slug}
              onClick={() => locate(s.slug)}
              style={stageStyle(s.stage)}
              className="bg-card text-muted-foreground hover:border-(--stop)/45 hover:text-foreground aria-pressed:border-(--stop)/50 aria-pressed:bg-(--stop)/15 aria-pressed:text-foreground h-9 rounded-full px-3.5 text-[13.5px] font-normal aria-pressed:font-medium"
            >
              {levelRange(s) && <span className="font-mono">Lv {levelRange(s)}</span>}
              {STAGE_LABEL[s.stage]}
            </Button>
          ))}
          <label className="text-muted-foreground flex w-full items-center gap-2 text-[13.5px] sm:ml-auto sm:w-auto">
            直接輸入
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={200}
              placeholder="68"
              aria-label="輸入你的等級"
              className="bg-card h-9 w-20 font-mono"
              onChange={(e) => {
                const lv = Number(e.target.value);
                if (lv >= 1) locate(findStop(lv, stops));
              }}
            />
          </label>
        </div>
      </section>

      <div className="relative mt-8 pl-[26px] before:absolute before:top-3.5 before:bottom-10 before:left-[5px] before:w-0.5 before:bg-linear-to-b before:from-foreground/15 before:from-80% before:to-transparent sm:pl-[150px] sm:before:left-[122px]">
        {stops.map((s, i) => {
          const range = levelRange(s);
          return (
            <Link
              key={s.slug}
              id={`stop-${s.slug}`}
              href={`/guides/${s.slug}`}
              data-target={target === s.slug || undefined}
              style={stageStyle(s.stage)}
              className="group bg-card hover:bg-muted/60 hover:border-(--stop)/45 focus-visible:ring-ring data-target:border-(--stop) data-target:ring-(--stop)/20 relative mb-5 block scroll-mt-24 rounded-xl border px-[18px] py-[18px] outline-none focus-visible:ring-2 data-target:ring-3 motion-safe:transition-[background-color,border-color,transform,box-shadow] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-18px_oklch(0.22_0.015_260/0.35)] sm:px-6 sm:py-[22px]"
            >
              <span aria-hidden className={nodeClass} />
              <span className={lvClass}>
                {range && <b className={cn(lvNumClass, "text-(--stop-ink)")}>{range}</b>}
                {/* 手機上下一行「第 n 站 · 區段」已有區段名，不重複 */}
                <span className="text-muted-foreground hidden text-xs sm:block">
                  {STAGE_LABEL[s.stage]}
                </span>
              </span>
              <p className="font-heading text-[12.5px] tracking-[0.1em] text-(--stop-ink)">
                第 {i + 1} 站 · {STAGE_LABEL[s.stage]}
              </p>
              <h3 className="mt-1.5 mb-2 text-[19px] font-semibold text-balance sm:text-[22px]">
                {s.title}
              </h3>
              <p className="text-muted-foreground max-w-[40em] text-[14.5px] leading-relaxed text-pretty">
                {s.summary}
              </p>
              {s.unlocks.length > 0 && (
                <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-dashed pt-3.5">
                  <span className="text-muted-foreground mr-0.5 text-[12.5px]">這階段開放</span>
                  {s.unlocks.map((u) => (
                    <Badge key={u} variant="outline" className={stopBadgeClass}>
                      {u}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="text-muted-foreground mt-3.5 flex items-center gap-3 text-[13px]">
                <span className="inline-flex items-center gap-1.5">
                  <ClockIcon className="size-3.5" aria-hidden />
                  {s.readingMinutes} 分鐘
                </span>
                <span className="ml-auto inline-flex items-center gap-1.5 font-medium text-(--stop-ink)">
                  開始讀
                  <ArrowRightIcon
                    className="size-3.5 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </div>
            </Link>
          );
        })}

        {/* 第五站：UI 寫死的預告，沒有對應文章 */}
        <article
          id={`stop-${SOON}`}
          data-target={target === SOON || undefined}
          style={stageStyle("soon")}
          className="data-target:ring-foreground/10 relative mb-5 scroll-mt-24 rounded-xl border border-dashed px-[18px] py-[18px] data-target:ring-3 sm:px-6 sm:py-[22px]"
        >
          <span aria-hidden className={cn(nodeClass, "border-border")} />
          <span className={lvClass}>
            {soonRange != null && (
              <b className={cn(lvNumClass, "text-muted-foreground")}>{soonRange}+</b>
            )}
            <span className="text-muted-foreground block text-xs">轉生後</span>
          </span>
          <h3 className="text-muted-foreground mt-1.5 mb-2 text-[19px] font-semibold sm:text-[22px]">
            轉生之後的路：撰寫中
          </h3>
          <p className="text-muted-foreground text-[14.5px] leading-relaxed">
            這一段我還在重新走過一次，寫完會補上來。
          </p>
          <div className="mt-3.5">
            <Badge variant="secondary" className="h-6 gap-1.5 px-2.5 font-normal">
              <ClockIcon aria-hidden />
              即將推出
            </Badge>
          </div>
        </article>
      </div>
    </>
  );
}
