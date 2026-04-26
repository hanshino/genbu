import { getEquipmentEnhancementsForItemType } from "@/lib/queries/compound";
import type { CompoundUse } from "@/lib/queries/compound";
import {
  EnhancementsList,
  type BonusBucket,
} from "@/components/items/enhancements-list";

/**
 * 將配方按「主加成屬性」分桶。每個 use 的 outputs 第一個（已按 prob desc 排序）視為主 bonus。
 * 沒有可識別 bonus 的歸到「其他」。
 * 桶內的 uses 不在此排序：交給 client 端依使用者選的排序模式重排。
 */
function bucketByBonus(uses: CompoundUse[]): BonusBucket[] {
  const buckets = new Map<string, CompoundUse[]>();
  for (const u of uses) {
    const main = u.outputs[0];
    const key = main?.label ?? "其他";
    const list = buckets.get(key) ?? [];
    list.push(u);
    buckets.set(key, list);
  }

  const result: BonusBucket[] = [];
  for (const [label, list] of buckets) {
    let minBonus = Infinity;
    let maxBonus = -Infinity;
    let minProb = Infinity;
    let maxProb = -Infinity;
    for (const u of list) {
      const main = u.outputs[0];
      if (!main) continue;
      if (main.min != null && main.min < minBonus) minBonus = main.min;
      if (main.max != null && main.max > maxBonus) maxBonus = main.max;
      if (main.prob < minProb) minProb = main.prob;
      if (main.prob > maxProb) maxProb = main.prob;
    }
    result.push({
      label,
      uses: list,
      minBonus: Number.isFinite(minBonus) ? minBonus : 0,
      maxBonus: Number.isFinite(maxBonus) ? maxBonus : 0,
      minProb: Number.isFinite(minProb) ? minProb : 0,
      maxProb: Number.isFinite(maxProb) ? maxProb : 0,
    });
  }
  // 屬性順序：按最大加值倒序，最強的屬性先呈現
  result.sort((a, b) => b.maxBonus - a.maxBonus);
  return result;
}

export function EquipmentEnhancementsSection({ itemType }: { itemType: string | null }) {
  const uses = getEquipmentEnhancementsForItemType(itemType);
  if (uses.length === 0) return null;

  const buckets = bucketByBonus(uses);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium">可用強化</h2>
        <span className="text-xs text-muted-foreground">
          同槽位裝備通用 · {uses.length} 條配方 · {buckets.length} 種屬性
        </span>
      </div>

      <EnhancementsList buckets={buckets} />

      <p className="text-xs text-muted-foreground">
        強化配方依裝備槽位歸類；同槽位裝備皆通用。同一條配方可能含多個加成（顯示主加成）；機率為單次嘗試該加成出現的機率。
      </p>
    </section>
  );
}
