import { describe, expect, it } from "vitest";
import { computePanel } from "@/lib/stat-sim";
import {
  castSeconds, computeCombo, computeDamage, DEFAULT_TIMING, perSecond, computeMarginal, defaultSkillLevel, expectedPerCast, groupFamilies, hitDamage,
  ignoreDefenseDamage, isPlayerSkill, requiredWeapon, skillsForCharacter,
} from "@/lib/stat-sim-damage";
import {
  EQUIP_SLOTS,
  type CharacterV1, type DamageMonster, type DamageSkillDef, type GameData, type SimItem,
} from "@/lib/types/stat-sim";

// 數值全部來自 tthol_data scripts/damage_capture_investigation.md 的封包實測。

function character(overrides: Partial<CharacterV1> = {}): CharacterV1 {
  return {
    version: 1, id: "test", name: "測試角色", sectId: 2, subSects: [], level: 192,
    rebirthPoints: 140, attributes: { str: 1, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 },
    equipment: Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, null])) as CharacterV1["equipment"],
    passiveLevels: {}, meridianPlan: null, manual: { hero: {}, formation: {} }, ...overrides,
  };
}

/** 六圍全 1 時面板物攻、內勁都是 3，用「其他手動加值」補到實測面板值。 */
function withPanel(c: CharacterV1, atk: number, matk: number): CharacterV1 {
  return { ...c, manual: { ...c.manual, other: { atk: atk - 3, matk: matk - 3 } } };
}

function weapon(id: number, typeName: string, extra: Partial<SimItem> = {}): SimItem {
  return { id, name: `武器 ${id}`, typeName, level: 1, slotHint: null, stats: {}, strongPathId: null, ...extra };
}

const data: GameData = {
  itemsById: {
    55001: weapon(55001, "SWORD", { name: "龍躍鳳鳴劍", damage: [945, 970] }),
    55004: weapon(55004, "PUNCHER", { name: "龍躍鳳鳴手套", pdamage: [1096, 1114] }),
    55002: weapon(55002, "STING", { damage: [860, 878] }),
    55003: weapon(55003, "BLADE", { damage: [900, 920] }),
    55005: weapon(55005, "WHISK", { damage: [800, 820], pdamage: [1000, 1025] }),
    55006: weapon(55006, "BOW", { damage: [993, 1019] }),
    9: weapon(9, "SHIELD"),
  },
  enhancementsByPath: {}, passives: [], meridianIds: [],
};

function equip(c: CharacterV1, right: number | null, left: number | null = null): CharacterV1 {
  const slot = (id: number | null) => (id == null ? null : { itemId: id, enhancementLevel: 0, manualBonuses: {} });
  return { ...c, equipment: { ...c.equipment, right: slot(right), left: slot(left) } };
}

const monster = (level: number, extraDef: number, magicDef = extraDef): DamageMonster =>
  ({ id: level * 1000 + extraDef, name: `Lv${level} 怪`, level, hp: 1_000_000, extraDef, magicDef });

function skill(
  id: number, funcDmg: number, skillType: number, p: [number, number, number, number], clan = "CLASS_BAD",
  upgradesFrom?: number,
  interval = 400,
): DamageSkillDef {
  return {
    id, name: `技能 ${id}`, clan, skillType, funcDmg, iconUrl: null, upgradesFrom,
    levels: [null, ...Array.from({ length: 19 }, () =>
      ({ p1: 100, p2: 0, p3: 0, p4: 0, mp: 30, learnLevel: 100, interval })),
    { p1: p[0], p2: p[1], p3: p[2], p4: p[3], mp: 45, learnLevel: 150, interval }],
  };
}

