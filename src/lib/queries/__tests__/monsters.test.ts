import { describe, it, expect } from "vitest";
import {
  parseDropItem,
  getMonstersByDropItem,
  getMonsters,
  getMonsterById,
  getDropsForMonster,
  getDistinctMonsterTypes,
  getDistinctElementals,
  getNpcCombatStats,
} from "../monsters";

describe("parseDropItem", () => {
  it("parses canonical new format", () => {
    const json = JSON.stringify(["1", 2, "100", "50", "200", "25"]);
    expect(parseDropItem(json)).toEqual([
      { itemId: 100, rate: 50 },
      { itemId: 200, rate: 25 },
    ]);
  });

  it("returns empty for '[]'", () => {
    expect(parseDropItem("[]")).toEqual([]);
  });

  it("returns empty for null", () => {
    expect(parseDropItem(null)).toEqual([]);
  });

  it("returns empty for malformed JSON", () => {
    expect(parseDropItem("{not-json")).toEqual([]);
  });

  it("returns empty when pairCount is NaN", () => {
    expect(parseDropItem('["1"]')).toEqual([]);
  });

  it("truncates on missing pair tail", () => {
    const json = JSON.stringify(["1", 2, "100", "50"]); // claims 2 pairs, has 1
    expect(parseDropItem(json)).toEqual([{ itemId: 100, rate: 50 }]);
  });
});

describe("getMonsters", () => {
  it("returns paginated combatants (npc LEFT JOIN monsters, type > 0)", () => {
    const result = getMonsters({ pageSize: 10 });
    expect(result.monsters.length).toBeLessThanOrEqual(10);
    expect(result.monsters.length).toBeGreaterThan(0);
    expect(result.total).toBe(3135);
    for (const m of result.monsters) {
      expect(m.id).toBeGreaterThan(0);
      expect(typeof m.hasDrop).toBe("boolean");
    }
  });

  it("filters by hasDrop", () => {
    const withDrop = getMonsters({ hasDrop: true, pageSize: 5 });
    expect(withDrop.total).toBeGreaterThan(0);
    expect(withDrop.total).toBeLessThan(3120);
    for (const m of withDrop.monsters) expect(m.hasDrop).toBe(true);
  });

  it("filters by type", () => {
    const type17 = getMonsters({ type: 17, pageSize: 5 });
    expect(type17.total).toBe(1156);
    for (const m of type17.monsters) expect(m.type).toBe(17);
  });

  it("filters by isNormal (▲/● prefix)", () => {
    const normals = getMonsters({ isNormal: true, pageSize: 5 });
    for (const m of normals.monsters) {
      expect(m.name.startsWith("▲") || m.name.startsWith("●")).toBe(true);
    }
  });

  it("searches by integer id", () => {
    const result = getMonsters({ search: "8939" });
    const match = result.monsters.find((m) => m.id === 8939);
    expect(match).toBeDefined();
  });
});

describe("getMonsterById", () => {
  it("returns full npc row joined with monsters.drop_item", () => {
    const first = getMonsters({ pageSize: 1 }).monsters[0];
    expect(first).toBeDefined();
    const detail = getMonsterById(first.id);
    expect(detail).not.toBeNull();
    expect(detail!.id).toBe(first.id);
    expect(detail!.name).toBe(first.name);
    // npc-only fields present
    expect("fire_def" in detail!).toBe(true);
    expect("weaken_res" in detail!).toBe(true);
    // monsters-only field present
    expect("drop_item" in detail!).toBe(true);
  });

  it("returns null for unknown id", () => {
    expect(getMonsterById(999999999)).toBeNull();
  });

  it("returns null for npc id without monsters row (vendor NPC)", () => {
    // Any NPC not in monsters must return null due to INNER JOIN.
    // We verify by finding an NPC id absent from monsters via the combined query.
    // Here we assert the guarantee indirectly by checking a known-absent large id.
    expect(getMonsterById(1)).toBeNull();
  });
});

describe("getDropsForMonster", () => {
  it("returns sorted drops with item metadata for a monster that drops something", () => {
    // Find a monster known to have drops
    const withDrop = getMonsters({ hasDrop: true, pageSize: 1 }).monsters[0];
    expect(withDrop).toBeDefined();
    const { drops, totalWeight } = getDropsForMonster(withDrop.id);
    expect(drops.length).toBeGreaterThan(0);
    // Sorted desc by rate
    for (let i = 1; i < drops.length; i++) {
      expect(drops[i - 1].rate).toBeGreaterThanOrEqual(drops[i].rate);
    }
    // totalWeight must include empty slot → ≥ sum of visible rates
    const visibleSum = drops.reduce((s, d) => s + d.rate, 0);
    expect(totalWeight).toBeGreaterThanOrEqual(visibleSum);
  });

  it("returns empty drops array for monster with no drops", () => {
    // Pick a monster via getMonsters with hasDrop=false
    const noDrop = getMonsters({ pageSize: 50 }).monsters.find((m) => !m.hasDrop);
    expect(noDrop).toBeDefined();
    const result = getDropsForMonster(noDrop!.id);
    expect(result.drops).toEqual([]);
  });
});

