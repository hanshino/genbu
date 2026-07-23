import type { CompoundUse } from "@/lib/queries/compound";

/**
 * 將配方按 groupName 分組；沒有 group 的歸到「未分類」並擺在最後。
 * Map iteration 採插入順序，所以保留 uses 中 group 首次出現的順序。
 */
export function groupCompoundsByGroupName(
  uses: CompoundUse[],
): Array<[name: string, items: CompoundUse[]]> {
  const grouped = new Map<string, CompoundUse[]>();
  const orphan: CompoundUse[] = [];
  for (const u of uses) {
    if (u.groupName) {
      const list = grouped.get(u.groupName) ?? [];
      list.push(u);
      grouped.set(u.groupName, list);
    } else {
      orphan.push(u);
    }
  }
  const blocks: Array<[string, CompoundUse[]]> = [...grouped.entries()];
  if (orphan.length > 0) blocks.push(["未分類", orphan]);
  return blocks;
}

/**
 * 蒐集一組配方中所有可能對應到圖示的 item id（主材料、副材料、產出、失敗回收）。
 * 不特別排除 placeholder（slot-kind/self）—多查詢的 id 反正查無圖，交給 UI 層依 kind 決定要不要顯示。
 * 用於一次批次呼叫 `getItemIconMap` 取得 iconMap。
 */
export function collectCompoundItemIds(uses: CompoundUse[]): number[] {
  const ids = new Set<number>();
  for (const u of uses) {
    if (u.coreMaterial) ids.add(u.coreMaterial.id);
    for (const s of u.sideMaterials) ids.add(s.id);
    for (const o of u.outputs) {
      if (o.itemId != null) ids.add(o.itemId);
    }
    if (u.failItem) ids.add(u.failItem.id);
  }
  return [...ids];
}
