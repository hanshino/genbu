"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics/track";

interface EnhanceSearchBeaconProps {
  attribute: string;
  family: string;
  slot: number | null;
  resultCount: number;
}

/**
 * /tools/enhance 是每次送出篩選都整頁導航（GET form），
 * 用 SearchBeacon 一樣的去重手法，避免同一組結果因 re-render / strict mode 重複送出。
 */
export function EnhanceSearchBeacon({
  attribute,
  family,
  slot,
  resultCount,
}: EnhanceSearchBeaconProps) {
  const lastFiredKey = useRef<string | null>(null);

  useEffect(() => {
    const key = `${attribute}|${family}|${slot ?? "all"}|${resultCount}`;
    if (key === lastFiredKey.current) return;
    lastFiredKey.current = key;

    track("enhance_search", {
      attribute,
      family,
      slot: slot ?? "all",
      result_count: resultCount,
    });
  }, [attribute, family, slot, resultCount]);

  return null;
}
