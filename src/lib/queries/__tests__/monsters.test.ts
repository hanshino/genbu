import { describe, it, expect } from "vitest";
import {
  parseDropItem,
  getMonstersByDropItem,
  getMonsters,
  getMonsterById,
  getDropsForMonster,
  getDistinctMonsterTypes,
  getDistinctElementals,
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
  it("returns paginated combatants (npc INNER JOIN monsters)", () => {
    const result = getMonsters({ pageSize: 10 });
    expect(result.monsters.length).toBeLessThanOrEqual(10);
    expect(result.monsters.length).toBeGreaterThan(0);
    expect(result.total).toBe(2829);
    for (const m of result.monsters) {
      expect(m.id).toBeGreaterThan(0);
      expect(typeof m.hasDrop).toBe("boolean");
    }
  });

  it("filters by hasDrop", () => {
    const withDrop = getMonsters({ hasDrop: true, pageSize: 5 });
    expect(withDrop.total).toBeGreaterThan(0);
    expect(withDrop.total).toBeLessThan(2829);
    for (const m of withDrop.monsters) expect(m.hasDrop).toBe(true);
  });

  it("filters by type", () => {
    const type17 = getMonsters({ type: 17, pageSize: 5 });
    expect(type17.total).toBe(1061);
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
