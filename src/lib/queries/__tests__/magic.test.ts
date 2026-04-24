import { describe, it, expect } from "vitest";
import {
  getSkills,
  getSkillById,
  getSkillsByClan,
  getDistinctClans,
  getDistinctTargets,
} from "../magic";

describe("getSkills", () => {
  it("returns paginated skills collapsed by id", () => {
    const result = getSkills({ pageSize: 10 });
    expect(result.skills.length).toBeLessThanOrEqual(10);
    expect(result.skills.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
    // Each row represents one distinct skill id with its max level
    const ids = result.skills.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    // maxLevel should be a positive integer
    for (const s of result.skills) {
      expect(Number.isInteger(s.maxLevel)).toBe(true);
      expect(s.maxLevel).toBeGreaterThan(0);
    }
  });

  it("filters by clan", () => {
    const result = getSkills({ clan: "CLASS_SHAULIN", pageSize: 50 });
    expect(result.total).toBeGreaterThan(0);
    for (const s of result.skills) {
      expect(s.clan).toBe("CLASS_SHAULIN");
    }
  });

  it("filters by target", () => {
    const result = getSkills({ target: "TARGET_PASSIVE", pageSize: 20 });
    expect(result.total).toBeGreaterThan(0);
    for (const s of result.skills) {
      expect(s.target).toBe("TARGET_PASSIVE");
    }
  });

  it("searches by integer id", () => {
    const result = getSkills({ search: "227", pageSize: 5 });
    // id 227 is 龍牙拳 per DB probe
    const found = result.skills.find((s) => s.id === 227);
    expect(found).toBeDefined();
    expect(found?.name).toBe("龍牙拳");
  });

  it("searches by name substring", () => {
    const result = getSkills({ search: "龍牙", pageSize: 10 });
    expect(result.total).toBeGreaterThan(0);
    for (const s of result.skills) {
      expect(s.name).toContain("龍牙");
    }
  });

  it("paginates consistently", () => {
    const p1 = getSkills({ pageSize: 5, page: 1 });
    const p2 = getSkills({ pageSize: 5, page: 2 });
    expect(p1.totalPages).toBe(p2.totalPages);
    expect(p1.total).toBe(p2.total);
    const p1Ids = new Set(p1.skills.map((s) => s.id));
    for (const s of p2.skills) expect(p1Ids.has(s.id)).toBe(false);
  });
});

describe("getSkillById", () => {
  it("returns all level rows for a known skill (龍牙拳 id=227)", () => {
    const rows = getSkillById(227);
    expect(rows.length).toBeGreaterThan(1);
    const levels = rows.map((r) => r.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    for (const r of rows) expect(r.id).toBe(227);
    expect(rows.every((r) => r.name === "龍牙拳")).toBe(true);
  });

  it("returns empty array for unknown id", () => {
    expect(getSkillById(9999999)).toEqual([]);
  });
});

describe("getSkillsByClan", () => {
  it("returns 少林 skills excluding the given id", () => {
    const rows = getSkillsByClan("CLASS_SHAULIN", 227, 10);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(10);
    expect(rows.every((r) => r.id !== 227)).toBe(true);
    expect(rows.every((r) => r.clan === "CLASS_SHAULIN")).toBe(true);
  });

  it("respects the limit", () => {
    const rows = getSkillsByClan("CLASS_SHAULIN", null, 3);
    expect(rows.length).toBeLessThanOrEqual(3);
  });
});

describe("distinct helpers", () => {
  it("getDistinctClans contains expected clans", () => {
    const clans = getDistinctClans();
    expect(clans).toContain("CLASS_SHAULIN");
    expect(clans).toContain("CLASS_SKY");
    expect(clans.length).toBeGreaterThanOrEqual(14);
  });

  it("getDistinctTargets contains TARGET_SELF", () => {
    const targets = getDistinctTargets();
    expect(targets).toContain("TARGET_SELF");
    expect(targets).toContain("TARGET_ENEMYTARGET");
  });
});