describe("getMonstersByDropItem (existing — regression guard)", () => {
  it("round-trips: pick a drop item, look up monsters, confirm the monster exists in them", () => {
    const withDrop = getMonsters({ hasDrop: true, pageSize: 20 }).monsters;
    for (const m of withDrop) {
      const { drops } = getDropsForMonster(m.id);
      if (drops.length === 0) continue;
      const first = drops[0];
      const sources = getMonstersByDropItem(first.itemId);
      expect(sources.find((s) => s.id === m.id)).toBeDefined();
      return; // one successful round-trip is enough
    }
    throw new Error("No monster with parseable drops found for round-trip");
  });
});

describe("distinct helpers", () => {
  it("getDistinctMonsterTypes returns 7 values (13–19)", () => {
    const types = getDistinctMonsterTypes();
    expect(types).toEqual([13, 14, 15, 16, 17, 18, 19]);
  });

  it("getDistinctElementals contains 火/水/電/木 (subset)", () => {
    const elementals = getDistinctElementals();
    expect(elementals.length).toBeGreaterThan(0);
    // At least one of 火/水/電/木 should be present
    const core = ["火", "水", "電", "木"];
    expect(elementals.some((e) => core.includes(e))).toBe(true);
  });
});

describe("getMonsters — level range", () => {
  it("filters by levelMin (level >= min)", () => {
    const result = getMonsters({ levelMin: 100, pageSize: 20 });
    expect(result.total).toBe(1394);
    for (const m of result.monsters) expect(m.level).toBeGreaterThanOrEqual(100);
  });

  it("filters by levelMax (level <= max)", () => {
    const result = getMonsters({ levelMax: 10, pageSize: 20 });
    expect(result.total).toBe(157);
    for (const m of result.monsters) expect(m.level).toBeLessThanOrEqual(10);
  });

  it("filters by both bounds (inclusive)", () => {
    const result = getMonsters({ levelMin: 50, levelMax: 60, pageSize: 100 });
    expect(result.total).toBe(216);
    for (const m of result.monsters) {
      expect(m.level).toBeGreaterThanOrEqual(50);
      expect(m.level).toBeLessThanOrEqual(60);
    }
  });

  it("swaps bounds when min > max (forgiving)", () => {
    const swapped = getMonsters({ levelMin: 60, levelMax: 50, pageSize: 100 });
    expect(swapped.total).toBe(216);
  });

  it("clamps out-of-range bounds to [1, 200]", () => {
    // 0 clamps to 1 (min possible level) → no effective lower bound
    expect(getMonsters({ levelMin: 0 }).total).toBe(3135);
    // 999 clamps to 200 (max possible level) → no effective upper bound
    expect(getMonsters({ levelMax: 999 }).total).toBe(3135);
  });

  it("ignores non-finite bounds (treated as unbounded)", () => {
    expect(getMonsters({ levelMin: Number.NaN, levelMax: Number.NaN }).total).toBe(3135);
  });
});

describe("getMonsters — sort", () => {
  it("sorts by level ascending", () => {
    const result = getMonsters({ sortBy: "level", sortDir: "asc", pageSize: 20 });
    const levels = result.monsters.map((m) => m.level);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    }
  });

  it("sorts by level descending", () => {
    const result = getMonsters({ sortBy: "level", sortDir: "desc", pageSize: 20 });
    const levels = result.monsters.map((m) => m.level);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeLessThanOrEqual(levels[i - 1]);
    }
    const ascResult = getMonsters({ sortBy: "level", sortDir: "asc", pageSize: 20 });
    expect(result.monsters[0].id).not.toBe(ascResult.monsters[0].id);
  });

  it("sorts by hp descending — top results have non-null hp", () => {
    // Use pageSize: 5 to stay well within high-hp monsters; avoids NULL-hp edge cases
    // (SQLite puts NULL last in DESC, ?? 0 would corrupt the >= chain if NULLs appear)
    const result = getMonsters({ sortBy: "hp", sortDir: "desc", pageSize: 5 });
    expect(result.monsters.length).toBeGreaterThan(0);
    const hps = result.monsters.map((m) => m.hp);
    for (const hp of hps) expect(hp).not.toBeNull();
    for (let i = 1; i < hps.length; i++) {
      expect(hps[i]!).toBeLessThanOrEqual(hps[i - 1]!);
    }
    const defaultIds = getMonsters({ pageSize: 5 }).monsters.map((m) => m.id);
    const hpIds = result.monsters.map((m) => m.id);
    expect(hpIds).not.toEqual(defaultIds);
  });

  it("ignores invalid sortBy and falls back to default order", () => {
    const defaultResult = getMonsters({ pageSize: 20 });
    const invalidResult = getMonsters({ sortBy: "n.drop_item", pageSize: 20 });
    expect(invalidResult.monsters.map((m) => m.id)).toEqual(
      defaultResult.monsters.map((m) => m.id),
    );
  });
});

