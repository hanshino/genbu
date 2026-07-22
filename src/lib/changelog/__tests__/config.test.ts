import { describe, it, expect } from "vitest";
import { PROFILES, EXCLUDE } from "../config";

describe("changelog config", () => {
  it("每個 profile 都有非空 identity 與 label", () => {
    for (const [table, p] of Object.entries(PROFILES)) {
      expect(p.identity.length, `${table} identity`).toBeGreaterThan(0);
      expect(p.label.length, `${table} label`).toBeGreaterThan(0);
    }
  });

  it("rich profile 一定要有 fields 白名單", () => {
    for (const [table, p] of Object.entries(PROFILES)) {
      if (p.tier === "rich") {
        expect(p.fields, `${table} fields`).toBeDefined();
        expect(Object.keys(p.fields!).length).toBeGreaterThan(0);
      }
    }
  });

  it("EXCLUDE 至少擋掉 knex_migrations", () => {
    expect(EXCLUDE.has("knex_migrations")).toBe(true);
  });
});
