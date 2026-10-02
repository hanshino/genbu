import { itemAttributeNames } from "@/lib/constants/i18n";
import { computePanel } from "@/lib/stat-sim";
import {
  EQUIP_SLOTS, STAT_KEYS,
  type CharacterV1, type EquippedItem, type EquipSlot, type GameData, type PanelBonus,
  type SimRandomOption, type SocketRecipe, type StatKey, type ValueRange,
} from "@/lib/types/stat-sim";
import {
  IMPORT_STAT_KEYS, type ImportDiagnostic, type ImportEquipEntry,
} from "@/lib/types/stat-sim-import";

type Effect = SocketRecipe["effects"][number];
type PendingSocket = { index: number; recipeId: number; effects: Effect[] };
type Allocation = { values: number[]; roll?: { attribute: string; value: number } };

const imported = (stat: StatKey) => IMPORT_STAT_KEYS.some((key) => key === stat);
const minimum = (ranges: ValueRange[]) => Math.min(...ranges.map(([min]) => min));

/** Enumerate interval combinations, never the integers inside an interval (at most four sockets). */
function intervalBoxes(ranges: ValueRange[][], visit: (box: ValueRange[]) => void, box: ValueRange[] = []): void {
  if (box.length === ranges.length) { visit(box); return; }
  for (const range of ranges[box.length]) intervalBoxes(ranges, visit, [...box, range]);
}

function lexGreater(a: number[], b: number[]): boolean {
  const index = a.findIndex((value, i) => value !== b[i]);
  return index >= 0 && a[index] > b[index];
}

/** Integer water filling minimizes spread; equal-cost remainders go to the earlier socket. */
function evenValues(total: number, box: ValueRange[]): number[] {
  if (!box.length) return [];
  const clamp = (value: number, [min, max]: ValueRange) => Math.max(min, Math.min(max, value));
  let low = Math.min(...box.map(([min]) => min));
  let high = Math.max(...box.map(([, max]) => max));
  while (low < high) {
    const mid = low + Math.ceil((high - low) / 2);
    if (box.reduce((sum, range) => sum + clamp(mid, range), 0) <= total) low = mid;
    else high = mid - 1;
  }
  const values = box.map((range) => clamp(low, range));
  let rest = total - values.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < values.length && rest > 0; i++) {
    if (values[i] === low && values[i] < box[i][1]) { values[i]++; rest--; }
  }
  return values;
}

function allocate(total: number, sockets: Effect[], options: SimRandomOption[]): Allocation | null {
  let best: Allocation | null = null;
  let bestSpread = Infinity;
  // Prefer a real random roll to an absent roll; aliases for the same stat use DB option order.
  const choices: (SimRandomOption | undefined)[] = total > 0 ? [...options, undefined] : [undefined];
  for (const option of choices) {
    intervalBoxes([...sockets.map((socket) => socket.ranges), ...(option ? [option.ranges] : [])], (box) => {
      const socketBox = box.slice(0, sockets.length);
      const minSum = socketBox.reduce((sum, [min]) => sum + min, 0);
      const maxSum = socketBox.reduce((sum, [, max]) => sum + max, 0);
      const randomRange = option ? box[box.length - 1] : [0, 0];
      const roll = Math.min(randomRange[1], total - minSum);
      if (roll < randomRange[0] || total - roll > maxSum) return;
      let rest = total - roll - minSum;
      const values = option ? socketBox.map(([min, max]) => {
        const delta = Math.min(rest, max - min);
        rest -= delta;
        return min + delta;
      }) : evenValues(total, socketBox);
      const spread = values.reduce((sum, value) => sum + value * value, 0);
      const better = !best || (option
        ? roll > best.roll!.value || (roll === best.roll!.value && lexGreater(values, best.values))
        : spread < bestSpread || (spread === bestSpread && lexGreater(values, best.values)));
      if (better) {
        best = { values, ...(option ? { roll: { attribute: option.attribute, value: roll } } : {}) };
        bestSpread = spread;
      }
    });
    if (best) return best;
  }
  return null;
}

