import {
  ATTACK_SPEED_TABLE,
  ESTIMATED_POINT_FROM,
  floorStat,
  LEVEL_POINT_SEGMENTS,
  pointCost,
  RANGED_UNSUPPORTED_REASON,
  RANGED_WEAPON_TYPES,
  REBIRTH_REWARDS,
  SECTS,
} from "@/configs/stat-sim";
import {
  ATTRIBUTE_KEYS,
  EQUIP_SLOTS,
  STAT_KEYS,
  type AttributeKey,
  type CharacterV1,
  type CollectionThreshold,
  type GameData,
  type Issue,
  type PanelBonus,
  type PanelResult,
  type RebirthInference,
  type StatBreakdown,
  type StatKey,
  type StatValue,
  type ValueRange,
} from "@/lib/types/stat-sim";
import { itemAttributeNames } from "@/lib/constants/i18n";

export { pointCost };

function requireInteger(value: number, min: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new RangeError(`${label}必須是大於等於 ${min} 的整數`);
  }
}

export function levelPoints(lv: number): number {
  requireInteger(lv, 1, "等級");
  const segment = LEVEL_POINT_SEGMENTS.find(({ from }) => lv >= from)!;
  return segment.slope * lv + segment.offset;
}

export function rebirthReward(lv: number): number {
  requireInteger(lv, 100, "轉生等級");
  if (lv > 140) throw new RangeError("轉生等級不可超過 140");
  return REBIRTH_REWARDS[lv - 100];
}

export function nextCost(v: number): number {
  requireInteger(v, 1, "不含裝屬性");
  return pointCost(v + 1);
}

/** 保留負值讓呼叫端提示裝備填錯，不偷偷截成 1。 */
export function bareFromEquipped(equippedValue: number, nonBareAttrBonus: number): number {
  if (!Number.isFinite(equippedValue) || !Number.isFinite(nonBareAttrBonus)) {
    throw new RangeError("含裝屬性與非裸值加成必須是有限數值");
  }
  return equippedValue - nonBareAttrBonus;
}

/** 回傳全部九項，降收藏值時也會清除未達門檻的舊等級；不改動其他技能。 */
export function collectionLevels(value: number, thresholds: readonly CollectionThreshold[]): Record<number, number> {
  requireInteger(value, 0, "收藏值");
  const levels: Record<number, number> = Object.fromEntries(
    Array.from({ length: 9 }, (_, i) => [1151 + i, 0]),
  );
  for (const row of thresholds) {
    if (row.magicId >= 1151 && row.magicId <= 1159 && row.value <= value) {
      levels[row.magicId] = Math.max(levels[row.magicId], row.level);
    }
  }
  return levels;
}

export function costBandForNextCost(cost: number): { min: number; max: number } {
  requireInteger(cost, 1, "下一點成本");
  return cost === 1 ? { min: 1, max: 9 } : { min: 10 + 15 * (cost - 2), max: 24 + 15 * (cost - 2) };
}

/** 9 個成本 1，其後每 15 個值一階；等差級數避免高屬性逐點迴圈。 */
function attributeCost(v: number): number {
  requireInteger(v, 1, "不含裝屬性");
  if (v <= 10) return v - 1;
  const full = Math.floor((v - 10) / 15);
  const rest = (v - 10) % 15;
  return 9 + (15 * full * (full + 3)) / 2 + rest * (full + 2);
}

function rebirthReason(level: number, points: number): string | null {
  const valid = Number.isSafeInteger(points) && points <= 140 &&
    (level > 140 ? points >= 40 : points === 0 || points >= 10);
  if (valid) return null;
  return level > 140
    ? "等級超過 140 必為四轉，轉生點數總和須為 40–140 的整數，請檢查裝備、被動、手動加成與配點"
    : "轉生點數總和須為 0 或 10–140 的整數，請檢查裝備、被動、手動加成與配點";
}

export function inferRebirthPoints(input: {
  level?: number | null;
  attributes?: Partial<Record<AttributeKey, number | null>> | null;
  remaining?: number | null;
}): RebirthInference {
  const { level, attributes, remaining } = input;
  const values = ATTRIBUTE_KEYS.map((key) => attributes?.[key]);
  const estimated = values.some((v) => v != null && Number.isFinite(v) && v >= ESTIMATED_POINT_FROM);
  const reasons = estimated ? ["不含裝屬性達 146 以上，加點成本為估計"] : [];
  if (level == null || remaining == null || values.some((v) => v == null)) {
    return { total: null, status: "incomplete", reasons: ["請填齊等級、不含裝六圍與遊戲剩餘點數", ...reasons], estimated };
  }
  if (!Number.isSafeInteger(level) || level < 1 || !Number.isSafeInteger(remaining) || remaining < 0 ||
      values.some((v) => !Number.isSafeInteger(v) || v! < 1)) {
    return { total: null, status: "check", reasons: ["等級與六圍須為正整數，遊戲剩餘點數須為非負整數", ...reasons], estimated };
  }
  const total = values.reduce<number>((sum, v) => sum + attributeCost(v!), 0) + remaining - levelPoints(level);
  const invalid = rebirthReason(level, total);
  return { total, status: invalid ? "check" : "ok", reasons: invalid ? [invalid, ...reasons] : reasons, estimated };
}