const 千瘡百孔 = skill(702, 4, 2, [1650, 0, 0, 0]);
const 毒舌亂神 = skill(703, 6, 2, [1300, 450, 150, 0]);
const 血殺屠刀 = skill(705, 3, 1, [3000, 200, 0, 0]);
const 裂空劍法 = skill(715, 3, 3, [1950, 200, 0, 0], "CLASS_FLOWER");
const 落英紛飛 = skill(714, 7, 3, [430, 0, 8, 100], "CLASS_FLOWER");
const 醉月劍法 = skill(716, 8, 3, [2700, 1100, 230, 70], "CLASS_FLOWER");
const 蓮蒼掌 = skill(709, 4, 4, [1500, 0, 0, 0], "CLASS_FLOWER");
const 未知類型 = skill(9001, 17, 3, [1500, 0, 0, 0], "CLASS_FLOWER");
const SKILLS = [千瘡百孔, 毒舌亂神, 血殺屠刀, 裂空劍法, 落英紛飛, 醉月劍法, 蓮蒼掌, 未知類型];

function run(c: CharacterV1, target: DamageMonster, skillLevels?: Record<number, number>) {
  return computeDamage({ character: c, data, panel: computePanel(c, data), monster: target, skills: SKILLS, skillLevels });
}

describe("主公式 ⌊m·B·K/(K+D)⌋ − ⌊D/2⌋", () => {
  it("空手物攻 155 打吹箭客（Lv37，防 29）：普攻 134、重擊 283，沒有亂數", () => {
    const result = run(withPanel(character(), 155, 1212), monster(37, 29));
    expect(result.weapon.label).toBe("空手");
    expect(result.k).toBe(685);
    expect(result.normal).toEqual({ min: 134, max: 134 });
    expect(result.critical).toEqual({ min: 283, max: 283 });
  });

  it("拳套內勁 1616 + pdamage 1096..1114 打墮落劍客（Lv91，139）：2298..2314，跟實測區間一樣", () => {
    const result = run(equip(withPanel(character(), 275, 1616), 55004), monster(91, 139));
    expect(result.normal).toEqual({ min: 2298, max: 2314 });
  });

  it("幽靈女俠（Lv94，146）：2284..2299，跟實測區間一樣", () => {
    const result = run(equip(withPanel(character(), 275, 1616), 55004), monster(94, 146));
    expect(result.normal).toEqual({ min: 2284, max: 2299 });
  });

  it("拳套打 magic_def：搗藥君 extra_def 96 / magic_def 126，平均落在實測 2339 附近", () => {
    const result = run(equip(withPanel(character(), 275, 1616), 55004), monster(90, 96, 126));
    expect(result.defense).toBe(126);
    expect(result.normal).toEqual({ min: 2331, max: 2347 });
  });

  it("重擊是乘法部分加倍、D/2 只扣一次，不是普攻 × 2", () => {
    expect(hitDamage(2, 155, 685, 29)).toBe(283);
    expect(hitDamage(1, 155, 685, 29) * 2).toBe(268);
  });
});

