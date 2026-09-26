import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArrowLeftIcon, ArrowRightIcon, ClockIcon, MapIcon, PuzzleIcon } from "lucide-react";
import { getGuides } from "@/lib/guides";
import { Badge } from "@/components/ui/badge";

// 跟 /guides 一樣請求時才讀 content/guides
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "迷宮攻略 · 玄武",
  description: "武林同萌傳任務迷宮的逐關走法，以及 160、175、180 副本的解謎工具。",
  alternates: { canonical: "/guides/dungeons" },
};

// 跟 /guides 的「通用」卡片同一套樣式
const cardClass =
  "group bg-card hover:bg-muted/60 hover:border-foreground/20 focus-visible:ring-ring flex flex-col gap-2.5 rounded-xl border px-[22px] py-5 outline-none focus-visible:ring-2 motion-safe:transition-[background-color,border-color,transform] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5";

const headingClass =
  "font-heading text-muted-foreground mt-12 mb-4 flex items-center gap-2.5 text-[15px] font-normal tracking-[0.08em] after:h-px after:flex-1 after:bg-border";

// ponytail: 跟 /tools 頁的文案各寫一份；工具再多就抽成共用清單
const tools = [
  {
    href: "/tools/160",
    level: 160,
    title: "迷霧九宮格",
    description: "輸入總和與兩間關閉房間，推算其餘 7 間的水晶數。",
  },
  {
    href: "/tools/175",
    level: 175,
    title: "北斗七星",
    description: "輸入數字（1~127），直接算出七顆星各自要開還是關。",
  },
  {
    href: "/tools/180",
    level: 180,
    title: "神武禁地",
    description: "輸入總和與左上中（封印）數字，列出所有合法排列。",
  },
];

function CardArrow({ children }: { children: ReactNode }) {
  return (
    <span className="text-primary mt-auto inline-flex items-center gap-1.5 pt-0.5 text-[13.5px]">
      {children}
      <ArrowRightIcon
        className="size-3.5 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
        aria-hidden
      />
    </span>
  );
}

export default function DungeonGuidesPage() {
  const dungeons = getGuides()
    .filter((g) => g.category === "dungeon")
    .sort((a, b) => a.order - b.order);

  return (
    <div className="mx-auto max-w-[1040px] px-[18px] pb-16 sm:px-10 sm:pb-20">
      <section className="pt-9 pb-5 md:pt-16 md:pb-7">
        <Link
          href="/guides"
          className="text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-ring -ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] outline-none focus-visible:ring-2 motion-safe:transition-colors"
        >
          <ArrowLeftIcon className="size-3.5" aria-hidden />
          回修行路線
        </Link>
        <span className="text-muted-foreground mt-5 flex items-center gap-2 text-[12.5px] tracking-[0.16em]">
          <MapIcon className="size-3.5" aria-hidden />
          迷宮攻略
        </span>
        <h1 className="mt-4 mb-3.5 text-[33px] font-semibold tracking-[0.06em] sm:text-[50px]">
          迷宮與副本
        </h1>
        <p className="text-muted-foreground max-w-[32em] text-[15.5px] leading-relaxed text-pretty sm:text-[17px]">
          任務迷宮一關一關怎麼走、要打哪些怪，都整理在這裡。副本裡的數字謎題，用下面的工具輸入題目就能算出答案。
        </p>
      </section>

      <section aria-labelledby="dungeon-guides-heading">
        <h2 id="dungeon-guides-heading" className={headingClass}>
          <MapIcon className="size-4" aria-hidden />
          逐關攻略
        </h2>
        {dungeons.length > 0 ? (
          <div className="grid gap-[18px] sm:grid-cols-2">
            {dungeons.map((g) => (
              <Link key={g.slug} href={`/guides/${g.slug}`} className={cardClass}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="h-6 gap-1.5 px-2.5 font-normal">
                    <MapIcon aria-hidden />
                    {g.levelMin != null ? (
                      <span className="font-mono">Lv {g.levelMin}</span>
                    ) : (
                      "迷宮"
                    )}
                  </Badge>
                  <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                    <ClockIcon className="size-3.5" aria-hidden />
                    閱讀 {g.readingMinutes} 分鐘
                  </span>
                </div>
                <h3 className="text-[17.5px] font-semibold text-balance">{g.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  {g.summary}
                </p>
                <CardArrow>讀這篇</CardArrow>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">迷宮攻略還在整理中，很快就會補上。</p>
        )}
      </section>

      <section aria-labelledby="dungeon-tools-heading">
        <h2 id="dungeon-tools-heading" className={headingClass}>
          <PuzzleIcon className="size-4" aria-hidden />
          副本解謎工具
        </h2>
        <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => (
            <Link key={t.href} href={t.href} className={cardClass}>
              <Badge variant="outline" className="h-6 gap-1.5 px-2.5 font-normal">
                <PuzzleIcon aria-hidden />
                <span className="font-mono">{t.level}</span> 副本
              </Badge>
              <h3 className="text-[17.5px] font-semibold text-balance">{t.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                {t.description}
              </p>
              <CardArrow>打開工具</CardArrow>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
