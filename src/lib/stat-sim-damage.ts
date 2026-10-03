import {
  monsterK,
  SECT_SKILL_CLANS,
  SKILL_TYPE_LABELS,
  SKILL_TYPE_SUPPORT,
  SKILL_TYPE_WEAPONS,
  SUPPORT_RANK,
  UNARMED_RULE,
  VERIFIED_FUNC_DMG,
  VERIFIED_MAX_MONSTER_DEF,
  VERIFIED_MAX_MONSTER_LEVEL,
  WEAPON_RULES,
  type DamageSupport,
  type WeaponRule,
} from "@/configs/stat-sim-damage";
import { floorStat, RANGED_UNSUPPORTED_REASON, RANGED_WEAPON_TYPES } from "@/configs/stat-sim";
import { ITEM_TYPE_LABELS } from "@/lib/constants/item-types";
import { computePanel } from "@/lib/stat-sim";
import {
  ATTRIBUTE_KEYS,
  type AttributeKey,
  type CharacterV1,
  type DamageMonster,
  type DamageSkillDef,
  type GameData,
  type PanelResult,
  type SimItem,
} from "@/lib/types/stat-sim";

export interface DamageRange {
  min: number;
  max: number;
}

interface Gate {
  support: DamageSupport;
  /** presumed / unsupported 的原因，給 UI 直接顯示。 */
  reasons: string[];
}

export interface WeaponProfile extends Gate {
  /** 「龍躍鳳鳴劍（劍）」或「空手」。 */
  label: string;
  rule: WeaponRule | null;
  typeName: string | null;
  /** 面板攻擊值（物攻或內勁）；算不出來為 null。 */
  attack: number | null;
  /** 武器傷害區間；空手為 0..0。 */
  weaponDamage: DamageRange | null;
}

export interface SkillVariant {
  label: string;
  /** 觸發機率 %；只有一種結果時為 null。 */
  chance: number | null;
  /** 每段傷害。 */
  perHit: DamageRange;
}

export interface SkillDamage extends Gate {
  skill: DamageSkillDef;
  level: number;
  maxLevel: number;
  /** 段數；func_dmg 7 = p3，其他為 1。 */
  hits: number;
  /** support 為 unsupported 時是空陣列。 */
  variants: SkillVariant[];
  /** 這個等級施放一次的真氣。 */
  mp: number;
  /** 目前右手武器放不出這招時，寫要換什麼武器；這種招一定是 unsupported。 */
  wrongWeapon?: string;
}

export interface DamageResult {
  weapon: WeaponProfile;
  monster: DamageMonster;
  k: number;
  /** 這次扣的防禦（依武器是 extra_def 或 magic_def）。 */
  defense: number;
  /** 超出實測範圍等需要提醒的事。 */
  caveats: string[];
  normal: DamageRange | null;
  critical: DamageRange | null;
  skills: SkillDamage[];
}

function worst(gates: Gate[]): Gate {
  const support = gates.reduce<DamageSupport>(
    (acc, gate) => (SUPPORT_RANK[gate.support] > SUPPORT_RANK[acc] ? gate.support : acc),
    "verified",
  );
  return { support, reasons: gates.flatMap((gate) => gate.reasons) };
}

/** UI 用來判斷「調高等級就能算」的招式，留在表上不收起來。 */
export const LEVEL_TOO_LOW = "目前等級還學不到這招";

const ok: Gate = { support: "verified", reasons: [] };
const unsupported = (reason: string): Gate => ({ support: "unsupported", reasons: [reason] });
const typeLabel = (type: string) => ITEM_TYPE_LABELS[type] ?? type;
const statLabel = (stat: "atk" | "matk") => (stat === "atk" ? "物攻" : "內勁");

