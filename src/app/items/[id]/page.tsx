import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRightIcon, HammerIcon, PackageSearchIcon, TrendingUpIcon } from "lucide-react";
import { BackLink } from "@/components/common/back-link";
import { getItemById, getItemRands, getItemRandsByIds, getItemsByType } from "@/lib/queries/items";
import { getMonstersByDropItem } from "@/lib/queries/monsters";
import { getStagesForMonsters } from "@/lib/queries/monster-spawns";
import { getShopsBuyingItem, getShopsSellingItem } from "@/lib/queries/shops";
import {
  getCompoundSourcesForItem,
  getCompoundUsesForItem,
  getEquipmentEnhancementsForItemType,
} from "@/lib/queries/compound";
import { getMissionsUsingItem } from "@/lib/queries/missions";
import { getAwakeningPath } from "@/lib/queries/awakening";
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
import { AwakeningSection } from "@/components/items/awakening-section";
import { CompoundSourcesSection } from "@/components/items/compound-sources-section";
import { CompoundUsesSection } from "@/components/items/compound-uses-section";
import { EquipmentEnhancementsSection } from "@/components/items/equipment-enhancements-section";
import { ShopBuybackSection, ShopSalesSection } from "@/components/items/shop-availability-section";
import { MissionUsesSection } from "@/components/items/mission-uses-section";
import { ItemSectionGroup, summarizeSourceRoutes } from "@/components/items/item-section-group";
import { CompareButton } from "@/components/items/compare-button";
import { ItemTags } from "@/components/items/item-tags";
import { PresetPercentile } from "@/components/items/preset-percentile";
import { imageOfItem } from "@/lib/equipment-images";
import { getItemIcon, getNpcImageMap } from "@/lib/queries/images";

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
  const spawnsByMonster = getStagesForMonsters(sources.map((s) => s.id));
  const cover = imageOfItem(item);
  const fallbackIcon = cover ? null : getItemIcon(item.id);
  const sourcePortraitMap = getNpcImageMap(sources.map((s) => s.id));

  // 取得途徑 / 用途 / 強化的資料在此一次取齊：分組是否渲染要看筆數，
  // 若仍留在各子元件內查詢，page 端無法在全部為空時避免印出空的分組外框。
  const shopSales = getShopsSellingItem(item.id);
  const shopBuys = getShopsBuyingItem(item.id);
  const compoundSources = getCompoundSourcesForItem(item.id);
  const compoundUses = getCompoundUsesForItem(item.id);
  const missionUses = getMissionsUsingItem(item.id);
  const awakeningPath = getAwakeningPath(item);
  const enhancements = getEquipmentEnhancementsForItemType(item.type);

  const sourceSummary = summarizeSourceRoutes({
    drops: sources.length,
    shops: shopSales.length,
    compounds: compoundSources.length,
  });
  const hasUses = compoundUses.length > 0 || missionUses.length > 0 || shopBuys.length > 0;
  const hasProgression = awakeningPath != null || enhancements.length > 0;

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
        <BackLink href={from === "ranking" ? "/ranking" : "/items"}>
          {from === "ranking" ? "返回排行榜" : "返回道具列表"}
        </BackLink>
      </nav>

      <ItemDetail
        item={item}
        maxValues={phase2 ? maxValues : undefined}
        cover={cover}
        fallbackIcon={fallbackIcon}
      />

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

      <ItemSectionGroup
        id="how-to-get"
        title="如何取得"
        icon={<PackageSearchIcon />}
        description={sourceSummary ? `目前資料庫可查到的入手途徑：${sourceSummary}。` : undefined}
      >
        {sourceSummary ? (
          <>
            <ItemDropList
              sources={sources}
              spawnsByMonster={spawnsByMonster}
              portraitMap={sourcePortraitMap}
            />

            <ShopSalesSection sales={shopSales} />

            <CompoundSourcesSection itemId={item.id} sources={compoundSources} />
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-sm leading-relaxed text-muted-foreground">
            資料庫中查無此道具的怪物掉落、商店販售或煉化配方紀錄。它可能來自任務獎勵、活動、商城或其他尚未收錄的來源。
          </p>
        )}
      </ItemSectionGroup>

      {hasUses && (
        <ItemSectionGroup
          id="item-uses"
          title="用途與去向"
          icon={<HammerIcon />}
          description="以下為此道具的消耗與出清方式，不是取得來源。"
        >
          <CompoundUsesSection uses={compoundUses} />

          <MissionUsesSection uses={missionUses} />

          <ShopBuybackSection buys={shopBuys} />
        </ItemSectionGroup>
      )}

      {hasProgression && (
        <ItemSectionGroup
          id="item-progression"
          title="強化與覺醒"
          icon={<TrendingUpIcon />}
          description="取得之後可以怎麼把它變強；成本與機率皆為資料庫數值，非官方公告。"
        >
          {awakeningPath && <AwakeningSection path={awakeningPath} />}

          <EquipmentEnhancementsSection uses={enhancements} />
        </ItemSectionGroup>
      )}
    </div>
  );
}
