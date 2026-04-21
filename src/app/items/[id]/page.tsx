import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getItemById,
  getItemRands,
  getItemsByType,
} from "@/lib/queries/items";
import { getMonstersByDropItem } from "@/lib/queries/monsters";
import { ItemDetail } from "@/components/items/item-detail";
import { ItemRandTable } from "@/components/items/item-rand-table";
import { ItemDropList } from "@/components/items/item-drop-list";
import { CompareButton } from "@/components/items/compare-button";
import { StatBarChart } from "@/components/items/stat-bar-chart";
import { ItemTags } from "@/components/items/item-tags";

const PHASE2_TYPES = new Set(["座騎", "背飾"]);

interface PageProps {
  params: Promise<{ id: string }>;
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

export default async function ItemDetailPage({ params }: PageProps) {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) notFound();

  const item = getItemById(itemId);
  if (!item) notFound();

  const rands = getItemRands(String(item.id));
  const sources = getMonstersByDropItem(item.id);

  const isPhase2Type = item.type !== null && PHASE2_TYPES.has(item.type);
  let maxValues: Record<string, number> = {};
  if (isPhase2Type && item.type) {
    const pool = getItemsByType(item.type);
    for (const it of pool) {
      for (const [k, v] of Object.entries(it)) {
        if (typeof v === "number") maxValues[k] = Math.max(maxValues[k] ?? 0, v);
      }
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <Link href="/items" className="hover:underline">
          ← 返回道具列表
        </Link>
      </nav>

      <ItemDetail item={item} />

      <ItemTags item={item} rands={rands} />

      {isPhase2Type && (
        <div className="flex flex-wrap items-center gap-2">
          <CompareButton itemId={item.id} />
          <Link
            href={`/ranking?type=${encodeURIComponent(item.type!)}&highlight=${item.id}`}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            在排行榜中查看 →
          </Link>
        </div>
      )}

      {isPhase2Type && (
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <div className="mb-2 text-sm font-medium">屬性形狀</div>
          <StatBarChart
            values={item as unknown as Record<string, number>}
            maxValues={maxValues}
          />
        </div>
      )}

      <ItemRandTable rands={rands} />

      <ItemDropList sources={sources} />
    </div>
  );
}
