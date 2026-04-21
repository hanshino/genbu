import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getItemById, getItemRands } from "@/lib/queries/items";
import { getMonstersByDropItem } from "@/lib/queries/monsters";
import { ItemDetail } from "@/components/items/item-detail";
import { ItemRandTable } from "@/components/items/item-rand-table";
import { ItemDropList } from "@/components/items/item-drop-list";

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

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <Link href="/items" className="hover:underline">
          ← 返回道具列表
        </Link>
      </nav>

      <ItemDetail item={item} />

      <ItemRandTable rands={rands} />

      <ItemDropList sources={sources} />
    </div>
  );
}