export function resolveWeapon(character: CharacterV1, data: GameData, panel: PanelResult): WeaponProfile {
  const weapons = (["right", "left"] as const).flatMap((slot) => {
    const equipped = character.equipment[slot];
    const item = equipped ? data.itemsById[equipped.itemId] : undefined;
    return item && item.typeName !== "SHIELD" ? [item] : [];
  });
  const empty = { attack: null, weaponDamage: null };
  if (weapons.length > 1) {
    return { label: weapons.map((item) => item.name).join("＋"), rule: null, typeName: null, ...empty,
      ...unsupported("左右手都拿武器（雙持）尚未實測") };
  }
  const item: SimItem | undefined = weapons[0];
  const typeName = item?.typeName ?? null;
  if (item && !typeName) {
    return { label: item.name, rule: null, typeName, ...empty, ...unsupported("找不到這把武器的類型") };
  }
  const rule = item ? WEAPON_RULES[typeName!] : UNARMED_RULE;
  const label = item ? `${item.name}（${typeLabel(typeName!)}）` : "空手";
  if (!rule) {
    const reason = RANGED_WEAPON_TYPES.includes(typeName!)
      ? RANGED_UNSUPPORTED_REASON
      : `「${typeLabel(typeName!)}」的傷害欄位與防禦類型尚未實測`;
    return { label, rule: null, typeName, ...empty, ...unsupported(reason) };
  }
  const attack = panel.stats[rule.attack].value;
  if (attack == null) {
    return { label, rule, typeName, ...empty, ...unsupported(`面板${statLabel(rule.attack)}算不出來`) };
  }
  let weaponDamage: DamageRange = { min: 0, max: 0 };
  if (item) {
    const range = item[rule.damageField];
    if (!range) {
      return { label, rule, typeName, attack, weaponDamage: null,
        ...unsupported(`這把武器沒有${rule.damageField === "pdamage" ? "內勁" : ""}傷害資料`) };
    }
    weaponDamage = { min: range[0], max: range[1] };
  }
  const reasons = rule.support === "presumed"
    ? [`「${typeLabel(typeName!)}」尚未實測，照劍的公式推定`]
    : [];
  return { label, rule, typeName, attack, weaponDamage, support: rule.support, reasons };
}

/** ⌊m·B·K/(K+D)⌋ − ⌊D/2⌋：D/2 只扣一次，不跟著倍率放大。 */
export function hitDamage(multiplier: number, base: number, k: number, defense: number): number {
  return Math.max(0, floorStat((multiplier * base * k) / (k + defense)) - Math.floor(defense / 2));
}

/** func_dmg 6（毒舌亂神）：⌊p1/100·(內勁 + 武器) + p3/100·物攻 + p2⌋，不扣防禦。 */
export function ignoreDefenseDamage(p1: number, p2: number, p3: number, base: number, atk: number): number {
  return floorStat((p1 / 100) * base + (p3 / 100) * atk + p2);
}

const rangeOf = (f: (base: number) => number, base: DamageRange): DamageRange => ({
  min: f(base.min),
  max: f(base.max),
});

/** 沒轉生：取角色等級學得到的最高級；有轉生：等級會歸 1 但技能保留，取最高級。 */
export function defaultSkillLevel(skill: DamageSkillDef, character: CharacterV1): number {
  const maxLevel = skill.levels.length - 1;
  // 沒有門派的招只會從匯入來，直接用學到的等級。
  const learned = skill.clan == null ? character.learnedSkills?.[skill.id] : undefined;
  if (learned != null) return Math.min(learned, maxLevel);
  if (character.rebirthPoints > 0) return maxLevel;
  const levels = skill.levels.slice(1);
  if (levels.every((level) => !level || level.learnLevel < 0)) return maxLevel;
  for (let level = maxLevel; level >= 1; level--) {
    const row = skill.levels[level];
    if (row && row.learnLevel >= 0 && row.learnLevel <= character.level) return level;
  }
  return 0;
}

/** 遊戲只看右手（暗器另要左手），不符就放不出來；回傳要換的武器，符合為 null。 */
export function weaponRequirement(skill: DamageSkillDef, character: CharacterV1, data: GameData): string | null {
  const need = skill.skillType == null ? undefined : SKILL_TYPE_WEAPONS[skill.skillType];
  if (!need) return null;
  const typeOf = (slot: "right" | "left") => {
    const equipped = character.equipment[slot];
    return equipped ? data.itemsById[equipped.itemId]?.typeName ?? "" : null;
  };
  if (need.right.includes(typeOf("right")) && (!need.left || typeOf("left") === need.left)) return null;
  const weapons = need.right.flatMap((type) => (type == null ? [] : [typeLabel(type)])).join("或");
  const hands = need.left ? `右手拿${weapons}、左手拿${typeLabel(need.left)}`
    : need.right.includes(null) ? `空手或右手拿${weapons}` : `右手拿${weapons}`;
  const typeName = SKILL_TYPE_LABELS[skill.skillType!] ?? String(skill.skillType);
  return `「${typeName}」要${hands}才能使用`;
}