describe("技能", () => {
  const puncher = equip(withPanel(character(), 275, 1616), 55004);

  it("千瘡百孔（func_dmg 4，16.5 倍）打血玫瑰（Lv86，127）：實測 39322..39554 落在預測區間內", () => {
    const row = run(puncher, monster(86, 127)).skills.find((s) => s.skill.id === 702)!;
    expect(row.support).toBe("verified");
    const { min, max } = row.variants[0].perHit;
    expect(min).toBeLessThanOrEqual(39322);
    expect(max).toBeGreaterThanOrEqual(39554);
  });

  it("毒舌亂神（func_dmg 6）四個實測點全部精確，跟怪的防禦無關", () => {
    expect(ignoreDefenseDamage(1300, 450, 150, 1212, 155)).toBe(16438);
    expect(ignoreDefenseDamage(1300, 450, 150, 1298, 155)).toBe(17556);
    const unarmed = run(withPanel(character(), 155, 1212), monster(37, 29)).skills.find((s) => s.skill.id === 703)!;
    expect(unarmed.variants[0].perHit).toEqual({ min: 16438, max: 16438 });
    for (const target of [monster(86, 127), monster(37, 29)]) {
      const row = run(puncher, target).skills.find((s) => s.skill.id === 703)!;
      expect(row.variants[0].perHit).toEqual({ min: 36118, max: 36352 });
    }
  });

  const sword = equip(withPanel(character({ sectId: 4 }), 2332, 100), 55001);

  it("落英紛飛（func_dmg 7）：段數 = p3，每段各扣 ⌊D/2⌋", () => {
    const row = run(sword, monster(71, 94)).skills.find((s) => s.skill.id === 714)!;
    expect(row.hits).toBe(8);
    expect(row.variants[0].perHit.min).toBe(hitDamage(4.3, 2332 + 945, 855, 94));
  });

  it("醉月劍法（func_dmg 8）：p4% 機率用 p1，否則用 p2，兩種都列出", () => {
    const row = run(sword, monster(71, 94)).skills.find((s) => s.skill.id === 716)!;
    expect(row.variants.map((v) => v.chance)).toEqual([70, 30]);
    expect(row.variants[0].perHit.min).toBe(hitDamage(27, 3277, 855, 94));
    expect(row.variants[1].perHit.min).toBe(hitDamage(11, 3277, 855, 94));
  });

  it("裂空劍法（func_dmg 3）跟 func_dmg 4 一樣是單段 p1 倍", () => {
    const row = run(sword, monster(71, 94)).skills.find((s) => s.skill.id === 715)!;
    expect(row.support).toBe("verified");
    expect(row.variants[0].perHit.min).toBe(hitDamage(19.5, 3277, 855, 94));
  });

  it("掌法類與未實測的 func_dmg 標尚未支援", () => {
    const skills = run(sword, monster(71, 94)).skills;
    expect(skills.find((s) => s.skill.id === 709)!.support).toBe("unsupported");
    expect(skills.find((s) => s.skill.id === 9001)!.reasons[0]).toContain("func_dmg 17");
    // 尚未支援的排在後面
    expect(skills.at(-1)!.support).toBe("unsupported");
  });

  it("只列主門派與已選副門派的技能", () => {
    expect(skillsForCharacter(character({ sectId: 4 }), SKILLS).map((s) => s.id)).toEqual([715, 714, 716, 709, 9001]);
    expect(skillsForCharacter(character({ sectId: 2 }), SKILLS).map((s) => s.id)).toEqual([702, 703, 705]);
  });
});

describe("武器分級", () => {
  const base = withPanel(character({ sectId: 4 }), 2000, 1000);

  it("盾不算武器：劍 + 盾照劍算", () => {
    expect(run(equip(base, 55001, 9), monster(50, 50)).weapon.support).toBe("verified");
  });

  it("匕首照劍推定", () => {
    const result = run(equip(base, 55002), monster(50, 50));
    expect(result.weapon.support).toBe("presumed");
    expect(result.normal).toEqual({
      min: hitDamage(1, 2860, 750, 50), max: hitDamage(1, 2878, 750, 50),
    });
    // 劍法要右手拿劍，匕首放不出來。
    expect(result.skills.find((s) => s.skill.id === 715)!.wrongWeapon).toBe("「劍法」要右手拿劍才能使用");
  });

  it("拂塵、手甲、雙持都尚未支援，不算出數字", () => {
    for (const c of [equip(base, 55005), equip(base, 55006), equip(base, 55001, 55002)]) {
      const result = run(c, monster(50, 50));
      expect(result.weapon.support).toBe("unsupported");
      expect(result.normal).toBeNull();
      expect(result.skills.every((s) => s.support === "unsupported")).toBe(true);
    }
  });

  it("無視防禦技能拿劍時尚未支援", () => {
    const c = equip(withPanel(character({ sectId: 2 }), 2000, 1000), 55001);
    expect(run(c, monster(50, 50)).skills.find((s) => s.skill.id === 703)!.support).toBe("unsupported");
  });
});

