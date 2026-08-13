import type { Metadata } from "next";
import { BackLink } from "@/components/common/back-link";
import { HeroTeamBuilder } from "@/components/heroes/hero-team-builder";
import { getHeroCombinations, getHeroes } from "@/lib/queries/heroes";

export const metadata: Metadata = {
  title: "英雄相惜配隊器 · 玄武",
  description:
    "固定一位主英雄，從可使用的英雄中選 1 至 4 位相惜英雄，依 hero_connect 連結加成總和排序",
};

export default function HeroTeamBuilderPage() {
  const heroes = getHeroes();
  const combinations = getHeroCombinations();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <BackLink href="/heroes">返回英雄列表</BackLink>
      </nav>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">英雄相惜配隊器</h1>
        <p className="text-sm text-muted-foreground">
          固定一位主英雄，再選 1 至 4 位相惜英雄，列出 hero_connect 連結加成總和較高的組合。
        </p>
      </header>

      <HeroTeamBuilder heroes={heroes} combinations={combinations} />
    </div>
  );
}