describe("getNpcCombatStats — skills / onHit (飄渺秘境 生之難/死之難)", () => {
  it("11402 飄渺生之難：激攻靈壇 Lv5（group-buff）+ 霸修羅刀 Lv20（melee, ×30），onHit 麻痺 5", () => {
    const stats = getNpcCombatStats([11402]);
    const row = stats.get(11402);
    expect(row).toBeDefined();

    expect(row!.skills).toHaveLength(2);
    const [buff, melee] = row!.skills;

    expect(buff.magicId).toBe(374);
    expect(buff.level).toBe(5);
    expect(buff.name).toBe("激攻靈壇");
    expect(buff.target).toBe("TARGET_GROUP");
    expect(buff.kind).toBe("group-buff");
    expect(buff.multiplier).toBeNull();

    expect(melee.magicId).toBe(706);
    expect(melee.level).toBe(20);
    expect(melee.name).toBe("霸修羅刀");
    expect(melee.target).toBe("TARGET_ENEMYTARGET");
    expect(melee.range).toBe(2);
    expect(melee.kind).toBe("melee");
    expect(melee.multiplier).toBe(30);

    expect(row!.onHit).toEqual({ name: "麻痺", prob: 5 });
  });

  it("11404 飄渺死之難：凝霜護體 Lv20（self）+ 蓮蒼掌 Lv20（ranged, range 7, ×26），onHit 麻痺 5", () => {
    const stats = getNpcCombatStats([11404]);
    const row = stats.get(11404);
    expect(row).toBeDefined();

    expect(row!.skills).toHaveLength(2);
    const [selfBuff, ranged] = row!.skills;

    expect(selfBuff.magicId).toBe(349);
    expect(selfBuff.level).toBe(20);
    expect(selfBuff.name).toBe("凝霜護體");
    expect(selfBuff.target).toBe("TARGET_SELF");
    expect(selfBuff.kind).toBe("self");

    expect(ranged.magicId).toBe(709);
    expect(ranged.level).toBe(20);
    expect(ranged.name).toBe("蓮蒼掌");
    expect(ranged.target).toBe("TARGET_ENEMYTARGET");
    expect(ranged.range).toBe(7);
    expect(ranged.kind).toBe("ranged");
    expect(ranged.multiplier).toBe(26);

    expect(row!.onHit).toEqual({ name: "麻痺", prob: 5 });
  });

  it("5547 ●邪道鬼王：孤兒代碼（skill3=13208 → magic id=132 level=8 不存在）被跳過，只留可解出的技能", () => {
    const stats = getNpcCombatStats([5547]);
    const row = stats.get(5547);
    expect(row).toBeDefined();

    // skill3=13208 是孤兒代碼，跳過；skill4=57501 → magic id=575 level=1「懾魂輓歌」可解出。
    expect(row!.skills).toHaveLength(1);
    expect(row!.skills[0].magicId).toBe(575);
    expect(row!.skills[0].level).toBe(1);
    expect(row!.skills[0].name).toBe("懾魂輓歌");
    expect(row!.skills[0].target).toBe("TARGET_ENEMYTARGET");

    // onHit：extra_status=1013（卸冑）、status_prob=8。
    expect(row!.onHit).toEqual({ name: "卸冑", prob: 8 });
  });

  it("npc with no skills (all skill1..4 = 0) returns empty skills array and null onHit", () => {
    // 皇室禁衛（6650）：純劇情 NPC，is_monster=0，skill1..4 皆 0，extra_status/status_prob 亦 0。
    const stats = getNpcCombatStats([6650]);
    const row = stats.get(6650);
    expect(row).toBeDefined();
    expect(row!.skills).toEqual([]);
    expect(row!.onHit).toBeNull();
  });

  it("duplicate skill codes across skill1..4 are deduped", () => {
    // npc 5926: skill1=27306, skill3=27306（相同代碼重複出現）, skill4=50310。
    const stats = getNpcCombatStats([5926]);
    const row = stats.get(5926);
    expect(row).toBeDefined();
    const codes = row!.skills.map((s) => `${s.magicId}:${s.level}`);
    expect(new Set(codes).size).toBe(codes.length); // 沒有重複
  });
});