describe("技能類型要配對的武器", () => {
  const bad = withPanel(character({ sectId: 2 }), 2000, 1616);

  it("惡人谷拿手套：刀法放不出來，不算數字；詐招照算", () => {
    const skills = run(equip(bad, 55004), monster(86, 127)).skills;
    const blade = skills.find((s) => s.skill.id === 705)!;
    expect(blade.wrongWeapon).toBe("「刀法」要右手拿刀才能使用");
    expect(blade.support).toBe("unsupported");
    expect(blade.variants).toEqual([]);
    expect(skills.find((s) => s.skill.id === 702)!.support).toBe("verified");
  });

  it("惡人谷拿刀：刀法照物攻推定；詐招拿刀只能推定", () => {
    const skills = run(equip(bad, 55003), monster(86, 127)).skills;
    const blade = skills.find((s) => s.skill.id === 705)!;
    expect(blade.wrongWeapon).toBeUndefined();
    expect(blade.support).toBe("presumed");
    expect(blade.variants[0].perHit.min).toBe(hitDamage(30, 2900, 930, 127));
    expect(skills.find((s) => s.skill.id === 702)!.reasons).toContain("詐招只實測過拳套與空手");
  });

  it("只看右手：刀拿在左手也放不出刀法；掌法空手可以、拿劍不行", () => {
    expect(run(equip(bad, null, 55003), monster(50, 50)).skills.find((s) => s.skill.id === 705)!.wrongWeapon)
      .toBeDefined();
    const flower = withPanel(character({ sectId: 4 }), 2000, 1000);
    expect(run(flower, monster(50, 50)).skills.find((s) => s.skill.id === 709)!.wrongWeapon).toBeUndefined();
    expect(run(equip(flower, 55001), monster(50, 50)).skills.find((s) => s.skill.id === 709)!.wrongWeapon)
      .toBe("「掌法」要空手或右手拿手套才能使用");
  });
});

describe("沒有門派的招", () => {
  const 五虎斷魂刀 = { ...skill(508, 3, 1, [680, 0, 0, 0], ""), clan: null };

  it("只有匯入時學過才列，等級用學到的", () => {
    const c = equip(withPanel(character({ sectId: 2 }), 2000, 1000), 55003);
    const target = monster(50, 50);
    const list = (ch: CharacterV1) => computeDamage({
      character: ch, data, panel: computePanel(ch, data), monster: target, skills: [...SKILLS, 五虎斷魂刀],
    }).skills.find((s) => s.skill.id === 508);
    expect(list(c)).toBeUndefined();
    const row = list({ ...c, learnedSkills: { 508: 7 } })!;
    expect(row.level).toBe(7);
    expect(row.variants).toHaveLength(1);
    expect(defaultSkillLevel(五虎斷魂刀, { ...c, learnedSkills: { 508: 99 } })).toBe(20);
  });
});

describe("每秒輸出", () => {
  const 千瘡 = skill(702, 4, 2, [1650, 0, 0, 0], "CLASS_BAD", undefined, 200);
  const 沒間隔 = skill(704, 4, 2, [1650, 0, 0, 0], "CLASS_BAD", undefined, 0);
  const c = equip(withPanel(character({ sectId: 2 }), 275, 1616), 55004);
  const result = computeDamage({
    character: c, data, panel: computePanel(c, data), monster: monster(86, 127), skills: [千瘡, 毒舌亂神, 沒間隔],
  });
  const row = (id: number) => result.skills.find((s) => s.skill.id === id)!;

  it("間隔 0.2 秒的招每秒輸出是每次傷害 × 5；多等的延遲加在每次出手上", () => {
    expect(castSeconds(row(702), DEFAULT_TIMING)).toBe(0.2);
    expect(perSecond(row(702), DEFAULT_TIMING)).toBeCloseTo(expectedPerCast(row(702))! * 5);
    expect(castSeconds(row(702), { normalInterval: 700, extraDelay: 50 })).toBe(0.25);
  });

  it("資料沒有間隔的招算不出每秒輸出，不當成 0 秒", () => {
    expect(castSeconds(row(704), DEFAULT_TIMING)).toBeNull();
    expect(perSecond(row(704), DEFAULT_TIMING)).toBeNull();
    expect(computeCombo(result, { 704: 1, 702: 1 }, "normal").perSecond).toBeNull();
  });

  it("循環：秒數照各招間隔加總，算出每秒輸出、打完秒數與每秒真氣", () => {
    const combo = computeCombo(result, { 703: 5, 702: 10, normal: 2 }, "normal");
    expect(combo.seconds).toBeCloseTo(5 * 0.4 + 10 * 0.2 + 2 * 0.7);
    expect(combo.perSecond).toBeCloseTo(combo.total.expected / combo.seconds!);
    expect(combo.killSeconds).toBeCloseTo(1_000_000 / combo.perSecond!);
    expect(combo.mpPerSecond).toBeCloseTo((5 * 45 + 10 * 45) / combo.seconds!);
  });
});

