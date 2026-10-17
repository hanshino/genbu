import { nextCost } from "@/lib/stat-sim";
import { ATTRIBUTE_KEYS, type AttributeKey, type Attributes } from "@/lib/types/stat-sim";
import type { IdleState } from "./types";

export type AttributeDelta = Partial<Record<AttributeKey, number>>;

/** 把某項屬性從目前值加 count 點要花的點數（不含裝六圍；成本隨值遞增，用 stat-sim 的 nextCost）。超過 limit 提早回傳。 */
function costOf(current: number, count: number, limit: number): number {
  let total = 0;
  for (let i = 0; i < count && total <= limit; i++) total += nextCost(current + i);
  return total;
}

/** 驗證請求的加點（只能加、整數、屬性名合法、點數夠）。合法回傳新的六圍與花費；否則回傳中文錯誤訊息。 */
export function applyAllocation(
  state: Pick<IdleState, "attributes" | "unspentPoints">,
  delta: unknown,
): { attributes: Attributes; cost: number } | { error: string } {
  if (typeof delta !== "object" || delta === null || Array.isArray(delta)) return { error: "請提供要加的屬性點數。" };
  const attributes = { ...state.attributes };
  let cost = 0;
  let requested = 0;
  for (const [key, value] of Object.entries(delta)) {
    if (!(ATTRIBUTE_KEYS as readonly string[]).includes(key)) return { error: `不認得的屬性：${key}。` };
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
      return { error: "屬性點數必須是大於等於 0 的整數。" };
    }
    if (value === 0) continue;
    const attr = key as AttributeKey;
    requested += value;
    if (requested > state.unspentPoints) return { error: "可用點數不足。" };
    cost += costOf(attributes[attr], value, state.unspentPoints);
    if (cost > state.unspentPoints) return { error: "可用點數不足。" };
    attributes[attr] += value;
  }
  if (requested === 0) return { error: "請至少加 1 點屬性。" };
  return { attributes, cost };
}
