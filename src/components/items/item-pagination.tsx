"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ItemPagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const searchParams = useSearchParams();

  function hrefForPage(p: number): string {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) params.delete("page");
    else params.set("page", String(p));
    return `/items${params.size > 0 ? `?${params.toString()}` : ""}`;
  }

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  const baseBtn = buttonVariants({ variant: "outline", size: "sm" });

  return (
    <nav className="flex items-center justify-between gap-2 text-sm">
      <Link
        href={hrefForPage(prev)}
        aria-disabled={prevDisabled}
        className={cn(baseBtn, prevDisabled && "pointer-events-none opacity-50")}
        tabIndex={prevDisabled ? -1 : 0}
      >
        <ChevronLeftIcon aria-hidden />
        上一頁
      </Link>
      <span className="text-muted-foreground">
        第 {page} / {totalPages} 頁
      </span>
      <Link
        href={hrefForPage(next)}
        aria-disabled={nextDisabled}
        className={cn(baseBtn, nextDisabled && "pointer-events-none opacity-50")}
        tabIndex={nextDisabled ? -1 : 0}
      >
        下一頁
        <ChevronRightIcon aria-hidden />
      </Link>
    </nav>
  );
}