describe("自選招式", () => {
  const bad = equip(withPanel(character({ sectId: 2 }), 2000, 1616), 55004);
  const pickRun = (pickedSkills: number[]) => computeDamage({
    character: bad, data, panel: computePanel(bad, data), monster: monster(50, 50), skills: SKILLS, pickedSkills,
  }).skills;

  it("別派的招加進來照規則分區並標記；已自動列出的不重複、不標記", () => {
    const skills = pickRun([715, 702, 99999]);
    const sword = skills.find((s) => s.skill.id === 715)!;
    expect(sword.picked).toBe(true);
    expect(sword.wrongWeapon).toBe("「劍法」要右手拿劍才能使用");
    expect(skills.filter((s) => s.skill.id === 702)).toHaveLength(1);
    expect(skills.find((s) => s.skill.id === 702)!.picked).toBeUndefined();
    expect(skills.some((s) => s.skill.id === 99999)).toBe(false);
  });

  it("要換的武器短名稱；寵物、道具招沒有學習等級，不給搜尋", () => {
    expect(requiredWeapon(血殺屠刀)).toBe("刀");
    expect(requiredWeapon(蓮蒼掌)).toBe("空手或手套");
    expect(requiredWeapon(千瘡百孔)).toBeNull();
    expect(isPlayerSkill(血殺屠刀)).toBe(true);
    const pet = { ...血殺屠刀, levels: 血殺屠刀.levels.map((l) => l && { ...l, learnLevel: -1 }) };
    expect(isPlayerSkill(pet)).toBe(false);
  });
});

describe("提醒與預設", () => {
  it("怪物 Lv > 101 或防禦 > 310 時註記", () => {
    const sword = equip(withPanel(character({ sectId: 4 }), 2000, 1000), 55001);
    expect(run(sword, monster(90, 200)).caveats).toEqual([]);
    expect(run(sword, monster(195, 1133)).caveats).toHaveLength(2);
  });

  it("技能等級：有轉生取最高級，沒轉生取學得到的最高級", () => {
    expect(defaultSkillLevel(千瘡百孔, character({ level: 120, rebirthPoints: 40 }))).toBe(20);
    expect(defaultSkillLevel(千瘡百孔, character({ level: 120, rebirthPoints: 0 }))).toBe(19);
    expect(defaultSkillLevel(千瘡百孔, character({ level: 90, rebirthPoints: 0 }))).toBe(0);
    const row = run(withPanel(character({ level: 90, rebirthPoints: 0 }), 155, 1212), monster(37, 29))
      .skills.find((s) => s.skill.id === 702)!;
    expect(row.reasons).toEqual(["目前等級還學不到這招"]);
  });

  it("玩家調整的技能等級優先", () => {
    const c = equip(withPanel(character(), 275, 1616), 55004);
    const row = run(c, monster(86, 127), { 702: 5 }).skills.find((s) => s.skill.id === 702)!;
    expect(row.level).toBe(5);
    expect(row.variants[0].perHit.min).toBe(hitDamage(1, 2712, 930, 127));
  });
});

