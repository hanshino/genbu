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
