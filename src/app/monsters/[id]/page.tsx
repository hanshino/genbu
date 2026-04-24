import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeftIcon } from "lucide-react";
import { getMonsterById, getDropsForMonster } from "@/lib/queries/monsters";
import { MonsterDetailView } from "@/components/monsters/monster-detail";
import { MonsterDropTable } from "@/components/monsters/monster-drop-table";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const monster = getMonsterById(Number(id));
  if (!monster) return { title: "怪物不存在 · 玄武" };
  return {
    title: `${monster.name} · 怪物 · 玄武`,
    description: `${monster.name} 的屬性、掉落與出現資訊`,
  };
}

export default async function MonsterDetailPage({ params }: PageProps) {
  const { id } = await params;
  const monsterId = Number(id);
  if (!Number.isInteger(monsterId) || monsterId <= 0) notFound();

  const monster = getMonsterById(monsterId);
  if (!monster) notFound();

  const drops = getDropsForMonster(monsterId);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <Link href="/monsters" className="inline-flex items-center gap-1 hover:underline">
          <ChevronLeftIcon className="size-3.5" aria-hidden />
          返回怪物列表
        </Link>
      </nav>

      <MonsterDetailView monster={monster} />

      <MonsterDropTable drops={drops} />
    </div>
  );
}
