import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRightIcon, ExternalLinkIcon } from "lucide-react";
import { BackLink } from "@/components/common/back-link";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  getGuideBySlug,
  getPublishedGuides,
  type Guide,
  type GuideCategory,
  type GuideSource,
  type GuideSourceTier,
} from "@/data/guides";

const CATEGORY_LABELS: Record<GuideCategory, string> = {
  items: "道具",
  equipment: "裝備",
  skills: "技能",
  monsters: "怪物",
  missions: "任務",
  tools: "工具",
};

const TIER_LABELS: Record<GuideSourceTier, string> = {
  database: "資料庫",
  official: "官方",
  "field-test": "實測",
  community: "社群",
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getPublishedGuides().map((guide) => ({ slug: guide.slug }));
}

/** draft 與不存在的 slug 一律當作沒有這篇，不讓草稿從直連流出。 */
function findPublished(slug: string): Guide | undefined {
  const guide = getGuideBySlug(slug);
  return guide?.status === "published" ? guide : undefined;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = findPublished(slug);
  if (!guide) return { title: "攻略不存在 · 玄武" };
  return {
    title: `${guide.title} · 攻略 · 玄武`,
    description: guide.summary,
  };
}

export default async function GuideDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const guide = findPublished(slug);
  if (!guide) notFound();

  const sourceById = new Map(guide.sources.map((source) => [source.id, source]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <nav className="text-muted-foreground text-sm">
        <BackLink href="/guides">返回攻略列表</BackLink>
      </nav>

      <header className="mt-6 space-y-3">
        <Badge variant="outline" className="font-normal">
          {CATEGORY_LABELS[guide.category]}
        </Badge>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          {guide.title}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">{guide.summary}</p>
      </header>

      <Separator className="my-8" />

      <div className="space-y-8">
        {guide.sections.map((section, index) => {
          const sectionSources = section.sourceIds
            .map((id) => sourceById.get(id))
            .filter((source): source is GuideSource => source !== undefined);

          return (
            <section key={`${index}-${section.title}`} className="space-y-3">
              <h2 className="text-lg font-medium">{section.title}</h2>

              {section.paragraphs.map((paragraph, pIndex) => (
                <p key={pIndex} className="text-sm leading-relaxed">
                  {paragraph}
                </p>
              ))}

              {section.links && section.links.length > 0 && (
                <ul className="flex flex-wrap gap-2 pt-1">
                  {section.links.map((link) => (
                    <li key={`${link.href}-${link.label}`}>
                      <Link
                        href={link.href}
                        className="border-border/60 bg-card hover:bg-muted/50 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors"
                      >
                        {link.label}
                        <ArrowRightIcon className="size-3.5" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {sectionSources.length > 0 && (
                <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span>本段依據</span>
                  {sectionSources.map((source) => (
                    <Badge key={source.id} variant="secondary" className="font-normal">
                      {TIER_LABELS[source.tier]}
                      <span className="text-muted-foreground">·</span>
                      <span className="font-mono">{source.lastVerified}</span>
                    </Badge>
                  ))}
                  <span>核對</span>
                </p>
              )}
            </section>
          );
        })}
      </div>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-lg font-medium">來源</h2>
        <ol className="space-y-3">
          {guide.sources.map((source) => (
            <li
              key={source.id}
              className="border-border/60 bg-card space-y-2 rounded-lg border p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-normal">
                  {TIER_LABELS[source.tier]}
                </Badge>
                <span className="text-sm font-medium">{source.title}</span>
                <span className="text-muted-foreground ml-auto font-mono text-xs">
                  核對於 {source.lastVerified}
                </span>
              </div>

              {/* database 一定有 evidence；field-test 也靠它說明條件，沒 URL 時這是唯一佐證 */}
              {source.evidence && (
                <p className="text-muted-foreground text-xs leading-relaxed">{source.evidence}</p>
              )}

              {(source.tier === "official" || source.tier === "community") && source.url && (
                <Link
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1.5 text-xs underline-offset-4 hover:underline"
                >
                  {source.url}
                  <ExternalLinkIcon className="size-3.5" aria-hidden />
                  <span className="sr-only">（於新視窗開啟外部連結）</span>
                </Link>
              )}
            </li>
          ))}
        </ol>
        <p className="text-muted-foreground text-xs leading-relaxed">
          核對日期是最後一次比對來源的日期，不代表遊戲內容在那之後沒有變動。
        </p>
      </section>
    </div>
  );
}
