import { describe, it, expect } from "vitest";
import {
  getSkills,
  getSkillById,
  getSkillGroup,
  getSkillRow,
  getSkillsByClan,
  getDistinctClans,
  getDistinctTargets,
} from "../magic";

describe("getSkills", () => {
  it("returns paginated skills grouped by (id, name)", () => {
    const result = getSkills({ pageSize: 10 });
    expect(result.skills.length).toBeLessThanOrEqual(10);
    expect(result.skills.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
    // Each row represents one distinct (id, name) pair
    const keys = result.skills.map((s) => `${s.id}::${s.name}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of result.skills) {
      expect(Number.isInteger(s.maxLevel)).toBe(true);
      expect(s.maxLevel).toBeGreaterThan(0);
      expect(Number.isInteger(s.firstLevel)).toBe(true);
      expect(s.firstLevel).toBeGreaterThan(0);
      expect(s.firstLevel).toBeLessThanOrEqual(s.maxLevel);
    }
  });

  it("splits shared id into distinct (id, name) skills (id=13 刀修練 + 進階刀修練)", () => {
    // MAGIC.INI 允許同 ID 共用於基礎/進階配對（id=13, 14, 17, 21, 22, ...）。
    // 列表不能 collapse 成一筆，每個 name 要獨立成行。
    const result = getSkills({ search: "13", pageSize: 100 });
    const rowsFor13 = result.skills.filter((s) => s.id === 13);
    expect(rowsFor13.length).toBe(2);
    expect(new Set(rowsFor13.map((s) => s.name))).toEqual(new Set(["刀修練", "進階刀修練"]));
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
    const p1Keys = new Set(p1.skills.map((s) => `${s.id}::${s.name}`));
    for (const s of p2.skills) expect(p1Keys.has(`${s.id}::${s.name}`)).toBe(false);
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

describe("getSkillRow", () => {
  it("returns the specific (id, level) row and disambiguates shared ids", () => {
    // id=13 Lv1-10 是「刀修練」、Lv11-15 是「進階刀修練」 — 同 id 兩個 name
    const basic = getSkillRow(13, 1);
    expect(basic?.name).toBe("刀修練");
    const advanced = getSkillRow(13, 11);
    expect(advanced?.name).toBe("進階刀修練");
  });

  it("returns null for missing (id, level)", () => {
    expect(getSkillRow(13, 999)).toBeNull();
    expect(getSkillRow(9999999, 1)).toBeNull();
  });
});

describe("getSkillGroup", () => {
  it("returns only same-name rows for a shared id (id=13 刀修練 Lv1-10)", () => {
    // id=13 level 1-10 = 刀修練；level 11-15 = 進階刀修練 — 必須分開。
    const rows = getSkillGroup(13, "刀修練");
    expect(rows.length).toBe(10);
    expect(rows.every((r) => r.name === "刀修練")).toBe(true);
    expect(rows.map((r) => r.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe("getSkillsByClan", () => {
  it("returns 少林 skills excluding the given (id, name)", () => {
    const rows = getSkillsByClan("CLASS_SHAULIN", { id: 227, name: "龍牙拳" }, 10);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(10);
    expect(rows.every((r) => !(r.id === 227 && r.name === "龍牙拳"))).toBe(true);
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

describe("getSkills — sort", () => {
  it("sorts by maxLevel ascending", () => {
    const result = getSkills({ sortBy: "maxLevel", sortDir: "asc", pageSize: 20 });
    const levels = result.skills.map((s) => s.maxLevel);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    }
    const descResult = getSkills({ sortBy: "maxLevel", sortDir: "desc", pageSize: 20 });
    expect(result.skills[0].maxLevel).not.toBe(descResult.skills[0].maxLevel);
  });

  it("sorts by maxLevel descending", () => {
    const result = getSkills({ sortBy: "maxLevel", sortDir: "desc", pageSize: 20 });
    const levels = result.skills.map((s) => s.maxLevel);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeLessThanOrEqual(levels[i - 1]);
    }
  });

  it("stable across pages when sorted by maxLevel asc — no overlap or gap", () => {
    const p1 = getSkills({ sortBy: "maxLevel", sortDir: "asc", pageSize: 5, page: 1 });
    const p2 = getSkills({ sortBy: "maxLevel", sortDir: "asc", pageSize: 5, page: 2 });
    const p1Keys = new Set(p1.skills.map((s) => `${s.id}::${s.name}`));
    for (const s of p2.skills) expect(p1Keys.has(`${s.id}::${s.name}`)).toBe(false);
    const p1MaxLevel = Math.max(...p1.skills.map((s) => s.maxLevel));
    const p2MinLevel = Math.min(...p2.skills.map((s) => s.maxLevel));
    expect(p1MaxLevel).toBeLessThanOrEqual(p2MinLevel);
  });

  it("ignores invalid sortBy and falls back to default order", () => {
    const defaultResult = getSkills({ pageSize: 20 });
    const invalidResult = getSkills({ sortBy: "clan", pageSize: 20 });
    expect(invalidResult.skills.map((s) => `${s.id}::${s.name}`)).toEqual(
      defaultResult.skills.map((s) => `${s.id}::${s.name}`),
    );
  });
});
