import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { SEARCH_TYPE_LABELS, type SearchType } from "@/lib/search-types";
import { cn } from "@/lib/utils";
import { searchHref } from "./search-group-section";

export interface SearchTypeCount {
  type: SearchType;
  total: number;
}

/**
 * 類型篩選。每個選項是換 URL 的連結（不是切換面板），所以用 Link + buttonVariants，
 * 目前選項標 aria-current，而不是 Tabs。
 */
export function SearchTypeNav({
  q,
  total,
  counts,
  active,
}: {
  q: string;
  total: number;
  counts: SearchTypeCount[];
  active?: SearchType;
}) {
  const items = [
    { key: "all", label: "全部", count: total, href: searchHref(q), current: !active },
    ...counts.map((c) => ({
      key: c.type,
      label: SEARCH_TYPE_LABELS[c.type],
      count: c.total,
      href: searchHref(q, c.type),
      current: active === c.type,
    })),
  ];

  return (
    <nav aria-label="搜尋類型" className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.current ? "page" : undefined}
          className={cn(
            buttonVariants({ variant: item.current ? "secondary" : "ghost", size: "sm" }),
            !item.current && "text-muted-foreground",
          )}
        >
          {item.label}
          <span className="text-xs tabular-nums opacity-70">{item.count.toLocaleString()}</span>
        </Link>
      ))}
    </nav>
  );
}
