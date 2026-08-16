"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";

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
