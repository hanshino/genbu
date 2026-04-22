import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { getItemById, getItemRands, getItemRandsByIds, getItemsByType } from "@/lib/queries/items";
import { getMonstersByDropItem } from "@/lib/queries/monsters";
import {
  presets,
  scoreItemAcrossPresets,
  groupRandsByItemId,
  computePoolMaxValues,
  expectedRandom,
  scoreWithShared,
} from "@/lib/scoring";
import { isPhase2Type } from "@/lib/constants/item-types";
import { ItemDetail } from "@/components/items/item-detail";
import { ItemRandTable } from "@/components/items/item-rand-table";
import { ItemDropList } from "@/components/items/item-drop-list";
import { CompareButton } from "@/components/items/compare-button";
import { ItemTags } from "@/components/items/item-tags";
import { PresetPercentile } from "@/components/items/preset-percentile";
import { imageOfItem } from "@/lib/equipment-images";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const item = getItemById(Number(id));
  if (!item) return { title: "道具不存在 · 玄武" };
  return {
    title: `${item.name} · 道具 · 玄武`,
    description: item.summary ?? item.note ?? `${item.name} 的詳細屬性與掉落來源`,
  };
}

export default async function ItemDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { from } = await searchParams;
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) notFound();

  const item = getItemById(itemId);
  if (!item) notFound();

  const rands = getItemRands(String(item.id));
  const sources = getMonstersByDropItem(item.id);
  const cover = imageOfItem(item);

  const phase2 = isPhase2Type(item.type);
  let maxValues: Record<string, number> = {};
  let itemScores: Record<string, number> = {};
  const poolScores: Record<string, number[]> = {};
  if (phase2 && item.type) {
    const pool = getItemsByType(item.type);
    maxValues = computePoolMaxValues(pool);

    const randsByItem = groupRandsByItemId(getItemRandsByIds(pool.map((p) => p.id)));
    itemScores = scoreItemAcrossPresets(item, rands);

    const poolExpected = pool.map((pi) => expectedRandom(randsByItem.get(pi.id) ?? []));
    for (const p of presets) {
      poolScores[p.id] = pool.map((pi, i) => scoreWithShared(pi, poolExpected[i], p.weights));
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <Link
          href={from === "ranking" ? "/ranking" : "/items"}
          className="inline-flex items-center gap-1 hover:underline"
        >
          <ChevronLeftIcon className="size-3.5" aria-hidden />
          {from === "ranking" ? "返回排行榜" : "返回道具列表"}
        </Link>
      </nav>

      <ItemDetail item={item} maxValues={phase2 ? maxValues : undefined} cover={cover} />

      <ItemTags item={item} rands={rands} />

      {phase2 && (
        <div className="flex flex-wrap items-center gap-2">
          <CompareButton itemId={item.id} />
          <Link
            href={`/ranking?type=${encodeURIComponent(item.type!)}&highlight=${item.id}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground underline hover:text-foreground"
          >
            在排行榜中查看
            <ChevronRightIcon className="size-3.5" aria-hidden />
          </Link>
        </div>
      )}

      {phase2 && (
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <div className="mb-2 text-sm font-medium">流派分位</div>
          <PresetPercentile itemScores={itemScores} poolScores={poolScores} />
          <p className="mt-2 text-xs text-muted-foreground">
            於同類型裝備池中的百分位；越靠右代表此流派下此件越強。
          </p>
        </div>
      )}

      <ItemRandTable rands={rands} />

      <ItemDropList sources={sources} />
    </div>
  );
}
