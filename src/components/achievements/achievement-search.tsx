"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { track } from "@/lib/analytics/track";

export function AchievementSearch({ initialSearch }: { initialSearch: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const next = search.trim();
      if (next) params.set("search", next);
      else params.delete("search");
      if (params.toString() === searchParams.toString()) return;
      const qs = params.toString();
      startTransition(() => {
        router.push(`/achievements${qs ? `?${qs}` : ""}`);
      });
      if (next.length > 0) {
        track("search_submit", { scope: "achievements", query_len: next.length, has_filter: false });
      }
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <Input
      placeholder="搜尋成就名稱或描述..."
      aria-label="搜尋成就名稱或描述"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      inputMode="search"
      className="sm:max-w-xs"
    />
  );
}
