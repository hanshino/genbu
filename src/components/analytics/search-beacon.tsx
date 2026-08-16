"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics/track";

interface SearchBeaconProps {
  scope: string;
  query: string;
  hasFilter: boolean;
  resultCount: number;
}

export function SearchBeacon({ scope, query, hasFilter, resultCount }: SearchBeaconProps) {
  const lastFiredKey = useRef<string | null>(null);
  const normalizedQuery = query.trim().slice(0, 100);

  useEffect(() => {
    if (!normalizedQuery && !hasFilter) return;

    const key = `${scope}|${normalizedQuery}|${hasFilter}|${resultCount}`;
    if (key === lastFiredKey.current) return;
    lastFiredKey.current = key;

    track("search_submit", {
      scope,
      query: normalizedQuery,
      has_filter: hasFilter,
      result_count: resultCount,
    });
  }, [scope, normalizedQuery, hasFilter, resultCount]);

  return null;
}
