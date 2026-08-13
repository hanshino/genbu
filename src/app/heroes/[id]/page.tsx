import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BackLink } from "@/components/common/back-link";
import { Badge } from "@/components/ui/badge";
import { HeroStats } from "@/components/heroes/hero-stats";
import { HeroCombinationList } from "@/components/heroes/hero-combination-list";
import { getHeroById, getHeroCombinationsForHero } from "@/lib/queries/heroes";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const heroId = Number(id);
  if (!Number.isInteger(heroId) || heroId <= 0) return { title: "英雄 · 玄武" };
  const hero = getHeroById(heroId);
  if (!hero) return { title: "英雄不存在 · 玄武" };
  return {
    title: `${hero.name} · 英雄 · 玄武`,
    description: `${hero.name} 的基本數值與參與的英雄組合`,
  };
}

export default async function HeroDetailPage({ params }: PageProps) {
  const { id } = await params;
  const heroId = Number(id);
  if (!Number.isInteger(heroId) || heroId <= 0) notFound();

  const hero = getHeroById(heroId);
  if (!hero) notFound();

  const combinations = getHeroCombinationsForHero(hero.id);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <BackLink href="/heroes">返回英雄列表</BackLink>
      </nav>

      <header className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{hero.name}</h1>
          <span className="font-mono text-sm text-muted-foreground">#{hero.id}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-normal">
            分組 {hero.groupId}
          </Badge>
          <Badge variant="outline" className="font-normal">
            star_up {hero.starUp}
          </Badge>
        </div>
        {hero.help && <p className="text-sm leading-relaxed">{hero.help}</p>}
      </header>

      <HeroStats stats={hero.stats} />

      <HeroCombinationList combinations={combinations} currentHeroId={hero.id} />

      <p className="text-xs leading-relaxed text-muted-foreground">
        資料來自 hero 與 hero_connect 兩張表的原始欄位。分組與 star_up 的語意未解碼，不做換算；
        取得方式、培養與升星路徑不在資料中，本頁不提供。
      </p>
    </div>
  );
}
