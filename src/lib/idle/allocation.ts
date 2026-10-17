import { AUTO_ALLOCATE } from "@/configs/idle";
import { hitChance, usesInner } from "@/lib/combat/damage";
import { nextCost } from "@/lib/stat-sim";
import { ATTRIBUTE_KEYS, type AttributeKey, type Attributes } from "@/lib/types/stat-sim";
import { buildCombatant } from "./character";
import { activeSkill, monsterTarget } from "./skills";
import type { IdleData, IdleState } from "./types";

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

/**
 * 依門派自動配點（模板定義在 configs/idle.ts 的 AUTO_ALLOCATE）：先點技巧到命中率達標，其餘全點主攻擊屬性。
 * 回傳加點量（可直接餵 applyAllocation）；沒有點數或點不動時是空物件。
 */
export function autoAllocateDelta(state: IdleState, data: IdleData): AttributeDelta {
  const attributes: Attributes = { ...state.attributes };
  let points = state.unspentPoints;
  const delta: AttributeDelta = {};
  const add = (key: AttributeKey): boolean => {
    const cost = nextCost(attributes[key]);
    if (cost > points) return false;
    points -= cost;
    attributes[key] += 1;
    delta[key] = (delta[key] ?? 0) + 1;
    return true;
  };
  const build = () => buildCombatant({ sectId: state.sectId, level: state.level, attributes }, data);

  const first = build();
  const skill = activeSkill(data, state.level, first, state.skillId)?.data ?? null;
  const hardest = Object.values(data.monsters).reduce((a, b) => (b.baseDodge > a.baseDodge ? b : a));
  const target = monsterTarget(hardest);
  while (points > 0 && hitChance(build().attacker, target, skill) < AUTO_ALLOCATE.targetHitChance) {
    if (!add(AUTO_ALLOCATE.hitAttribute)) break;
  }
  const main = AUTO_ALLOCATE.mainAttribute[usesInner(first.attacker, skill) ? "matk" : "atk"];
  while (points > 0 && add(main));
  return delta;
}
