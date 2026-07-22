import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import {
  getAchievementCategories,
  getAchievementsByCategory,
  searchAchievements,
  ACHIEVEMENT_SEARCH_LIMIT,
} from "@/lib/queries/achievements";
import { AchievementSearch } from "@/components/achievements/achievement-search";
import { AchievementRow } from "@/components/achievements/achievement-row";
import type { AchievementRow as Row } from "@/lib/types/achievement";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "成就 · 玄武",
  description: "武林同萌傳全部成就分類瀏覽:點數、描述、獎勵一覽",
};

interface PageProps {
  searchParams: Promise<{ cat?: string; search?: string }>;
}

export default async function AchievementsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = (params.search ?? "").trim();
  const categories = getAchievementCategories();
  const catParam = Number(params.cat);
  const activeCat = categories.find((c) => c.id === catParam) ?? categories[0];

  const total = categories.reduce(
    (sum, c) => sum + c.subCats.reduce((s, sc) => s + sc.count, 0),
    0,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">成就圖鑑</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          共 {total.toLocaleString("zh-TW")} 個成就,依遊戲內分類瀏覽
        </p>
      </header>

      <Suspense fallback={null}>
        <AchievementSearch initialSearch={search} />
      </Suspense>

      {search ? (
        <SearchResults keyword={search} />
      ) : (
        <>
          <nav aria-label="成就分類" className="flex flex-wrap gap-1.5">
            {categories.map((c) => {
              const active = c.id === activeCat.id;
              return (
                <Link
                  key={c.id}
                  href={c.id === categories[0].id ? "/achievements" : `/achievements?cat=${c.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-sm transition-colors",
                    active
                      ? "border-transparent bg-secondary font-medium text-secondary-foreground"
                      : "border-border/60 bg-card hover:bg-muted/50",
                  )}
                >
                  {c.name}
                </Link>
              );
            })}
          </nav>
          <CategorySections categoryId={activeCat.id} />
        </>
      )}

      <p className="text-xs text-muted-foreground">
        資料來自 ACHIEVEMENT.INI。部分獎勵貨幣的遊戲內名稱尚待考證,暫以編號顯示。
      </p>
    </div>
  );
}

function CategorySections({ categoryId }: { categoryId: number }) {
  const categories = getAchievementCategories();
  const cat = categories.find((c) => c.id === categoryId)!;
  const rows = getAchievementsByCategory(categoryId);
  const bySubCat = new Map<number, Row[]>();
  for (const r of rows) {
    const list = bySubCat.get(r.subCatId) ?? [];
    list.push(r);
    bySubCat.set(r.subCatId, list);
  }

  return (
    <div className="space-y-6">
      {cat.subCats.map((sc) => {
        const list = bySubCat.get(sc.id) ?? [];
        if (list.length === 0) return null;
        return (
          <section key={sc.id} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-medium">{sc.name}</h2>
              <span className="text-xs text-muted-foreground">
                {sc.count} 個成就 · 共 {sc.totalPoints} 點
              </span>
            </div>
            <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
              {list.map((a) => (
                <AchievementRow key={a.id} achievement={a} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SearchResults({ keyword }: { keyword: string }) {
  const rows = searchAchievements(keyword);
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">搜尋結果</h2>
        <span className="text-xs text-muted-foreground">
          {rows.length === ACHIEVEMENT_SEARCH_LIMIT
            ? `僅顯示前 ${ACHIEVEMENT_SEARCH_LIMIT} 筆,請縮小關鍵字`
            : `${rows.length} 筆`}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-border/60 bg-card px-4 py-6 text-sm text-muted-foreground">
          找不到符合「{keyword}」的成就。
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
          {rows.map((a) => (
            <AchievementRow
              key={a.id}
              achievement={a}
              categoryLabel={`${a.categoryName} · ${a.subCatName}`}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
