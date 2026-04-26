import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BackLink } from "@/components/common/back-link";
import { Badge } from "@/components/ui/badge";
import { COMPOUND_TYPE_LABELS, compoundTypeRank } from "@/lib/constants/compound";
import {
  getCompoundGroupById,
  getCompoundsByGroupEnriched,
} from "@/lib/queries/compound";
import { CompoundRecipeTable } from "@/components/compounds/compound-recipe-table";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isInteger(groupId) || groupId <= 0) return { title: "煉化群組 · 玄武" };
  const group = getCompoundGroupById(groupId);
  if (!group) return { title: "煉化群組不存在 · 玄武" };
  return {
    title: `${group.name ?? `#${group.id}`} · 煉化配方 · 玄武`,
    description: `${group.name} 群組的全部煉化配方`,
  };
}

export default async function CompoundGroupDetailPage({ params }: PageProps) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isInteger(groupId) || groupId <= 0) notFound();

  const group = getCompoundGroupById(groupId);
  if (!group) notFound();

  const recipes = getCompoundsByGroupEnriched(groupId);

  // 同 type 的配方放在一起，再依固定順序排序（強化 → 還原 → 合成 → 群組）
  const byType = new Map<string, typeof recipes>();
  for (const r of recipes) {
    const list = byType.get(r.type) ?? [];
    list.push(r);
    byType.set(r.type, list);
  }
  const typeBlocks = [...byType.entries()].sort(
    ([a], [b]) => compoundTypeRank(a) - compoundTypeRank(b),
  );

  let lvMin = Infinity;
  let lvMax = -Infinity;
  for (const r of recipes) {
    if (r.level == null) continue;
    if (r.level < lvMin) lvMin = r.level;
    if (r.level > lvMax) lvMax = r.level;
  }
  const levelRange = !Number.isFinite(lvMin)
    ? null
    : lvMin === lvMax
      ? `Lv${lvMin}`
      : `Lv${lvMin}~${lvMax}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <BackLink href="/compounds">返回配方目錄</BackLink>
      </nav>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {group.name ?? `#${group.id}`}
        </h1>
        <p className="text-sm text-muted-foreground">
          GroupID #{group.id} · {recipes.length} 條配方
          {levelRange && ` · ${levelRange}`}
        </p>
      </header>

      <div className="space-y-6">
        {typeBlocks.map(([type, items]) => (
          <section key={type} className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{COMPOUND_TYPE_LABELS[type] ?? type}</Badge>
              <span className="text-xs text-muted-foreground">{items.length} 條</span>
            </div>
            <CompoundRecipeTable recipes={items} />
          </section>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        產出機率為單次嘗試成功時的條件機率（裝備類煉化失敗會掉到「失敗回收」道具）。
        副材料中標為「武器類 / 帽子類 / 衣服類 / 鞋子類 / 飾品類」者代表「目標槽位通用」（任何同槽裝備皆可）。
      </p>
    </div>
  );
}