/** 主門派加上已選副門派的傷害技能；沒有門派的招（副門派進階、NPC 絕學）要匯入時學過才列。 */
export function skillsForCharacter(character: CharacterV1, skills: DamageSkillDef[]): DamageSkillDef[] {
  const clans = new Set<string>([...(SECT_SKILL_CLANS[character.sectId] ?? []), ...character.subSects]);
  return skills.filter((skill) => skill.clan == null
    ? (character.learnedSkills?.[skill.id] ?? 0) > 0
    : clans.has(skill.clan));
}

function skillGate(skill: DamageSkillDef, weapon: WeaponProfile): Gate {
  const gates: Gate[] = [weapon.support === "verified" ? ok : { support: weapon.support, reasons: [] }];
  if (!VERIFIED_FUNC_DMG.includes(skill.funcDmg)) {
    gates.push(unsupported(`這類技能（func_dmg ${skill.funcDmg}）的傷害算法尚未實測`));
  }
  const typeSupport = skill.skillType == null ? undefined : SKILL_TYPE_SUPPORT[skill.skillType];
  const typeName = skill.skillType == null ? "未知" : SKILL_TYPE_LABELS[skill.skillType] ?? String(skill.skillType);
  if (!typeSupport) gates.push(unsupported(`「${typeName}」類技能用物攻還是內勁尚未實測`));
  else if (typeSupport === "presumed") {
    gates.push({ support: "presumed", reasons: [`「${typeName}」類技能尚未實測，照普攻的攻擊與防禦推定`] });
  }
  if (skill.skillType === 2 && weapon.typeName != null && weapon.typeName !== "PUNCHER") {
    gates.push({ support: "presumed", reasons: ["詐招只實測過拳套與空手"] });
  }
  if (skill.funcDmg === 6 && weapon.typeName != null && weapon.typeName !== "PUNCHER") {
    gates.push(unsupported("無視防禦類技能只實測過拳套與空手"));
  }
  return worst(gates);
}

function computeSkill(
  skill: DamageSkillDef,
  level: number,
  weapon: WeaponProfile,
  panel: PanelResult,
  k: number,
  defense: number,
  wrongWeapon: string | null,
): SkillDamage {
  const maxLevel = skill.levels.length - 1;
  const base = { skill, level, maxLevel, hits: 1, variants: [] as SkillVariant[], mp: skill.levels[level]?.mp ?? 0 };
  if (wrongWeapon) return { ...base, ...unsupported(wrongWeapon), wrongWeapon };
  if (weapon.support === "unsupported" || !weapon.weaponDamage || weapon.attack == null) {
    return { ...base, ...unsupported("目前的武器無法試算") };
  }
  // 先看能不能算，再看等級：尚未支援的招不管學不學得到都歸「尚未支援」。
  const gate = skillGate(skill, weapon);
  if (gate.support === "unsupported") return { ...base, ...gate };
  const params = skill.levels[level];
  if (level < 1 || !params) {
    return { ...base, ...unsupported(level < 1 ? LEVEL_TOO_LOW : `缺少 Lv${level} 的技能資料`) };
  }
  if (params.p1 <= 0) return { ...base, ...unsupported("技能倍率是 0，資料可能不完整") };

  const B: DamageRange = {
    min: weapon.attack + weapon.weaponDamage.min,
    max: weapon.attack + weapon.weaponDamage.max,
  };
  const scaled = (m: number) => rangeOf((b) => hitDamage(m, b, k, defense), B);
  switch (skill.funcDmg) {
    case 6: {
      // 無視防禦只吃內勁；空手時武器項為 0。
      const matk = panel.stats.matk.value;
      const atk = panel.stats.atk.value;
      if (matk == null || atk == null) return { ...base, ...unsupported("面板內勁或物攻算不出來") };
      const pB = { min: matk + weapon.weaponDamage.min, max: matk + weapon.weaponDamage.max };
      const perHit = rangeOf((b) => ignoreDefenseDamage(params.p1, params.p2, params.p3, b, atk), pB);
      return { ...base, ...gate, variants: [{ label: "無視防禦", chance: null, perHit }] };
    }
    case 7:
      return { ...base, ...gate, hits: Math.max(1, params.p3),
        variants: [{ label: `每段 ${params.p1 / 100} 倍`, chance: null, perHit: scaled(params.p1 / 100) }] };
    case 8: {
      const chance = Math.min(100, Math.max(0, params.p4));
      return { ...base, ...gate, variants: [
        { label: `觸發 ${params.p1 / 100} 倍`, chance, perHit: scaled(params.p1 / 100) },
        { label: `未觸發 ${params.p2 / 100} 倍`, chance: 100 - chance, perHit: scaled(params.p2 / 100) },
      ] };
    }
    default:
      return { ...base, ...gate,
        variants: [{ label: `${params.p1 / 100} 倍`, chance: null, perHit: scaled(params.p1 / 100) }] };
  }
}