describe("系列與連段", () => {
  const sword = equip(withPanel(character({ sectId: 4 }), 2332, 100), 55001);
  const 落英繽紛 = skill(111, 4, 3, [500, 0, 0, 0], "CLASS_FLOWER");
  const 落英飛瓣 = skill(355, 7, 3, [300, 0, 8, 100], "CLASS_FLOWER", 111);
  const 進階 = skill(714, 7, 3, [430, 0, 8, 100], "CLASS_FLOWER", 355);
  const family = [落英繽紛, 落英飛瓣, 進階];
  const runWith = (skills: DamageSkillDef[], levels?: Record<number, number>) =>
    computeDamage({ character: sword, data, panel: computePanel(sword, data), monster: monster(71, 94), skills,
      skillLevels: levels });

  it("同系列只留學得到的最高階，其餘收進 lower", () => {
    const { top, lower } = groupFamilies(runWith(family).skills);
    expect(top.map((s) => s.skill.id)).toEqual([714]);
    expect(lower.map((s) => s.skill.id).sort()).toEqual([111, 355]);
  });

  it("最高階還學不到時，前一階留在主列", () => {
    const { top, lower } = groupFamilies(runWith(family, { 714: 0 }).skills);
    expect(top.map((s) => s.skill.id)).toEqual([355]);
    expect(lower.map((s) => s.skill.id).sort()).toEqual([111, 714]);
  });

  it("機率觸發的期望值照 p4 加權，多段乘段數", () => {
    const result = runWith([醉月劍法, 落英紛飛]);
    const zui = result.skills.find((s) => s.skill.id === 716)!;
    const [trig, miss] = zui.variants.map((v) => (v.perHit.min + v.perHit.max) / 2);
    expect(expectedPerCast(zui)).toBeCloseTo(0.7 * trig + 0.3 * miss);
    const luo = result.skills.find((s) => s.skill.id === 714)!;
    expect(expectedPerCast(luo)).toBeCloseTo(((luo.variants[0].perHit.min + luo.variants[0].perHit.max) / 2) * 8);
  });

  it("連段：總傷害、真氣、普攻最好是全重擊，尚未支援的招略過", () => {
    const result = runWith([醉月劍法, 蓮蒼掌]);
    const combo = computeCombo(result, { 716: 2, normal: 3, 709: 5 }, "normal");
    const zui = result.skills.find((s) => s.skill.id === 716)!;
    expect(combo.lines.map((l) => l.key).sort()).toEqual(["716", "normal"]);
    expect(combo.mp).toBe(90);
    expect(combo.total.min).toBe(zui.variants[1].perHit.min * 2 + result.normal!.min * 3);
    expect(combo.total.max).toBe(zui.variants[0].perHit.max * 2 + result.critical!.max * 3);
    expect(combo.rounds).toBeCloseTo(1_000_000 / combo.total.expected);
    expect(combo.remaining).toBeCloseTo(1_000_000 - combo.total.expected);
  });

  it("普攻全重擊模式的期望用重擊", () => {
    const result = runWith([]);
    const combo = computeCombo(result, { normal: 1 }, "critical");
    expect(combo.total.expected).toBe((result.critical!.min + result.critical!.max) / 2);
  });
});

describe("邊際效益", () => {
  const input = (c: CharacterV1) =>
    ({ character: c, data, panel: computePanel(c, data), monster: monster(71, 94), skills: SKILLS });

  it("拿劍：外功 +1 普攻變多，根骨 +1 不變", () => {
    const rows = computeMarginal(input(equip(withPanel(character({ sectId: 4 }), 2000, 1000), 55001)));
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
    expect(byKey.str.normal).toBeGreaterThan(0);
    expect(byKey.vit.normal).toBe(0);
    expect(byKey.pow.normal).toBe(0);
    expect(byKey.str.nextCost).toBe(1);
    // 連段是空的時沒有連段效益
    expect(byKey.str.combo).toBeNull();
  });

  it("拿拳套：內力 +1 才有效，外功只影響無視防禦技能", () => {
    const c = equip(withPanel(character(), 275, 1616), 55004);
    const byKey = Object.fromEntries(computeMarginal(input(c)).map((row) => [row.key, row]));
    expect(byKey.pow.normal).toBeGreaterThan(0);
    expect(byKey.str.normal).toBe(0);
    const combo = Object.fromEntries(computeMarginal(input(c), { 703: 1 }).map((row) => [row.key, row]));
    expect(combo.str.combo).toBeGreaterThan(0);
  });

  it("連段效益 = 一輪期望傷害的差", () => {
    const c = equip(withPanel(character({ sectId: 4 }), 2000, 1000), 55001);
    const counts = { 715: 2, normal: 4 };
    const row = computeMarginal(input(c), counts).find((r) => r.key === "str")!;
    const before = computeCombo(computeDamage(input(c)), counts, "normal").total.expected;
    const c2 = { ...c, attributes: { ...c.attributes, str: c.attributes.str + 1 } };
    const after = computeCombo(computeDamage(input(c2)), counts, "normal").total.expected;
    expect(row.combo).toBeCloseTo(after - before);
  });
});
