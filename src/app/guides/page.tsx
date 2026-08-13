import Link from "next/link";
import type { Metadata } from "next";
import { CalendarCheckIcon, ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPublishedGuides, type Guide, type GuideCategory } from "@/data/guides";

export const metadata: Metadata = {
  title: "攻略 · 玄武",
  description: "以資料庫與已核對來源整理的武林同萌傳攻略，每篇標示來源與核對日期。",
};

const CATEGORY_LABELS: Record<GuideCategory, string> = {
  items: "道具",
  equipment: "裝備",
  skills: "技能",
  monsters: "怪物",
  missions: "任務",
  tools: "工具",
};

/** 取最舊的 lastVerified：一篇攻略的可信度以最陳舊的來源為準，不用最新日期蓋過去。 */
function oldestVerified(guide: Guide): string | null {
  // ISO yyyy-mm-dd 可直接字串比較
  return guide.sources.reduce<string | null>(
    (oldest, source) =>
      oldest === null || source.lastVerified < oldest ? source.lastVerified : oldest,
    null,
  );
}

export default function GuidesPage() {
  const guides = getPublishedGuides();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">攻略</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          每篇攻略的每個段落都標出依據的來源與核對日期。列表上的日期取該篇最舊的一筆，
          不以最近核對過的來源蓋過還沒重新確認的部分。
        </p>
      </header>

      {guides.length === 0 ? (
        <p className="text-muted-foreground text-sm">尚未發布攻略。</p>
      ) : (
        <div className="space-y-4">
          {guides.map((guide) => {
            const verified = oldestVerified(guide);
            return (
              <Link key={guide.slug} href={`/guides/${guide.slug}`} className="group block">
                <Card className="transition-colors group-hover:bg-muted/40">
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-normal">
                        {CATEGORY_LABELS[guide.category]}
                      </Badge>
                    </div>
                    <CardTitle className="mt-1 text-lg">{guide.title}</CardTitle>
                    <CardDescription className="mt-2 leading-relaxed">
                      {guide.summary}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                      閱讀攻略
                      <ChevronRightIcon className="size-3" aria-hidden />
                    </p>
                  </CardContent>
                  <CardFooter className="text-muted-foreground gap-1.5 text-xs">
                    <CalendarCheckIcon className="size-3.5 shrink-0" aria-hidden />
                    來源最早核對日期 {verified ?? "未記錄"}
                  </CardFooter>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