export function computeDamage(input: {
  character: CharacterV1;
  data: GameData;
  panel: PanelResult;
  monster: DamageMonster;
  skills: DamageSkillDef[];
  /** 玩家調整過的技能等級；沒調的用 defaultSkillLevel。 */
  skillLevels?: Record<number, number>;
}): DamageResult {
  const { character, data, panel, monster, skills, skillLevels = {} } = input;
  const weapon = resolveWeapon(character, data, panel);
  const k = monsterK(monster.level);
  const defense = weapon.rule?.defense === "magicDef" ? monster.magicDef : monster.extraDef;
  const caveats: string[] = [];
  if (monster.level > VERIFIED_MAX_MONSTER_LEVEL) {
    caveats.push(`怪物等級超過實測範圍（Lv${VERIFIED_MAX_MONSTER_LEVEL}），結果可能有誤差`);
  }
  if (defense > VERIFIED_MAX_MONSTER_DEF) {
    caveats.push("怪物防禦超過實測範圍（約 300），結果可能有誤差");
  }
  if (weapon.rule && panel.stats[weapon.rule.attack].estimated) {
    caveats.push(`面板${statLabel(weapon.rule.attack)}是估計值`);
  }
  let normal: DamageRange | null = null;
  let critical: DamageRange | null = null;
  if (weapon.support !== "unsupported" && weapon.weaponDamage && weapon.attack != null) {
    const B = { min: weapon.attack + weapon.weaponDamage.min, max: weapon.attack + weapon.weaponDamage.max };
    normal = rangeOf((b) => hitDamage(1, b, k, defense), B);
    critical = rangeOf((b) => hitDamage(2, b, k, defense), B);
  }
  const results = skillsForCharacter(character, skills).map((skill) =>
    computeSkill(skill, skillLevels[skill.id] ?? defaultSkillLevel(skill, character), weapon, panel, k, defense,
      weaponRequirement(skill, character, data)));
  results.sort((a, b) => SUPPORT_RANK[a.support] - SUPPORT_RANK[b.support] || a.skill.id - b.skill.id);
  return { weapon, monster, k, defense, caveats, normal, critical, skills: results };
}

const mid = (range: DamageRange) => (range.min + range.max) / 2;

/** 每次施放的期望總傷害（含段數）；機率觸發類照 chance 加權。算不出來為 null。 */
export function expectedPerCast(skill: SkillDamage): number | null {
  if (skill.variants.length === 0) return null;
  const perHit = skill.variants.length > 1
    ? skill.variants.reduce((sum, v) => sum + (mid(v.perHit) * (v.chance ?? 0)) / 100, 0)
    : mid(skill.variants[0].perHit);
  return perHit * skill.hits;
}

/** 每次施放的最差～最好（含段數）。 */
export function castRange(skill: SkillDamage): DamageRange | null {
  if (skill.variants.length === 0) return null;
  return {
    min: Math.min(...skill.variants.map((v) => v.perHit.min)) * skill.hits,
    max: Math.max(...skill.variants.map((v) => v.perHit.max)) * skill.hits,
  };
}

/**
 * 同一系列（落英繽紛 → 落英飛瓣 → 落英紛飛）只留學得到的最高階當主列；
 * 被已學進階取代的低階、目前還學不到的招，放進 lower。
 */
