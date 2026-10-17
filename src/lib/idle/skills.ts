import { IDLE_EXCLUDED_SKILL_TYPES, IDLE_SKILL_FUNC_DMG } from "@/configs/idle";
import { expectedDamage, makeTarget, type Target } from "@/lib/combat/damage";
import { weaponRequirement } from "@/lib/stat-sim-damage";
import type { DamageSkillDef } from "@/lib/types/stat-sim";
import type { Combatant } from "./character";
import type { IdleMonster, IdleData, IdleSkill, IdleSkillLevel } from "./types";

export interface SkillOption {
  skillId: number;
  name: string;
  /** 目前等級可學的最高級。 */
  level: number;
  castTicks: number;
  hits: number;
  /** 一次施放對本地圖怪物（依出現比例加權）的期望傷害，含 miss 與多段。 */
  expected: number;
}

export interface SkillChoice {
  options: SkillOption[];
  /** 期望傷害最高的技能；沒有可選技能（Lv < 9，沒有任何門派技能可學）為 null。 */
  defaultSkillId: number | null;
}

/** 實際施放的技能：null = 普攻。 */
export interface ActiveSkill {
  skillId: number;
  level: number;
  data: IdleSkillLevel;
}

/** monsters 的 extra_def / magic_def 是 REAL 欄位，damage.ts 的整數運算要整數。 */
export function monsterTarget(monster: IdleMonster): Target {
  return makeTarget({
    level: monster.level,
    extraDef: Math.trunc(monster.extraDef),
    magicDef: Math.trunc(monster.magicDef),
    baseDodge: monster.baseDodge,
  });
}

function skillDef(skill: IdleSkill, level: IdleSkillLevel): DamageSkillDef {
  return {
    id: skill.id,
    name: skill.name,
    clan: null,
    skillType: skill.skillType,
    funcDmg: level.funcDmg,
    iconUrl: null,
    levels: [],
  };
}

function learnableLevel(skill: IdleSkill, charLevel: number): IdleSkillLevel | null {
  let best: IdleSkillLevel | null = null;
  for (const row of skill.levels) {
    if (row.learnLevel >= 0 && row.learnLevel <= charLevel) best = row;
  }
  return best;
}

/** 該等級（含武器）的可選技能，與 options 一一對應的 IdleSkillLevel。 */
function eligible(data: IdleData, level: number, combatant: Combatant): { option: SkillOption; row: IdleSkillLevel }[] {
  const weights = new Map<number, number>();
  for (const spawn of data.spawns) weights.set(spawn.monsterId, (weights.get(spawn.monsterId) ?? 0) + spawn.weight);
  const totalWeight = [...weights.values()].reduce((sum, w) => sum + w, 0);
  const targets = [...weights].map(([id, weight]) => ({ target: monsterTarget(data.monsters[id]), weight }));
  const out: { option: SkillOption; row: IdleSkillLevel }[] = [];
  for (const skill of data.skills) {
    if (skill.skillType != null && IDLE_EXCLUDED_SKILL_TYPES.includes(skill.skillType)) continue;
    const row = learnableLevel(skill, level);
    if (!row || !IDLE_SKILL_FUNC_DMG.includes(row.funcDmg) || row.hitTicks.length === 0) continue;
    if (weaponRequirement(skillDef(skill, row), combatant.character, combatant.gameData) !== null) continue;
    const expected =
      targets.reduce((sum, { target, weight }) => sum + expectedDamage(combatant.attacker, target, row) * weight, 0) /
      Math.max(1, totalWeight);
    out.push({
      option: {
        skillId: skill.id,
        name: skill.name,
        level: row.level,
        castTicks: row.castTicks,
        hits: row.hitTicks.length,
        expected,
      },
      row,
    });
  }
  return out;
}

/**
 * v1 技能選擇規則：該門派技能中 magic_learn.char_level ≤ 等級、武器符合（requiredWeapon / weaponRequirement）、
 * 有演出資料的招；等級取可學的最高級。預設 = 期望傷害最高（expectedDamage，單次施放、不除以施放時間，照規格）。
 */
export function skillOptions(data: IdleData, level: number, combatant: Combatant): SkillChoice {
  const options = eligible(data, level, combatant).map((e) => e.option);
  let best: SkillOption | null = null;
  for (const option of options) if (!best || option.expected > best.expected) best = option;
  return { options, defaultSkillId: best ? best.skillId : null };
}

/** 引擎實際使用的技能：玩家指定的（不在可選範圍就退回預設）；沒有可選技能回傳 null（普攻）。 */
export function activeSkill(
  data: IdleData,
  level: number,
  combatant: Combatant,
  requestedSkillId: number | null,
): ActiveSkill | null {
  const list = eligible(data, level, combatant);
  let pick = requestedSkillId == null ? undefined : list.find((e) => e.option.skillId === requestedSkillId);
  if (!pick) {
    for (const e of list) if (!pick || e.option.expected > pick.option.expected) pick = e;
  }
  return pick ? { skillId: pick.option.skillId, level: pick.row.level, data: pick.row } : null;
}

export interface LockedSkill {
  skillId: number;
  name: string;
  /** 最低可學等級。 */
  learnLevel: number;
}

/**
 * 目前等級還不能用、但之後會解鎖的招（只列武器符合、有演出資料的）。給畫面灰顯「LvN 可學」，不影響引擎選招。
 */
export function lockedSkills(data: IdleData, level: number, combatant: Combatant): LockedSkill[] {
  const out: LockedSkill[] = [];
  for (const skill of data.skills) {
    if (skill.skillType != null && IDLE_EXCLUDED_SKILL_TYPES.includes(skill.skillType)) continue;
    if (learnableLevel(skill, level)) continue;
    let first: IdleSkillLevel | null = null;
    for (const row of skill.levels) {
      if (row.learnLevel > level && (!first || row.learnLevel < first.learnLevel)) first = row;
    }
    if (!first || !IDLE_SKILL_FUNC_DMG.includes(first.funcDmg) || first.hitTicks.length === 0) continue;
    if (weaponRequirement(skillDef(skill, first), combatant.character, combatant.gameData) !== null) continue;
    out.push({ skillId: skill.id, name: skill.name, learnLevel: first.learnLevel });
  }
  return out.sort((a, b) => a.learnLevel - b.learnLevel || a.skillId - b.skillId);
}
