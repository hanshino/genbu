"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";

export function AchievementSearch({ initialSearch }: { initialSearch: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const composingRef = useRef(false);
  const [isComposing, setIsComposing] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (isComposing) return;
    const handle = setTimeout(() => {
      if (composingRef.current) return;
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
  }, [search, isComposing]);

  return (
    <Input
      placeholder="搜尋成就名稱或描述..."
      aria-label="搜尋成就名稱或描述"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      onCompositionStart={() => {
        composingRef.current = true;
        setIsComposing(true);
      }}
      onCompositionEnd={() => {
        composingRef.current = false;
        setIsComposing(false);
      }}
      inputMode="search"
      className="sm:max-w-xs"
    />
  );
}