export function groupFamilies(skills: SkillDamage[]): { top: SkillDamage[]; lower: SkillDamage[] } {
  const superseded = new Set(
    skills.filter((s) => s.level >= 1 && s.skill.upgradesFrom != null).map((s) => s.skill.upgradesFrom!),
  );
  const isTop = (s: SkillDamage) => s.level >= 1 && !superseded.has(s.skill.id);
  return { top: skills.filter(isTop), lower: skills.filter((s) => !isTop(s)) };
}

export type NormalMode = "normal" | "critical";
/** 連段：key 為 "normal" 或技能 id，值為一輪裡的次數。 */
export type ComboCounts = Record<string, number>;

export interface ComboLine {
  key: string;
  count: number;
  /** 最差～最好（普攻的最好是全重擊）。 */
  range: DamageRange;
  expected: number;
  mp: number;
}

export interface ComboResult {
  lines: ComboLine[];
  total: DamageRange & { expected: number };
  mp: number;
  hp: number;
  /** 一輪打掉幾成，最多 1。 */
  progress: number;
  remaining: number;
  /** 打完要幾輪（期望值）；一輪期望是 0 時為 null。 */
  rounds: number | null;
}

/** 一輪連段的總傷害；只算得出數字的招會計入，尚未支援的略過。 */
export function computeCombo(result: DamageResult, counts: ComboCounts, normalMode: NormalMode): ComboResult {
  const lines: ComboLine[] = [];
  for (const [key, count] of Object.entries(counts)) {
    if (!(count > 0)) continue;
    if (key === "normal") {
      if (!result.normal || !result.critical) continue;
      const per = normalMode === "critical" ? result.critical : result.normal;
      lines.push({ key, count, mp: 0, expected: mid(per) * count,
        range: { min: result.normal.min * count, max: result.critical.max * count } });
      continue;
    }
    const skill = result.skills.find((s) => String(s.skill.id) === key);
    const expected = skill ? expectedPerCast(skill) : null;
    const range = skill ? castRange(skill) : null;
    if (!skill || expected == null || !range) continue;
    lines.push({ key, count, mp: skill.mp * count, expected: expected * count,
      range: { min: range.min * count, max: range.max * count } });
  }
  const sum = (f: (line: ComboLine) => number) => lines.reduce((acc, line) => acc + f(line), 0);
  const expected = sum((l) => l.expected);
  const hp = result.monster.hp;
  return {
    lines,
    total: { min: sum((l) => l.range.min), max: sum((l) => l.range.max), expected },
    mp: sum((l) => l.mp),
    hp,
    progress: hp > 0 ? Math.min(1, expected / hp) : 0,
    remaining: Math.max(0, hp - expected),
    rounds: expected > 0 ? hp / expected : null,
  };
}

export interface MarginalRow {
  key: AttributeKey;
  /** 再加 1 點要花的點數。 */
  nextCost: number;
  /** 一輪連段的期望傷害多幾點；連段是空的或算不出來為 null。 */
  combo: number | null;
  /** 普攻（依 normalMode）每下多幾點。 */
  normal: number | null;
}

/** 六圍各 +1 後重算面板、傷害與連段，跟原本相減。 */
export function computeMarginal(
  input: Parameters<typeof computeDamage>[0],
  counts: ComboCounts = {},
  normalMode: NormalMode = "normal",
): MarginalRow[] {
  const before = computeDamage(input);
  const beforeCombo = computeCombo(before, counts, normalMode);
  const normalOf = (r: DamageResult) => {
    const range = normalMode === "critical" ? r.critical : r.normal;
    return range ? mid(range) : null;
  };
  return ATTRIBUTE_KEYS.map((key) => {
    const character = {
      ...input.character,
      attributes: { ...input.character.attributes, [key]: input.character.attributes[key] + 1 },
    };
    let after: DamageResult | null = null;
    try {
      after = computeDamage({ ...input, character, panel: computePanel(character, input.data) });
    } catch {
      // 等級、六圍不合法時面板算不出來，這一列顯示「—」。
    }
    const beforeNormal = normalOf(before);
    const afterNormal = after ? normalOf(after) : null;
    return {
      key,
      nextCost: input.panel.points.nextCost[key],
      combo: after && beforeCombo.lines.length > 0
        ? computeCombo(after, counts, normalMode).total.expected - beforeCombo.total.expected
        : null,
      normal: beforeNormal == null || afterNormal == null ? null : afterNormal - beforeNormal,
    };
  });
}
