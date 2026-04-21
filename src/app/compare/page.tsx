import type { Metadata } from "next";
import { getItemsByIds, getItemRandsByIds, getItemsByType } from "@/lib/queries/items";
import { CompareClient } from "./compare-client";

export const metadata: Metadata = {
  title: "裝備比較 · 玄武",
  description: "同時比較多件座騎/背飾的屬性與加權分數",
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseIds(raw: unknown): number[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 5);
}

const SUPPORTED_TYPES = ["座騎", "背飾"] as const;
type SupportedType = (typeof SUPPORTED_TYPES)[number];

export default async function ComparePage({ searchParams }: Props) {
  const params = await searchParams;
  const ids = parseIds(params.ids);
  const items = getItemsByIds(ids);
  items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  const rands = getItemRandsByIds(ids);

  // Pool for the picker: driven by items[0].type, or by ?type query, or default 座騎
  const rawType = typeof params.type === "string" ? params.type : undefined;
  const activeType: SupportedType =
    (items[0]?.type as SupportedType | undefined) ??
    (SUPPORTED_TYPES.includes(rawType as SupportedType) ? (rawType as SupportedType) : "座騎");
  const pool = getItemsByType(activeType);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">裝備比較</h1>
        <p className="text-sm text-muted-foreground">
          可比較 1~5 件同類型裝備。目前類型：{activeType}。
        </p>
      </header>
      <CompareClient
        activeType={activeType}
        initialItems={items}
        initialRands={rands}
        initialIds={ids}
        pool={pool}
      />
    </div>
  );
}
