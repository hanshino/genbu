import type { Metadata } from "next";
import { getItemsByType, getItemRandsByIds, type RankingItem } from "@/lib/queries/items";
import { isPhase2Type, type Phase2Type } from "@/lib/constants/item-types";
import { RankingClient } from "./ranking-client";

export const metadata: Metadata = {
  title: "裝備排行榜 · 玄武",
  description: "座騎 / 背飾 的自訂加權排行",
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function resolveType(raw: unknown): Phase2Type {
  return isPhase2Type(raw) ? raw : "座騎";
}

export default async function RankingPage({ searchParams }: Props) {
  const params = await searchParams;
  const type = resolveType(params.type);
  const items: RankingItem[] = getItemsByType(type);
  const rands = getItemRandsByIds(items.map((i) => i.id));

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
      <header>
        <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">裝備排行榜</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          目前類型：<span className="font-medium text-foreground">{type}</span>
          。切換類型、調整權重、設定門檻後立即重排。
        </p>
      </header>
      <RankingClient type={type} items={items} rands={rands} />
    </div>
  );
}
