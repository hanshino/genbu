import type { Metadata } from "next";
import { getItemsByType, getItemRandsByIds, type RankingItem } from "@/lib/queries/items";
import { RankingClient } from "./ranking-client";

export const metadata: Metadata = {
  title: "加權排行榜 · 玄武",
  description: "座騎 / 背飾 的自訂加權排行",
};

const SUPPORTED_TYPES = ["座騎", "背飾"] as const;
type SupportedType = (typeof SUPPORTED_TYPES)[number];

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function resolveType(raw: unknown): SupportedType {
  if (typeof raw === "string" && SUPPORTED_TYPES.includes(raw as SupportedType)) {
    return raw as SupportedType;
  }
  return "座騎";
}

export default async function RankingPage({ searchParams }: Props) {
  const params = await searchParams;
  const type = resolveType(params.type);
  const items: RankingItem[] = getItemsByType(type);
  const rands = getItemRandsByIds(items.map((i) => i.id));

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">加權排行榜</h1>
        <p className="text-sm text-muted-foreground">
          目前類型：{type}。切換 type、調整權重、設定門檻後立即重排。
        </p>
      </header>
      <RankingClient type={type} items={items} rands={rands} />
    </div>
  );
}
