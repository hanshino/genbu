import { NOVICE_PANEL_SECT_ID, NOVICE_PRESET_IDS, NOVICE_SECT_ID } from "@/configs/idle";
import { SECTS } from "@/configs/stat-sim";
import { attackSpeedLevel, swingHitTick, swingTicks } from "@/lib/attack-speed";
import type { Attacker } from "@/lib/combat/damage";
import { computePanel } from "@/lib/stat-sim";
import { resolveWeapon, type WeaponProfile } from "@/lib/stat-sim-damage";
import {
  EQUIP_SLOTS,
  type Attributes,
  type CharacterV1,
  type EquipSlot,
  type EquippedItem,
  type GameData,
  type PanelResult,
  type SectId,
} from "@/lib/types/stat-sim";
import type { IdleData, IdleSectId } from "./types";

/** 存檔裡只有門派、等級與六圍會影響角色面板。 */
export interface IdleCharacterInput {
  sectId: IdleSectId;
  level: number;
  attributes: Attributes;
}

/** 普通攻擊：攻速等級（1..14）與一次揮擊的 ticks / 命中時刻（見 src/lib/attack-speed.ts）。 */
export interface NormalAttack {
  level: number;
  /** 揮擊週期；普攻沒有施放後間隔，這就是兩次揮擊的間隔。 */
  castTicks: number;
  hitTick: number;
}

export interface Combatant {
  character: CharacterV1;
  gameData: GameData;
  panel: PanelResult;
  weapon: WeaponProfile;
  attacker: Attacker;
  normalAttack: NormalAttack;
}

/**
 * 普攻攻速：門派欄位用存檔的門派（入門弟子 1 有自己的一欄，不借移花宮），
 * 身法取面板值，武器取右手武器的類型與 attack_speed 加成。
 */
export function normalAttackFor(
  input: IdleCharacterInput,
  panel: PanelResult,
  data: IdleData,
): NormalAttack {
  const level = attackSpeedLevel(
    data.weapon?.typeName ?? null,
    input.sectId,
    panel.attributes.agi.value ?? 0,
    data.weapon?.stats.attack_speed ?? 0,
  );
  const castTicks = swingTicks(level);
  return { level, castTicks, hitTick: swingHitTick(castTicks) };
}

/** computePanel 用的門派：入門弟子借用移花宮的面板公式（見 NOVICE_PANEL_SECT_ID）。 */
export function panelSectId(sectId: IdleSectId): SectId {
  return sectId === NOVICE_SECT_ID ? NOVICE_PANEL_SECT_ID : sectId;
}

// 武器是靜態資料，同一份 IdleData 只組一次 GameData。
const gameDataCache = new WeakMap<IdleData, GameData>();

/** computePanel / resolveWeapon 要的 GameData：只有預設角色的武器。 */
export function gameDataFor(data: IdleData): GameData {
  let gameData = gameDataCache.get(data);
  if (!gameData) {
    gameData = {
      itemsById: data.weapon ? { [data.weapon.id]: data.weapon } : {},
      enhancementsByPath: {},
      passives: [],
      meridianIds: [],
    };
    gameDataCache.set(data, gameData);
  }
  return gameData;
}

/** 預設角色：沒有轉生、副門派、被動、經脈；右手拿預設武器（空手為 null），其餘欄位空。 */
export function buildCharacter(input: IdleCharacterInput, data: IdleData): CharacterV1 {
  const equipment = Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, null])) as Record<
    EquipSlot,
    EquippedItem | null
  >;
  if (data.weapon) {
    equipment.right = { itemId: data.weapon.id, enhancementLevel: 0, manualBonuses: {} };
  }
  return {
    version: 1,
    id: `idle-${data.presetId}`,
    name: "放置角色",
    sectId: panelSectId(input.sectId),
    subSects: [],
    level: input.level,
    rebirthPoints: 0,
    attributes: { ...input.attributes },
    equipment,
    passiveLevels: {},
    meridianPlan: null,
    manual: { hero: {}, formation: {} },
  };
}

/**
 * 不能玩的預設角色原因（給 POST /api/idle/start 擋掉）；可以玩回傳 null。
 * computePanel 只支援 SECTS 內的主門派，resolveWeapon 不支援的武器（弓、拳刃、杖…）算不出攻擊。
 */
export function presetProblem(data: IdleData): string | null {
  if (!SECTS[panelSectId(data.sectId)]) return "這個門派目前還不支援放置玩法。";
  // 入門弟子一律拿新手用青銅刀，只開放外觀也拿刀的兩個預設角色。
  if (data.sectId === NOVICE_SECT_ID && !Object.values(NOVICE_PRESET_IDS).includes(data.presetId as 102 | 103)) {
    return "入門弟子請從建立角色開始。";
  }
  const input: IdleCharacterInput = {
    sectId: data.sectId,
    level: 1,
    attributes: { str: 1, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 },
  };
  const character = buildCharacter(input, data);
  const gameData = gameDataFor(data);
  const weapon = resolveWeapon(character, gameData, computePanel(character, gameData));
  if (weapon.support === "unsupported" || weapon.attack == null || !weapon.weaponDamage) {
    return "這個角色的武器目前還不支援放置玩法。";
  }
  return null;
}

/**
 * 面板 → damage.ts 的 Attacker。武器沿用 stat-sim-damage 的 resolveWeapon：
 * 它依武器規則決定吃 damage 還是 pdamage（拳套 pdamage、其餘 damage）與面板攻擊值（atk / matk），
 * 這裡只把結果放回 Attacker 對應的欄位；空手兩個區間都是 0。
 */
export function buildCombatant(input: IdleCharacterInput, data: IdleData): Combatant {
  const character = buildCharacter(input, data);
  const gameData = gameDataFor(data);
  const panel = computePanel(character, gameData);
  const weapon = resolveWeapon(character, gameData, panel);
  if (weapon.support === "unsupported" || weapon.rule == null || weapon.attack == null || !weapon.weaponDamage) {
    throw new RangeError(`預設角色 ${data.presetId} 的武器不支援放置玩法`);
  }
  const { rule, weaponDamage } = weapon;
  const inner = rule.damageField === "pdamage";
  const stat = (key: keyof PanelResult["stats"]) => panel.stats[key].value ?? 0;
  const attacker: Attacker = {
    level: character.level,
    // 面板的 atk / matk 都帶入；damage.ts 依技能或武器自己挑要用哪一個。
    atk: stat("atk"),
    matk: stat("matk"),
    hit: stat("hit"),
    crit: stat("critical"),
    weaponMin: inner ? 0 : weaponDamage.min,
    weaponMax: inner ? 0 : weaponDamage.max,
    weaponType: weapon.typeName ?? "",
    pweaponMin: inner ? weaponDamage.min : 0,
    pweaponMax: inner ? weaponDamage.max : 0,
    wis: panel.attributes.wis.value ?? 0,
    str: panel.attributes.str.value ?? 0,
    int: panel.attributes.pow.value ?? 0,
    agi: panel.attributes.agi.value ?? 0,
    // 放置玩法沒有暗器
    ammo: 0,
  };
  return {
    character,
    gameData,
    panel,
    weapon,
    attacker,
    normalAttack: normalAttackFor(input, panel, data),
  };
}
