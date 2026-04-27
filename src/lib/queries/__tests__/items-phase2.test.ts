import { describe, it, expect } from "vitest";
import { getItemsByType, getItemsByIds, getItemRandsByIds, getItems } from "../items";

describe("getItemsByType", () => {
  it("returns 座騎 rows with only ranking columns", () => {
    const rows = getItemsByType("座騎");
    expect(rows.length).toBeGreaterThan(0);
    const sample = rows[0] as Record<string, unknown>;
    expect(sample.picture).toBeUndefined(); // trimmed
    expect(sample.summary).toBeUndefined(); // trimmed
    expect(typeof sample.str).toBe("number"); // kept
  });
});

describe("getItemsByIds / getItemRandsByIds", () => {
  it("returns empty arrays for empty input", () => {
    expect(getItemsByIds([])).toEqual([]);
    expect(getItemRandsByIds([])).toEqual([]);
  });

  it("round-trips at least one 座騎 with its rand rows", () => {
    const [first] = getItemsByType("座騎");
    expect(first).toBeDefined();
    const full = getItemsByIds([first.id]);
    expect(full).toHaveLength(1);
    expect(full[0].id).toBe(first.id);
    const rands = getItemRandsByIds([first.id]);
    // Not every item has rand rows; just assert the call succeeded and
    // returned an array.
    expect(Array.isArray(rands)).toBe(true);
  });
});

describe("getItems — sort", () => {
  it("sorts by level ascending", () => {
    const result = getItems({ sortBy: "level", sortDir: "asc", pageSize: 20 });
    expect(result.items.length).toBeGreaterThan(0);
    const levels = result.items.map((i) => i.level);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    }
    const ascFirstId = result.items[0].id;
    const descResult = getItems({ sortBy: "level", sortDir: "desc", pageSize: 20 });
    expect(ascFirstId).not.toBe(descResult.items[0].id);
  });

  it("sorts by level descending", () => {
    const result = getItems({ sortBy: "level", sortDir: "desc", pageSize: 20 });
    const levels = result.items.map((i) => i.level);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeLessThanOrEqual(levels[i - 1]);
    }
  });

  it("sorts by id ascending", () => {
    const result = getItems({ sortBy: "id", sortDir: "asc", pageSize: 20 });
    const ids = result.items.map((i) => i.id);
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeGreaterThanOrEqual(ids[i - 1]);
    }
    const defaultIds = getItems({ pageSize: 20 }).items.map((i) => i.id);
    const ascIds = result.items.map((i) => i.id);
    expect(ascIds).not.toEqual(defaultIds);
  });

  it("ignores invalid sortBy and falls back to default order", () => {
    const defaultResult = getItems({ pageSize: 20 });
    const invalidResult = getItems({ sortBy: "'; DROP TABLE items; --", pageSize: 20 });
    expect(invalidResult.items.map((i) => i.id)).toEqual(defaultResult.items.map((i) => i.id));
  });
});
