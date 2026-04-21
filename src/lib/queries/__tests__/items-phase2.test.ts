import { describe, it, expect } from "vitest";
import { getItemsByType, getItemsByIds, getItemRandsByIds } from "../items";

describe("getItemsByType", () => {
  it("returns 座騎 rows with only ranking columns", () => {
    const rows = getItemsByType("座騎");
    expect(rows.length).toBeGreaterThan(0);
    const sample = rows[0] as Record<string, unknown>;
    expect(sample.picture).toBeUndefined();   // trimmed
    expect(sample.summary).toBeUndefined();   // trimmed
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
