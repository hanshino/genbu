import type { Metadata } from "next";
import { SearchBeacon } from "@/components/analytics/search-beacon";
import { GlobalSearch } from "@/components/search/global-search";
import { SearchGroupSection } from "@/components/search/search-group-section";
import { SearchTypeNav } from "@/components/search/search-type-nav";
import { searchAll } from "@/lib/queries/search";
import { isSearchType } from "@/lib/search-types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

function normalizeQuery(raw: string | undefined) {
  return (raw ?? "").trim().slice(0, 100);
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const q = normalizeQuery((await searchParams).q);
  return {
    title: q ? `搜尋「${q}」｜玄武` : "搜尋｜玄武",
    robots: { index: false },
  };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = normalizeQuery(params.q);
  const type = isSearchType(params.type) ? params.type : undefined;

  // 全類型那次查詢同時提供各類型總數（分頁標籤）與「全部」view 的內容。
  const all = q ? searchAll(q) : null;
  const typed = q && type ? searchAll(q, { type }) : null;

  const activeGroup = typed?.groups[0];
  const counts = all?.groups.map((g) => ({ type: g.type, total: g.total })) ?? [];
  // 網址指定的類型沒有命中時仍顯示該分頁（0 筆），避免沒有任何一個分頁被標成目前選項。
  if (type && !counts.some((c) => c.type === type)) counts.push({ type, total: 0 });
  const resultCount = type ? (activeGroup?.total ?? 0) : (all?.total ?? 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight md:text-3xl">搜尋</h1>
        <GlobalSearch key={q} defaultValue={q} />
      </header>

      {!q || !all ? (
        null
      ) : (
        <>
          <SearchBeacon scope="global" query={q} hasFilter={!!type} resultCount={resultCount} />

          {all.total === 0 ? (
            <div className="rounded-lg border border-border/60 bg-card p-6 text-center">
              <p className="text-sm font-medium">找不到「{q}」相關結果</p>
            </div>
          ) : (
            <div className="space-y-4">
              <SearchTypeNav
                q={q}
                total={all.total}
                counts={counts}
                active={type}
              />

              {type ? (
                activeGroup ? (
                  <>
                    <SearchGroupSection group={activeGroup} />
                    {activeGroup.total > activeGroup.hits.length && (
                      <p className="text-xs text-muted-foreground">
                        共 {activeGroup.total.toLocaleString()} 筆，只顯示前{" "}
                        {activeGroup.hits.length.toLocaleString()} 筆，請輸入更精確的關鍵字。
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    這個類型沒有符合「{q}」的結果，可切到「全部」看其他類型。
                  </p>
                )
              ) : (
                all.groups.map((group) => (
                  <SearchGroupSection key={group.type} group={group} q={q} />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
