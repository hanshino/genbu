import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { LinkListRow, LinkListSection } from "@/components/common/link-list";
import { getHeroes } from "@/lib/queries/heroes";
import type { HeroSummary } from "@/lib/types/hero";

export const metadata: Metadata = {
  title: "英雄 · 玄武",
  description: "武林同萌傳 hero 表的英雄清單、原始分組與參與組合數",
};

export default function HeroesPage() {
  const heroes = getHeroes();

  // query 已依 group、id 排序，依序切段即可保留原始分組順序。
  const groups: { groupId: string; heroes: HeroSummary[] }[] = [];
  for (const hero of heroes) {
    const last = groups.at(-1);
    if (last?.groupId === hero.groupId) last.heroes.push(hero);
    else groups.push({ groupId: hero.groupId, heroes: [hero] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">英雄</h1>
        <p className="text-sm text-muted-foreground">
          資料表共 {heroes.length} 位英雄 · {groups.length} 個原始分組
        </p>
      </header>

      {groups.map((group) => (
        <LinkListSection
          key={group.groupId}
          title={`分組 ${group.groupId}`}
          summary={`${group.heroes.length} 位`}
        >
          {group.heroes.map((hero) => (
            <LinkListRow key={hero.id} href={`/heroes/${hero.id}`}>
              <span className="font-mono text-xs text-muted-foreground">#{hero.id}</span>
              <span className="font-medium">{hero.name}</span>
              <Badge variant="outline" className="font-normal">
                star_up {hero.starUp}
              </Badge>
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {hero.combinationCount > 0 ? `${hero.combinationCount} 組組合` : "無組合"}
              </span>
            </LinkListRow>
          ))}
        </LinkListSection>
      ))}

      <p className="text-xs leading-relaxed text-muted-foreground">
        分組是 hero 表的原始 group 欄位（資料中為 1 至 4），不是已核實的官方陣營或章節名稱。star_up
        同樣是原始欄位值，本站不做星級換算或解讀。組合數為此英雄出現在 hero_connect hero1 至 hero5
        任一槽位的次數。本頁只呈現資料表現有的 84 筆，不是完整英雄圖鑑。
      </p>
    </div>
  );
}