/** Σ max(0, x−5−10k)，用等差級數求和，超過 200 不封頂。 */
function tier(x: number): number {
  const count = Math.max(0, Math.ceil((x - 5) / 10));
  return count * (x - 5) - 5 * count * (count - 1);
}

function estimate(stat: StatValue, reason: string): void {
  stat.estimated = true;
  if (!stat.estimateReasons.includes(reason)) stat.estimateReasons.push(reason);
}

function inRanges(value: number, ranges: ValueRange[]): boolean {
  return Number.isSafeInteger(value) && ranges.some(([min, max]) => value >= min && value <= max);
}

export function computePanel(character: CharacterV1, data: GameData): PanelResult {
  const sect = SECTS[character.sectId];
  if (!sect) throw new RangeError("v1 未支援此主門派");
  const earned = levelPoints(character.level);
  const costs = {} as Record<AttributeKey, number>;
  const next = {} as Record<AttributeKey, number>;
  for (const key of ATTRIBUTE_KEYS) {
    costs[key] = attributeCost(character.attributes[key]);
    next[key] = nextCost(character.attributes[key]);
  }
  const totalCost = ATTRIBUTE_KEYS.reduce((sum, key) => sum + costs[key], 0);
  const issues: Issue[] = [];
  const incompleteReasons: string[] = [];
  const issue = (code: string, message: string, refId?: number | string, incomplete = false) => {
    issues.push({ code, severity: incomplete ? "error" : "warning", message, ...(refId == null ? {} : { refId }) });
    if (incomplete) incompleteReasons.push(message);
  };
  const invalidRebirth = rebirthReason(character.level, character.rebirthPoints);
  if (invalidRebirth) issue("invalid-rebirth-points", invalidRebirth);
  // 非有限轉生輸入不污染所有數值，仍以 issue 明確告知未採用。
  const rebirthPoints = Number.isFinite(character.rebirthPoints) ? character.rebirthPoints : 0;
  const remaining = earned + rebirthPoints - totalCost;
  if (remaining < 0) issue("overspent-points", "配點已超過可用點數");
  if (ATTRIBUTE_KEYS.some((key) => character.attributes[key] >= ESTIMATED_POINT_FROM)) {
    issue("estimated-point-cost", "不含裝屬性達 146 以上，加點成本為估計");
  } else if (ATTRIBUTE_KEYS.some((key) => character.attributes[key] + 1 >= ESTIMATED_POINT_FROM)) {
    issue("estimated-next-cost", "下一點屬性達 146，下一點成本為估計");
  }
  if (character.meridianPlan) {
    issue("meridian-not-included", "經脈尚未計入");
    incompleteReasons.push("經脈尚未計入");
  }

  const values = Object.fromEntries(STAT_KEYS.map((key): [StatKey, StatValue] => [key, {
    value: 0, breakdown: [], estimated: false, estimateReasons: [],
  }])) as Record<StatKey, StatValue>;
  const add = (key: StatKey, amount: number, source: StatBreakdown["source"], label: string, refId?: number | string) => {
    if (!Number.isFinite(amount)) {
      issue("invalid-bonus", `${label}的 ${key} 加成不是有限數值`, refId, true);
      return;
    }
    if (amount === 0) return;
    const stat = values[key];
    stat.value = stat.value! + amount;
    stat.breakdown.push({ source, label, amount, ...(refId == null ? {} : { refId }) });
  };
  const addBonus = (bonus: PanelBonus, source: StatBreakdown["source"], label: string, refId?: number | string,
    accept: (key: StatKey) => boolean = () => true) => {
    for (const key of STAT_KEYS) {
      if (bonus[key] != null && accept(key)) add(key, bonus[key], source, label, refId);
    }
  };
  for (const key of ATTRIBUTE_KEYS) add(key, character.attributes[key], "attribute", "不含裝屬性", key);

  const hands = (["right", "left"] as const).flatMap((slot) => {
    const equipped = character.equipment[slot];
    const item = equipped && data.itemsById[equipped.itemId];
    return item ? [item] : [];
  });
  const weapons = hands.filter((item) => item.typeName !== "SHIELD");
  const weaponTypes = hands.flatMap((item) => item.typeName ? [item.typeName] : []);
  for (const slot of EQUIP_SLOTS) {
    const equipped = character.equipment[slot];
    if (!equipped) continue;
    const item = data.itemsById[equipped.itemId];
    const accept = (key: StatKey) => {
      if (key === "run_speed") return slot === "horse" || slot.startsWith("ornament");
      if (key === "attack_speed") return (slot === "right" || slot === "left") && item?.typeName !== "SHIELD";
      return true;
    };
    if (!item) {
      issue("missing-item", `找不到裝備資料：${equipped.itemId}`, equipped.itemId, true);
    } else {
      addBonus(item.stats, "equipment", item.name, item.id, accept);
      if (item.randomCount && (equipped.randomRolls?.length ?? 0) > item.randomCount[1]) {
        issue("excess-random-rolls", `${item.name}填寫的隨機素質條數超過資料上限 ${item.randomCount[1]}，資料可能不完整，合法數值仍計入`, item.id);
      }
      const seenAttributes = new Set<string>();
      for (const roll of equipped.randomRolls ?? []) {
        const option = item.randomOptions?.find((option) => option.attribute === roll.attribute);
        if (!option || seenAttributes.has(roll.attribute) || !inRanges(roll.value, option.ranges)) {
          issue("invalid-random-roll", `${item.name}的隨機素質「${roll.attribute}」重複、不支援或數值不在合法整數區間，未計入`, item.id, true);
          continue;
        }
        seenAttributes.add(roll.attribute);
        addBonus({ [option.stat]: roll.value }, "equipRandom", `${item.name} 隨機素質`, item.id, accept);
      }
      const level = equipped.enhancementLevel;
      if (!Number.isSafeInteger(level) || level < 0) {
        issue("invalid-enhancement-level", `${item.name}的強化等級不合法`, item.id, true);
      } else if (level > 0) {
        const path = item.strongPathId == null ? undefined : data.enhancementsByPath[item.strongPathId];
        if (!path) {
          issue("missing-enhancement-path", `${item.name}缺少強化路徑`, item.id, true);
        } else if (level > path.maxLevel || !path.levels[level]) {
          issue("missing-enhancement-level", `${item.name}缺少 +${level} 強化資料`, item.id, true);
        } else {
          addBonus(path.levels[level], "enhancement", `${item.name} +${level}`, item.id, accept);
        }
      }
      for (const [index, fill] of (equipped.sockets ?? []).entries()) {
        const label = `${item.name} 第 ${index + 1} 槽`;
        if (index >= (item.socketCount ?? 0)) {
          issue("invalid-socket-index", `${label}超過插槽數上限 ${item.socketCount ?? 0}，未計入`, item.id, true);
          continue;
        }
        if (fill === null) continue;
        const recipe = data.socketRecipes?.[fill.recipeId];
        if (!recipe) {
          issue("missing-socket-recipe", `${label}找不到插槽配方 ${fill.recipeId}，未計入`, item.id, true);
          continue;
        }
        if (item.socketCategory == null || !data.socketRecipeIdsByCategory?.[item.socketCategory]?.includes(fill.recipeId)) {
          issue("invalid-socket-category", `${label}不能使用「${recipe.name}」：裝備類別不符，未計入`, item.id, true);
          continue;
        }
        const effect = recipe.effects.find((effect) => effect.stat === fill.stat);
        if (!effect || !inRanges(fill.value, effect.ranges)) {
          issue("invalid-socket-effect", `${label}「${recipe.name}」的${itemAttributeNames[fill.stat] ?? fill.stat}不支援或數值不在合法整數區間，未計入`, item.id, true);
          continue;
        }
        addBonus({ [fill.stat]: fill.value }, "socket", `${label} ${recipe.name}`, recipe.id, accept);
      }
    }
    addBonus(equipped.manualBonuses, "equipManual", `${item?.name ?? equipped.itemId} 手動加值`, equipped.itemId, accept);
  }

  const passives = new Map(data.passives.map((passive) => [passive.id, passive]));
  for (const [id, level] of Object.entries(character.passiveLevels)) {
    if (level === 0 || Number(id) === 1150) continue;
    const passive = passives.get(Number(id));
    if (!passive) {
      issue("missing-passive", `找不到被動技能資料：${id}`, Number(id), true);
      continue;
    }
    if (!Number.isSafeInteger(level) || level < 0 || level > passive.maxLevel || !passive.cumulative[level]) {
      issue("invalid-passive-level", `${passive.name}缺少 Lv${level} 資料`, passive.id, true);
      continue;
    }
    if (passive.obtainableMax != null && level > passive.obtainableMax) {
      issue("unobtainable-passive-level", `${passive.name}超過目前成就可取得的 Lv${passive.obtainableMax}，請確認來源`, passive.id);
    }
    if ((passive.group === "main" && passive.clan !== sect.mainClan) ||
        (passive.group === "sub" && !character.subSects.some((clan) => clan === passive.clan))) {
      issue("inactive-passive-clan", `${passive.name}不屬於目前主／副門派，未計入`, passive.id);
      continue;
    }
    const weaponOK = !passive.weaponReq || passive.weaponReq.some((type) => weaponTypes.includes(type));
    addBonus(passive.cumulative[level], passive.group === "collection" ? "collection" : "passive",
      `${passive.name} Lv${level}`, passive.id,
      (key) => weaponOK || (passive.weaponReqStats != null && !passive.weaponReqStats.includes(key)));
    if (passive.id === 777 && hands.length > 0 && !weaponTypes.includes("STAFF") &&
        hands.some((item) => !item.typeName || !RANGED_WEAPON_TYPES.includes(item.typeName))) {
      estimate(values.matk, "禁術修練對目前武器的內勁生效條件未確認");
    }
  }

  // 裝備與被動六圍先進公式；英雄／陣法仍只在最後加，不放大。
  const s = values.str.value!, p = values.pow.value!, v = values.vit.value!;
  const a = values.agi.value!, d = values.dex.value!, w = values.wis.value!;
  const lv = character.level;
  add("hp", floorStat(200 + 10 * lv + sect.hpA * lv * (lv + 1)), "base", "門派等級體力");
  add("hp", floorStat(sect.hpK * v * (v + 1) / 2), "attribute", "根骨體力");
  add("mp", sect.mp.level * lv + sect.mp.base, "base", "門派等級真氣");
  add("mp", sect.mp.pow * p + sect.mp.wis * w, "attribute", "內力與玄學真氣");
  add("atk", floorStat(3 * s + 0.4 * tier(s)), "attribute", "外功物攻");
  add("matk", floorStat(3 * p + 0.3 * tier(p)), "attribute", "內力內勁");
  add("def", 3 * v, "attribute", "根骨防禦");
  add("mdef", sect.mdef(p, w), "attribute", "門派護勁");
  add("hit", lv + 50, "base", "等級命中");
  add("hit", 3 * d, "attribute", "技巧命中");
  add("dodge", lv + 50, "base", "等級閃躲");
  add("dodge", 3 * a, "attribute", "身法閃躲");
  add("critical", 1, "base", "基礎重擊");
  add("critical", floorStat(d / 25) + floorStat(0.15 * w), "attribute", "技巧與玄學重擊");
  add("uncanny_dodge", 1, "base", "基礎拆招");
  add("uncanny_dodge", floorStat(w / 10), "attribute", "玄學拆招");
  add("weight", 250 * lv + 10000, "base", "等級負重上限");
  add("weight", 100 * s, "attribute", "外功負重上限");
  add("run_speed", 5, "base", "基礎移動速度");
  add("attack_speed", 7, "base", "空手基礎攻速");
  add("attack_speed", floorStat(a / 25), "attribute", "身法攻速");

  if (EQUIP_SLOTS.some((slot) => character.equipment[slot] != null)) {
    estimate(values.weight, "穿裝負重上限存在未解殘差，未額外補值");
  }
  if (weapons.some((item) => {
    const row = item.typeName ? ATTACK_SPEED_TABLE[item.typeName] : undefined;
    return (row?.sects?.[character.sectId] ?? row?.default) !== 185;
  })) {
    estimate(values.attack_speed, "武器攻速表值非 185 或未知，暫用空手攻速加武器攻速");
  }
  if (character.sectId === 8192 && lv !== 198) {
    estimate(values.hp, "麒麟體力等級係數僅以 Lv198 單點推算");
  }

  addBonus(character.manual.hero, "hero", "英雄手動加值");
  addBonus(character.manual.formation, "formation", "陣法手動加值");
  if (weaponTypes.some((type) => RANGED_WEAPON_TYPES.includes(type))) {
    values.atk.value = null;
    estimate(values.atk, RANGED_UNSUPPORTED_REASON);
  }
  for (const stat of Object.values(values)) {
    for (const reason of incompleteReasons) estimate(stat, reason);
  }
  const { str, pow, vit, agi, dex, wis, weight, ...stats } = values;
  return {
    attributes: { str, pow, vit, agi, dex, wis },
    stats: { ...stats, weight_cap: weight },
    points: { levelPoints: earned, rebirthPoints, costs, totalCost, remaining, nextCost: next },
    issues,
  };
}
