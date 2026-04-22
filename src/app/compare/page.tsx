import type { Metadata } from "next";
import { getItemsByIds, getItemRandsByIds, getItemsByType } from "@/lib/queries/items";
import { isPhase2Type, type Phase2Type } from "@/lib/constants/item-types";
import { COMPARE_TRAY_MAX } from "@/lib/constants/compare";
import { CompareBreadcrumb } from "@/components/compare/compare-breadcrumb";
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
    .slice(0, COMPARE_TRAY_MAX);
}

export default async function ComparePage({ searchParams }: Props) {
  const params = await searchParams;
  const ids = parseIds(params.ids);
  const items = [...getItemsByIds(ids)].sort(
    (a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)
  );
  const rands = getItemRandsByIds(ids);

  // Pool for the picker: driven by items[0].type, or by ?type query, or default 座騎
  const firstType = items[0]?.type;
  const fromUrl = isPhase2Type(params.type) ? params.type : null;
  const activeType: Phase2Type = isPhase2Type(firstType)
    ? firstType
    : fromUrl ?? "座騎";
  const pool = getItemsByType(activeType);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <CompareBreadcrumb activeType={activeType} />
        <h1 className="text-2xl font-semibold">裝備比較</h1>
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
