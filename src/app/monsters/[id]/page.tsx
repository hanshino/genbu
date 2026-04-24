import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMonsterById, getDropsForMonster } from "@/lib/queries/monsters";
import { MonsterDetailView } from "@/components/monsters/monster-detail";
import { MonsterDropTable } from "@/components/monsters/monster-drop-table";
import { BackLink } from "@/components/common/back-link";

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

  const { drops, totalWeight } = getDropsForMonster(monsterId);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <BackLink href="/monsters">返回怪物列表</BackLink>
      </nav>

      <MonsterDetailView monster={monster} />

      <MonsterDropTable drops={drops} totalWeight={totalWeight} />
    </div>
  );
}
