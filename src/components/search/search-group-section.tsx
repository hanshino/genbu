import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import type { SearchGroup } from "@/lib/search-types";

export function searchHref(q: string, type?: string) {
  const params = new URLSearchParams({ q });
  if (type) params.set("type", type);
  return `/search?${params.toString()}`;
}

/**
 * 一個類型的命中清單。`q` 有給且命中數比顯示的多時，底部出現「看更多」連到該類型分頁（全部 view 用）。
 * 樣式對齊首頁「最近的市價回報」列表。
 */
export function SearchGroupSection({ group, q }: { group: SearchGroup; q?: string }) {
  const hasMore = q !== undefined && group.total > group.hits.length;

  return (
    <section className="rounded-lg border border-border/60 bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">{group.label}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {group.total.toLocaleString()} 筆
        </span>
      </div>
      <ul className="mt-1.5">
        {group.hits.map((hit) => (
          <li key={hit.id} className="border-t border-border/60 first:border-t-0">
            <Link
              href={hit.href}
              className="-mx-2 flex items-baseline gap-x-3 rounded-md px-2 py-2 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 flex-1">
                <span className="text-sm font-medium">{hit.name}</span>
                {hit.snippet && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{hit.snippet}</span>
                )}
              </span>
              {hit.meta && (
                <span className="max-w-[50%] shrink-0 text-right text-xs text-muted-foreground">
                  {hit.meta}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {hasMore && (
        <Link
          href={searchHref(q, group.type)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline-offset-3 hover:underline"
        >
          看更多{group.label}
          <ArrowRightIcon className="size-3" aria-hidden />
        </Link>
      )}
    </section>
  );
}