/** Pure decomposition of validated importer input; enhancement is deliberately not part of S. */
export function decomposeEquipment(
  entry: ImportEquipEntry, slot: EquipSlot, data: GameData,
): { equipment: EquippedItem; diagnostics: ImportDiagnostic[] } {
  const item = data.itemsById[entry.id];
  const diagnostics: ImportDiagnostic[] = [];
  const warn = (code: string, message: string, stat?: StatKey) => {
    diagnostics.push({ code, severity: "warning", message, slot, itemId: entry.id, ...(stat ? { stat } : {}) });
  };
  const equipment: EquippedItem = { itemId: entry.id, enhancementLevel: entry.plus, manualBonuses: {} };
  const residual: PanelBonus = {};
  for (const stat of IMPORT_STAT_KEYS) residual[stat] = (entry.stats[stat] ?? 0) - (item?.stats[stat] ?? 0);
  if (!item) {
    equipment.manualBonuses = Object.fromEntries(Object.entries(residual).filter(([, value]) => value !== 0));
    warn("missing-item", `找不到裝備資料：${entry.id}，實例數值保留為手動加值`);
    return { equipment, diagnostics };
  }
  const originalResidual = { ...residual };
  const mismatch = new Set<StatKey>();
  for (const stat of IMPORT_STAT_KEYS) {
    if (residual[stat]! < 0) {
      mismatch.add(stat);
      warn("data-mismatch", `${item.name}的${itemAttributeNames[stat] ?? stat}低於固定值，可能資料版本不一致`, stat);
    }
  }
  const sockets: NonNullable<EquippedItem["sockets"]> = Array.from({ length: item.socketCount ?? 0 }, () => null);
  equipment.sockets = sockets;
  equipment.randomRolls = [];
  const pending: PendingSocket[] = [];
  const fixedIndices = new Set<number>();
  for (const [index, recipeId] of entry.inlays.filter((id) => id !== 0).entries()) {
    const label = `${item.name}第 ${index + 1} 槽`;
    // Overflow has no array entry: even a trailing null would be an invalid-socket-index in the engine.
    if (index >= sockets.length) { warn("invalid-socket-index", `${label}超過插槽數上限，已略過`); continue; }
    const recipe = data.socketRecipes?.[recipeId];
    if (!recipe) { warn("missing-socket-recipe", `${label}找不到配方 ${recipeId}`); continue; }
    if (item.socketCategory == null || !data.socketRecipeIdsByCategory?.[item.socketCategory]?.includes(recipeId)) {
      warn("invalid-socket-category", `${label}不能使用「${recipe.name}」：裝備類別不符`);
      continue;
    }
    const effects = STAT_KEYS.flatMap((stat) => {
      const effect = recipe.effects.find((effect) => effect.stat === stat);
      return imported(stat) && effect?.ranges.length ? [effect] : [];
    });
    if (!effects.length) { warn("undecomposable", `${label}沒有匯入格式支援的效果，已保留空槽`); continue; }
    const effect = effects[0];
    if (recipe.effects.length === 1 && effect.ranges.length === 1 && effect.ranges[0][0] === effect.ranges[0][1]) {
      const value = effect.ranges[0][0];
      sockets[index] = { recipeId, stat: effect.stat, value };
      fixedIndices.add(index);
      residual[effect.stat] = residual[effect.stat]! - value;
    } else pending.push({ index, recipeId, effects });
  }

  const optionsFor = (stat: StatKey) => (item.randomOptions ?? []).filter((option) => option.stat === stat);
  // Search effect assignments in socket / STAT_KEYS order. Look ahead so a locally valid effect
  // cannot steal the residual needed by a later single-effect socket.
  let chosen: Effect[] = [];
  let fewestFailures = Infinity;
  function chooseEffects(effects: Effect[]): boolean {
    if (effects.length < pending.length) {
      for (const effect of pending[effects.length].effects) {
        if (chooseEffects([...effects, effect])) return true;
      }
      return false;
    }
    const failures = [...new Set(effects.map((effect) => effect.stat))].filter((stat) =>
      !allocate(residual[stat]!, effects.filter((effect) => effect.stat === stat), optionsFor(stat))).length;
    if (failures < fewestFailures) { chosen = effects; fewestFailures = failures; }
    return failures === 0;
  }
  chooseEffects([]);
  for (const stat of IMPORT_STAT_KEYS) {
    const indices = chosen.flatMap((effect, i) => effect.stat === stat ? [i] : []);
    const effects = indices.map((i) => chosen[i]);
    const options = optionsFor(stat);
    const total = residual[stat]!;
    const relevant = effects.length > 0 || (total > 0 && options.length > 0);
    const allocation = relevant ? allocate(total, effects, options) : null;
    let failed = false;
    if (relevant) {
      // No exact solution: keep each known recipe at a legal minimum, omit rolls, and compensate
      // with a signed manual delta. Dropping recipes or zeroing illegal ranges would lose information.
      indices.forEach((i, j) => {
        const value = allocation?.values[j] ?? minimum(chosen[i].ranges);
        sockets[pending[i].index] = { recipeId: pending[i].recipeId, stat, value };
        residual[stat] = residual[stat]! - value;
      });
      if (allocation?.roll) {
        equipment.randomRolls.push(allocation.roll);
        residual[stat] = residual[stat]! - allocation.roll.value;
      }
      failed = !allocation;
    }
    if (residual[stat]! < 0 && total !== originalResidual[stat]) failed = true;
    if (failed) warn("undecomposable", `${item.name}的${itemAttributeNames[stat] ?? stat}無法拆解，差額保留為手動加值`, stat);
    if (residual[stat] !== 0) {
      equipment.manualBonuses[stat] = residual[stat];
      if (!failed && !mismatch.has(stat)) {
        warn("unmatched-residual", `${item.name}的${itemAttributeNames[stat] ?? stat}有 ${residual[stat]} 無法對應到隨機素質或插槽`, stat);
      }
    }
  }

  // Same minimal defaults as createDefaultCharacter, without its random ID / clock dependency.
  const character: CharacterV1 = {
    version: 1, id: "import-check", name: "匯入驗算", sectId: 2, subSects: [], level: 1, rebirthPoints: 0,
    attributes: { str: 1, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 },
    equipment: Object.fromEntries(EQUIP_SLOTS.map((key) => [key, key === slot ? equipment : null])) as CharacterV1["equipment"],
    passiveLevels: {}, meridianPlan: null, manual: { hero: {}, formation: {} },
  };
  const invalid = computePanel(character, data).issues.filter((issue) =>
    issue.code.startsWith("invalid-") && issue.refId === entry.id);
  if (invalid.length) {
    equipment.randomRolls = [];
    equipment.sockets = sockets.map((fill, index) => fixedIndices.has(index) ? fill : null);
    equipment.manualBonuses = {};
    for (const stat of IMPORT_STAT_KEYS) {
      const delta = originalResidual[stat]! - equipment.sockets.reduce((sum, fill) => sum + (fill?.stat === stat ? fill.value : 0), 0);
      if (delta !== 0) equipment.manualBonuses[stat] = delta;
    }
    warn("undecomposable", `${item.name}未通過裝備驗算（${invalid.map((issue) => issue.code).join("、")}），僅保留固定插槽，其餘轉為手動加值`);
  }
  return { equipment, diagnostics };
}
