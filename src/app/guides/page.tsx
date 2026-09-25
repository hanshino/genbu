import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRightIcon,
  BookmarkIcon,
  BookOpenIcon,
  MapIcon,
  RouteIcon,
} from "lucide-react";
import { getGuides } from "@/lib/guides";
import { AuthorCard } from "@/components/guides/author-card";
import { RoadTimeline } from "@/components/guides/road-timeline";
import { Badge } from "@/components/ui/badge";

// DB 是 runtime mount，build 時拿不到，一律請求時渲染
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "攻略 · 玄武",
  description:
    "照等級走的武林同萌傳修行路線：從剛創角、轉副門派、進階任務到轉生，每一站寫清楚該做什麼、會開放哪些系統。",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  const guides = getGuides();
  const stops = guides
    .filter((g) => g.stage !== "topic" && g.category !== "dungeon")
    .sort((a, b) => (a.levelMin ?? 0) - (b.levelMin ?? 0) || a.order - b.order);
  const topics = guides.filter((g) => g.stage === "topic" && g.category !== "dungeon");
  const dungeons = guides
    .filter((g) => g.category === "dungeon")
    .sort((a, b) => a.order - b.order);

  return (
    <div className="mx-auto max-w-[1040px] px-[18px] pb-16 sm:px-10 sm:pb-20">
      <section className="grid items-start gap-6 pt-9 pb-5 md:grid-cols-[minmax(0,1fr)_300px] md:items-end md:gap-10 md:pt-16 md:pb-7">
        <div>
          <span className="text-muted-foreground inline-flex items-center gap-2 text-[12.5px] tracking-[0.16em]">
            <RouteIcon className="size-3.5" aria-hidden />
            修行路線
          </span>
          <h1 className="mt-4 mb-3.5 text-[33px] font-semibold tracking-[0.06em] sm:text-[50px]">
            一個角色的一生
          </h1>
          <p className="text-muted-foreground max-w-[32em] text-[15.5px] leading-relaxed text-pretty sm:text-[17px]">
            不管剛創角還是回鍋，找到你的等級，照著走就對了。每一站我都寫清楚該做什麼、會開什麼系統、那系統怎麼玩。
          </p>
        </div>
        <AuthorCard />
      </section>

      {stops.length > 0 ? (
        <RoadTimeline stops={stops} />
      ) : (
        <p className="text-muted-foreground mt-8 text-sm">路線還在整理中，很快就會補上。</p>
      )}

      {topics.length > 0 && (
        <section aria-labelledby="topics-heading">
          <h2
            id="topics-heading"
            className="font-heading text-muted-foreground mt-12 mb-4 flex items-center gap-2.5 text-[15px] font-normal tracking-[0.08em] after:h-px after:flex-1 after:bg-border"
          >
            <BookmarkIcon className="size-4" aria-hidden />
            不分等級都用得到
          </h2>
          <div className="grid gap-[18px] sm:grid-cols-2">
            {topics.map((g) => (
              <Link
                key={g.slug}
                href={`/guides/${g.slug}`}
                className="group bg-card hover:bg-muted/60 hover:border-foreground/20 focus-visible:ring-ring flex flex-col gap-2.5 rounded-xl border px-[22px] py-5 outline-none focus-visible:ring-2 motion-safe:transition-[background-color,border-color,transform] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5"
              >
                <Badge variant="secondary" className="h-6 gap-1.5 px-2.5 font-normal">
                  <BookOpenIcon aria-hidden />
                  通用
                </Badge>
                <h3 className="text-[17.5px] font-semibold text-balance">{g.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  {g.summary}
                </p>
                <span className="text-primary mt-auto inline-flex items-center gap-1.5 pt-0.5 text-[13.5px]">
                  讀這篇
                  <ArrowRightIcon
                    className="size-3.5 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {dungeons.length > 0 && (
        <section aria-labelledby="dungeons-heading">
          <h2
            id="dungeons-heading"
            className="font-heading text-muted-foreground mt-12 mb-4 flex items-center gap-2.5 text-[15px] font-normal tracking-[0.08em] after:h-px after:flex-1 after:bg-border"
          >
            <MapIcon className="size-4" aria-hidden />
            迷宮攻略
          </h2>
          <div className="grid gap-[18px] sm:grid-cols-2">
            {dungeons.map((g) => (
              <Link
                key={g.slug}
                href={`/guides/${g.slug}`}
                className="group bg-card hover:bg-muted/60 hover:border-foreground/20 focus-visible:ring-ring flex flex-col gap-2.5 rounded-xl border px-[22px] py-5 outline-none focus-visible:ring-2 motion-safe:transition-[background-color,border-color,transform] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5"
              >
                <Badge variant="secondary" className="h-6 gap-1.5 px-2.5 font-normal">
                  <MapIcon aria-hidden />
                  迷宮
                </Badge>
                <h3 className="text-[17.5px] font-semibold text-balance">{g.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  {g.summary}
                </p>
                <span className="text-primary mt-auto inline-flex items-center gap-1.5 pt-0.5 text-[13.5px]">
                  讀這篇
                  <ArrowRightIcon
                    className="size-3.5 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
