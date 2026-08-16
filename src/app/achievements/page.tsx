import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import {
  getAchievementCategories,
  getAchievementsByCategory,
  getAchievementsWithRewards,
  searchAchievements,
  ACHIEVEMENT_SEARCH_LIMIT,
} from "@/lib/queries/achievements";
import { AchievementSearch } from "@/components/achievements/achievement-search";
import { AchievementRow } from "@/components/achievements/achievement-row";
import type { AchievementRow as Row, AchievementSearchRow } from "@/lib/types/achievement";
import { SearchBeacon } from "@/components/analytics/search-beacon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "成就 · 玄武",
  description: "武林同萌傳全部成就分類瀏覽:點數、描述、獎勵一覽",
};

interface PageProps {
  searchParams: Promise<{ cat?: string; search?: string; view?: string }>;
}

export default async function AchievementsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = (params.search ?? "").trim();
  const view = params.view === "reward" ? "reward" : "category";
  const categories = getAchievementCategories();
  const catParam = Number(params.cat);
  const activeCat = categories.find((c) => c.id === catParam) ?? categories[0];
  const searchRows = search ? searchAchievements(search) : null;

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
        <SearchBeacon
          scope="achievements"
          query={search}
          hasFilter={false}
          resultCount={searchRows?.length ?? 0}
        />
      </Suspense>

      {search ? (
        <SearchResults rows={searchRows ?? []} keyword={search} />
      ) : (
        <>
          <nav aria-label="瀏覽方式" className="flex flex-wrap gap-1.5">
            {(
              [
                { key: "category", label: "依分類", href: "/achievements" },
                { key: "reward", label: "依獎勵", href: "/achievements?view=reward" },
              ] as const
            ).map((v) => {
              const active = v.key === view;
              return (
                <Link
                  key={v.key}
                  href={v.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-sm transition-colors",
                    active
                      ? "border-transparent bg-secondary font-medium text-secondary-foreground"
                      : "border-border/60 bg-card hover:bg-muted/50",
                  )}
                >
                  {v.label}
                </Link>
              );
            })}
          </nav>
          {view === "reward" ? (
            <RewardGroups />
          ) : (
            <>
              <nav aria-label="成就分類" className="flex flex-wrap gap-1.5">
                {categories.map((c) => {
                  const active = c.id === activeCat.id;
                  return (
                    <Link
                      key={c.id}
                      href={
                        c.id === categories[0].id ? "/achievements" : `/achievements?cat=${c.id}`
                      }
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

/** 平鋪類獎勵(非永久屬性加成)的中文標題,依此順序渲染。 */
const FLAT_REWARD_TYPES = [
  { type: 2, label: "道具" },
  { type: 3, label: "銀兩" },
  { type: 1, label: "貨幣" },
] as const;

function RewardGroups() {
  const rows = getAchievementsWithRewards();

  const byType = new Map<number, Row[]>();
  for (const r of rows) {
    const list = byType.get(r.rewardType) ?? [];
    list.push(r);
    byType.set(r.rewardType, list);
  }

  const statRows = byType.get(5) ?? [];
  const byAttr = new Map<string, Row[]>();
  for (const r of statRows) {
    const key = r.rewardName ?? `#${r.rewardId}`;
    const list = byAttr.get(key) ?? [];
    list.push(r);
    byAttr.set(key, list);
  }
  const attrGroups = Array.from(byAttr.entries()).sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    return a[0].localeCompare(b[0], "zh-TW");
  });

  return (
    <div className="space-y-6">
      {statRows.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">永久屬性加成</h2>
          {attrGroups.map(([attr, list]) => (
            <div key={attr} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-medium">{attr}</h3>
                <span className="text-xs text-muted-foreground">{list.length} 個成就</span>
              </div>
              <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
                {list.map((a) => (
                  <AchievementRow key={a.id} achievement={a} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
      {FLAT_REWARD_TYPES.map(({ type, label }) => {
        const list = byType.get(type) ?? [];
        if (list.length === 0) return null;
        return (
          <section key={type} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-medium">{label}</h2>
              <span className="text-xs text-muted-foreground">{list.length} 個成就</span>
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

function SearchResults({ rows, keyword }: { rows: AchievementSearchRow[]; keyword: string }) {
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
