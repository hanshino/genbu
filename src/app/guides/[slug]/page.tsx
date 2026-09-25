import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  MapIcon,
  PenLineIcon,
  RouteIcon,
} from "lucide-react";
import { getAdjacentGuides, getGuide, renderGuideBody, type GuideMeta } from "@/lib/guides";
import { AuthorCard } from "@/components/guides/author-card";
import { GuideTocDesktop, GuideTocMobile } from "@/components/guides/guide-toc";
import { guideMdxComponents } from "@/components/guides/mdx-components";
import { STAGE_LABEL, levelRange, stageStyle, stopBadgeClass } from "@/components/guides/stages";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// DB 是 runtime mount，build 時拿不到，一律請求時渲染
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: "攻略不存在 · 玄武" };
  return {
    title: `${guide.meta.title} · 武林同萌傳攻略 · 玄武`,
    description: guide.meta.summary,
    alternates: { canonical: `/guides/${guide.meta.slug}` },
  };
}

function stageText(meta: GuideMeta) {
  const range = levelRange(meta);
  return range ? `Lv ${range}` : STAGE_LABEL[meta.stage];
}

function sourceLabel(url: string) {
  try {
    const host = new URL(url).hostname;
    return host.endsWith("gamer.com.tw") ? "巴哈姆特" : host;
  } catch {
    return url;
  }
}

function PrevNextCard({ meta, dir }: { meta: GuideMeta; dir: "prev" | "next" }) {
  const onRoad = meta.stage !== "topic";
  const word = dir === "prev" ? (onRoad ? "上一站" : "上一篇") : onRoad ? "下一站" : "下一篇";
  const label = onRoad ? `${word} · ${stageText(meta)}` : word;
  return (
    <Link
      href={`/guides/${meta.slug}`}
      style={stageStyle(meta.stage)}
      className={cn(
        "bg-card hover:bg-muted/60 hover:border-(--stop)/45 focus-visible:ring-ring flex flex-col gap-1.5 rounded-xl border px-[18px] py-4 outline-none focus-visible:ring-2 motion-safe:transition-[background-color,border-color,transform] motion-safe:hover:-translate-y-0.5",
        dir === "next" && "sm:col-start-2 sm:text-right",
      )}
    >
      <span
        className={cn(
          "text-muted-foreground inline-flex items-center gap-1.5 text-xs",
          dir === "next" && "sm:justify-end",
        )}
      >
        {dir === "prev" && <ArrowLeftIcon className="size-3.5" aria-hidden />}
        <span className="font-mono">{label}</span>
        {dir === "next" && <ArrowRightIcon className="size-3.5" aria-hidden />}
      </span>
      <span className="font-heading text-[15.5px] text-balance">{meta.title}</span>
    </Link>
  );
}

export default async function GuideArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const { meta, source, headings } = guide;
  const { prev, next } = getAdjacentGuides(slug);
  const body = await renderGuideBody(source, guideMdxComponents);
  const range = levelRange(meta);
  const isDungeon = meta.category === "dungeon";

  return (
    <div
      style={stageStyle(meta.stage)}
      className="mx-auto max-w-[1040px] px-[18px] pb-16 sm:px-10 sm:pb-20"
    >
      <nav
        aria-label="麵包屑"
        className="text-muted-foreground mt-7 mb-5 flex flex-wrap items-center gap-1.5 text-[13px]"
      >
        <Link
          href="/guides"
          className="hover:bg-muted/60 hover:text-foreground focus-visible:ring-ring -ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 outline-none focus-visible:ring-2 motion-safe:transition-colors"
        >
          {isDungeon ? (
            <MapIcon className="size-3.5" aria-hidden />
          ) : (
            <RouteIcon className="size-3.5" aria-hidden />
          )}
          {isDungeon ? "迷宮攻略" : "修行路線"}
        </Link>
        <ChevronRightIcon className="size-3.5 opacity-50" aria-hidden />
        <span aria-current="page">
          {range && <span className="font-mono">Lv {range} </span>}
          {STAGE_LABEL[meta.stage]}
        </span>
      </nav>

      <div className="grid items-start justify-center gap-0 pt-2 lg:grid-cols-[minmax(0,680px)_210px] lg:gap-14">
        <article className="min-w-0">
          <h1 className="mt-3.5 mb-4 text-[28px] font-semibold tracking-[0.01em] text-balance sm:text-[40px]">
            {meta.title}
          </h1>
          <div className="text-muted-foreground mt-4 mb-5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-b pb-5 text-[13px]">
            <span className="inline-flex items-center gap-1.5">
              <PenLineIcon className="size-3.5" aria-hidden />
              {meta.author}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="size-3.5" aria-hidden />
              更新於
              <time dateTime={meta.updated} className="font-mono">
                {meta.updated}
              </time>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="size-3.5" aria-hidden />
              閱讀 {meta.readingMinutes} 分鐘
            </span>
          </div>

          <p className="text-muted-foreground border-l-[3px] border-(--stop)/55 pl-[18px] text-[15.5px] leading-[1.8] text-pretty sm:text-[17px]">
            {meta.summary}
          </p>

          {!isDungeon && meta.unlocks.length > 0 && (
            <div className="mt-5 mb-6 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="h-6 px-2.5 font-normal">
                這階段開放
              </Badge>
              {meta.unlocks.map((u) => (
                <Badge key={u} variant="outline" className={stopBadgeClass}>
                  {u}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-6">
            <GuideTocMobile headings={headings} />
          </div>

          <div>{body}</div>

          {(prev || next) && (
            <nav aria-label="上一站與下一站" className="mt-12 grid gap-3.5 sm:grid-cols-2">
              {prev && <PrevNextCard meta={prev} dir="prev" />}
              {next && <PrevNextCard meta={next} dir="next" />}
            </nav>
          )}

          {meta.sourceUrl && (
            <p className="text-muted-foreground mt-6 text-[12.5px]">
              原文出處：
              <a
                href={meta.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary decoration-primary/40 hover:decoration-primary underline underline-offset-4"
              >
                {sourceLabel(meta.sourceUrl)}
                <span className="sr-only">（於新視窗開啟）</span>
              </a>
            </p>
          )}
          <AuthorCard name={meta.author} className="mt-5" />
        </article>

        <GuideTocDesktop headings={headings} />
      </div>
    </div>
  );
}
