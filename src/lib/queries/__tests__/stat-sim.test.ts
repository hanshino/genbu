import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { HELP_PASSIVES, WEAPON_TYPE_NAMES } from "@/configs/stat-sim-passives";
import { STAT_KEYS, type GameData } from "@/lib/types/stat-sim";
import { getStatSimData, getStatSimWindows } from "../stat-sim";
import { equipmentFields } from "@/components/stat-sim/window-layout";

describe("stat-sim — 真實遊戲資料", () => {
  let data: GameData;
  beforeAll(() => { data = getStatSimData(); });

  it("160 帽 +5 只取當級 common；解鎖 bonus 累加且跨級保留", () => {
    const cap = data.itemsById[50401]; // 血龍魔尊冠 Lv160，path 132
    expect(cap.name).toBe("血龍魔尊冠");
    expect(cap.slotHint).toEqual(["cap"]);
    expect(cap.strongPathId).toBe(132);
    const path = data.enhancementsByPath[132];
    expect(path.maxLevel).toBe(20);
    expect(path.levels[0]).toEqual({});
    expect(path.levels[1]).toEqual({ def: 2 });
    expect(path.levels[4]).toEqual({ def: 8 });
    expect(path.levels[5]).toEqual({ def: 10, mdef: 24 }); // 不可是 def=2+4+6+8+10
    expect(path.levels[6]).toEqual({ def: 12, mdef: 24 });
    expect(path.levels[7]).toEqual({ def: 14, mdef: 24, hp: 550 });
    expect(path.levels[10]).toEqual({ def: 50, mdef: 24, hp: 550, mp: 200 });
    expect(path.levels[20]).toEqual({ def: 120, mdef: 24, hp: 1200, mp: 500, hit: 35 });
  });

  it("道具欄位 aliases、run_speed 與重量取 DB；不收外裝或紙娃娃", () => {
    const db = getDb();
    for (const item of Object.values(data.itemsById)) {
      expect(item.typeName).not.toBeNull();
      expect(item.slotHint).not.toBeNull();
      expect(Object.keys(item.stats).every((key) => (STAT_KEYS as readonly string[]).includes(key))).toBe(true);
      if (item.typeName === "ORNAMENT") {
        const row = db.prepare("SELECT equip_slot FROM items WHERE id=?").get(item.id) as { equip_slot: string };
        expect(item.slotHint).toEqual([`ornament${row.equip_slot.at(-1)}`]);
      }
      if (item.strongPathId !== null) expect(data.enhancementsByPath[item.strongPathId]).toBeDefined();
    }
    const cap = db.prepare("SELECT extra_def, magic_def, critical_hit, run_speed, weight FROM items WHERE id=50401")
      .get() as Record<string, number>;
    expect(data.itemsById[50401].stats.def ?? 0).toBe(cap.extra_def);
    expect(data.itemsById[50401].stats.mdef ?? 0).toBe(cap.magic_def);
    expect(data.itemsById[50401].stats.critical ?? 0).toBe(cap.critical_hit);
    expect(data.itemsById[50401].stats.weight ?? 0).toBe(cap.weight);
    const speedItem = db.prepare("SELECT id, run_speed, walk_speed FROM items WHERE run_speed != walk_speed AND equip_slot='HORSE' LIMIT 1")
      .get() as { id: number; run_speed: number; walk_speed: number };
    expect(speedItem).toBeDefined();
    expect(data.itemsById[speedItem.id].slotHint).toEqual(["horse"]);
    expect(data.itemsById[speedItem.id].stats.run_speed ?? 0).toBe(speedItem.run_speed);
    const excluded = db.prepare("SELECT id FROM items WHERE equip_slot LIKE 'EXTRA_%' OR type_name IS NULL")
      .all() as Array<{ id: number }>;
    for (const row of excluded) expect(data.itemsById[row.id]).toBeUndefined();
    expect(data.itemsById[50401].iconUrl).toMatch(/^https:\/\//);
  });

  it("magic_stats 逐級累加：收藏 Lv2 HP=500，六圍也對應 StatKey", () => {
    const collection = data.passives.find((passive) => passive.id === 1151)!;
    expect(collection.group).toBe("collection");
    expect(collection.cumulative[0]).toEqual({});
    expect(collection.cumulative[1]).toEqual({ hp: 250 });
    expect(collection.cumulative[2]).toEqual({ hp: 500 });
    expect(collection.cumulative[10]).toEqual({ hp: 2500 });
    expect(collection.cumulative[11]).toEqual({ hp: 2800 });
    expect(collection.cumulative[20]).toEqual({ hp: 5500 });
    expect(collection.learnLevels[0]).toBe(0);
    expect(collection.learnLevels[1]).toBe(-1);
    expect(data.passives.find((passive) => passive.id === 1189)?.cumulative[2]).toEqual({ str: 2 });
    expect(data.passives.filter((passive) => passive.group === "collection").map((passive) => passive.id))
      .toEqual([1151, 1152, 1153, 1154, 1155, 1156, 1157, 1158, 1159]);
  });

  it("隱藏測試技能；成就技能獨立分組，取得上限只計 enabled=1 的 skill 獎勵", () => {
    const db = getDb();
    expect(data.passives.some((p) => p.id === 1150)).toBe(false);
    const achievements = data.passives.filter((p) => p.group === "achievement");
    expect(achievements.map((p) => p.id)).toEqual(Array.from({ length: 22 }, (_, i) => 1181 + i));
    for (const p of achievements) {
      const row = db.prepare("SELECT COALESCE(SUM(reward_amount), 0) AS total FROM achievements WHERE reward_kind='skill' AND enabled=1 AND reward_id=?")
        .get(p.id) as { total: number };
      expect(p.obtainableMax).toBe(row.total);
      expect(p.obtainableMax).toBeLessThanOrEqual(p.maxLevel);
    }
    expect(achievements.find((p) => p.id === 1181)?.obtainableMax).toBe(12);
    for (const id of [1189, 1190, 1191, 1192, 1193, 1194]) {
      expect(achievements.find((p) => p.id === id)?.obtainableMax).toBe(0);
    }
    const rows = db.prepare(`SELECT DISTINCT magic_id FROM magic_stats
      WHERE stat IN ('Str','Pow','Vit','Dex','Agi','Wis') AND magic_id NOT IN
      (SELECT magic_id FROM magic_learn WHERE is_meridian=1 UNION SELECT magic_id FROM magic_meridians)
      ORDER BY magic_id`).all();
    expect(rows).toEqual([1189, 1190, 1191, 1192, 1193, 1194].map((magic_id) => ({ magic_id })));
    for (const [i, key] of ["str", "pow", "vit", "dex", "agi", "wis"].entries()) {
      expect(achievements.find((p) => p.id === 1189 + i)?.cumulative[2]).toEqual({ [key]: 2 });
    }
  });

  it("收藏門檻按值排序並對應有效的收藏技能等級", () => {
    expect(data.collectionThresholds).toEqual(getDb().prepare("SELECT value, magic_id AS magicId, level FROM collect_book_bonuses ORDER BY value, magic_id, level").all());
    expect(data.collectionThresholds?.[0]).toEqual({ value: 50, magicId: 1151, level: 1 });
    for (const row of data.collectionThresholds!) {
      const p = data.passives.find((p) => p.id === row.magicId)!;
      expect(p.group).toBe("collection");
      expect(row.level).toBeLessThanOrEqual(p.maxLevel);
    }
  });

  it("京門 1060 Lv2 HP=2400、提托 1010 Lv4 負重=3200，但兩者屬經脈必須排除", () => {
    // brief 的兩個累加例子都是經脈：驗真實資料規則，但不能放進 GameData.passives。
    const db = getDb();
    const sum = (id: number, level: number) => db.prepare(`
      SELECT stat, SUM(value) AS value FROM magic_stats
      WHERE magic_id = ? AND level <= ? AND (flag IS NULL OR flag != 'AFFECT_RATIO') GROUP BY stat
    `).all(id, level);
    expect(sum(1060, 2)).toEqual([{ stat: "HPMAX", value: 2400 }]);
    expect(sum(1010, 4)).toEqual([{ stat: "Encumbrance", value: 3200 }]);
    const excluded = db.prepare(`
      SELECT magic_id FROM magic_learn WHERE is_meridian=1 UNION SELECT magic_id FROM magic_meridians
    `).all() as Array<{ magic_id: number }>;
    const passiveIds = new Set(data.passives.map((passive) => passive.id));
    for (const row of excluded) expect(passiveIds.has(row.magic_id)).toBe(false);
  });

  it("22 個 help 技能逐級表完整，保留不規則數值與武器條件", () => {
    expect(Object.keys(HELP_PASSIVES).map(Number)).toEqual([
      13, 14, 21, 22, 23, 24, 26, 27, 29, 30, 51, 53, 180, 265, 601, 602, 750, 756, 771, 777, 821, 827,
    ]);
    for (const id of Object.keys(HELP_PASSIVES).map(Number)) {
      const passive = data.passives.find((row) => row.id === id)!;
      expect(passive).toBeDefined();
      expect(passive.cumulative.length).toBe(passive.maxLevel + 1);
      expect(passive.learnLevels.length).toBe(passive.maxLevel + 1);
      expect(passive.cumulative[0]).toEqual({});
      expect(passive.iconUrl).toMatch(/^https:\/\//);
    }
    const sword = data.passives.find((row) => row.id === 821)!;
    expect(sword.weaponReq).toEqual(["HAMMER"]);
    expect(sword.cumulative[1]).toEqual({ atk: 5 });
    expect(sword.cumulative[2]).toEqual({ atk: 30 });
    expect(sword.cumulative[10]).toEqual({ atk: 70 });
    expect(sword.cumulative[15]).toEqual({ atk: 120 });
    expect(sword.group).toBe("main");
    expect(sword.clan).toBe("CLASS_MONTO_KYLIN");
    expect(data.passives.find((row) => row.id === 27)?.cumulative[5]).toEqual({ atk: 22, uncanny_dodge: 5 });
    expect(data.passives.find((row) => row.id === 29)?.weaponReq).toEqual(["HIDDEN_WEAPON"]);
    expect(data.passives.find((row) => row.id === 750)?.weaponReq).toEqual(WEAPON_TYPE_NAMES);
    expect(data.passives.find((row) => row.id === 756)?.weaponReq).toEqual(WEAPON_TYPE_NAMES);
    const forbidden = data.passives.find((row) => row.id === 777)!;
    expect(forbidden.weaponReqStats).toEqual(["matk"]);
    expect(forbidden.weaponReq).toContain("STAFF");
    expect(forbidden.weaponReq).not.toContain("BOW");
    expect(forbidden.weaponReq).not.toContain("HIDDEN_WEAPON");
    expect(forbidden.cumulative[15]).toEqual({ matk: 100, mp: 350 });
    expect(forbidden.note).toContain("估計");
    expect(data.passives.find((row) => row.id === 827)?.cumulative[1]).toEqual({});
    const wedding = data.passives.find((row) => row.id === 180)!;
    expect(wedding.cumulative[4]).toEqual({ hp: 12000 });
    expect(wedding.learnLevels.slice(1, 5)).toEqual([110, 120, 130, 140]);
    expect(wedding.maxLevel).toBe(4);
    expect(wedding.learnLevels).toHaveLength(5);
    expect(wedding.note).toBeUndefined();
  });

  it("分組、max-level 名稱/圖示、learnLevels 與未知 stat diagnostics", () => {
    expect(data.passives.find((row) => row.id === 13)?.name).toBe("進階刀修練");
    expect(data.passives.find((row) => row.id === 601)?.group).toBe("guild");
    expect(data.passives.find((row) => row.id === 750)?.group).toBe("sub");
    expect(data.passives.find((row) => row.id === 53)?.group).toBe("common");
    const child = data.passives.find((row) => row.id === 4)!;
    expect(child.clan).toBe("CLASS_CHILD");
    expect(child.group).toBe("main");
    expect(child.note).toContain("FireAttack");
    expect(child.cumulative.every((bonus) => Object.keys(bonus).length === 0)).toBe(true);
    const db = getDb();
    for (const passive of data.passives) {
      const image = db.prepare("SELECT url FROM magic_images WHERE magic_id=? ORDER BY level DESC LIMIT 1")
        .get(passive.id) as { url: string } | undefined;
      expect(passive.iconUrl).toBe(image?.url ?? null);
      for (let level = 1; level <= passive.maxLevel; level++) {
        const learn = db.prepare("SELECT char_level FROM magic_learn WHERE magic_id=? AND level=?")
          .get(passive.id, level) as { char_level: number } | undefined;
        expect(passive.learnLevels[level]).toBe(learn?.char_level ?? -1);
      }
    }
  });
});

describe("stat-sim — 遊戲視窗座標", () => {
  it("裝備十格完全由 ui_equip_slots 對應，不受 BUTTON 註解與座標影響", () => {
    const { equipment } = getStatSimWindows();
    const rows = getDb().prepare("SELECT label, ctrl_id AS ctrlId, x, y, width, height FROM ui_equip_slots WHERE window='accoutrements_A' ORDER BY ctrl_id").all();
    expect(equipment.equipSlots).toHaveLength(10);
    expect(equipment.equipSlots!.map(({ slot, ...row }) => { expect(slot).toBeTruthy(); return row; })).toEqual(rows);
    const before = equipmentFields(equipment).slots;
    equipment.controls = equipment.controls.map((c) => ({ ...c, comment: "錯誤註解", x: 0, y: 0 }));
    expect(equipmentFields(equipment).slots).toEqual(before);
    expect(before.find((s) => s.slot === "right")?.box).toEqual({ x: 8, y: 72, w: 40, h: 40 });
  });
  it("Attribute 9 個面板值與 6 個六圍值，使用座標而非 comment 配對", () => {
    const { attribute, equipment } = getStatSimWindows();
    expect([attribute.window, attribute.width, attribute.height]).toEqual(["Attribute", 400, 162]);
    expect([equipment.window, equipment.width, equipment.height]).toEqual(["accoutrements_A", 200, 318]);
    expect(attribute.backgroundUrl).toBe("https://img.hanshino.dev/2vmjo1.png");
    expect(equipment.backgroundUrl).toBe("https://img.hanshino.dev/dgg115.png");
    const panel = attribute.controls.filter((control) => control.field !== null &&
      [188, 266, 345].includes(control.x) && [86, 103, 120].includes(control.y));
    expect(panel).toHaveLength(9);
    expect(panel.map(({ ctrlId, x, y }) => [ctrlId, x, y])).toEqual([
      [949, 188, 86], [950, 188, 103], [951, 188, 120],
      [952, 266, 86], [953, 266, 103], [954, 266, 120],
      [955, 345, 86], [956, 345, 103], [957, 345, 120],
    ]);
    const attributes = attribute.controls.filter((control) => control.field !== null &&
      [184, 278, 277].includes(control.x) && [28, 46, 64].includes(control.y));
    expect(attributes).toHaveLength(6);
    expect(attributes.map(({ ctrlId, x, y }) => [ctrlId, x, y])).toEqual([
      [264, 184, 28], [265, 184, 46], [815, 184, 64],
      [816, 278, 28], [817, 278, 46], [818, 277, 64],
    ]);
    expect(attribute.controls.find((control) => control.ctrlId === 6)?.iconUrl)
      .toBe("https://img.hanshino.dev/hk64bx.png");
    expect(attribute.controls.find((control) => control.ctrlId === 489)).toBeDefined();
    expect(new Set(attribute.controls.map((control) => control.ctrlId)).size).toBe(attribute.controls.length);
    expect(new Set(equipment.controls.map((control) => control.ctrlId)).size).toBe(equipment.controls.length);
  });
});
