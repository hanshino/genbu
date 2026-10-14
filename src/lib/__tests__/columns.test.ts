import { describe, it, expect } from "vitest";
import { defineColumnSet, parseColumns, isDefaultColumns, resolveColumns } from "../columns";

const SET = defineColumnSet({
  cookie: "test_cols",
  base: [
    { key: "id", label: "編號" },
    { key: "level", label: "等級" },
  ],
  numeric: [
    { key: "atk", label: "物攻" },
    { key: "hp", label: "體力" },
  ],
});

describe("column set helpers", () => {
  it("defaults = base columns, keys = base + numeric in order", () => {
    expect(SET.defaults).toEqual(["id", "level"]);
    expect(SET.keys).toEqual(["id", "level", "atk", "hp"]);
  });

  it("parseColumns drops unknown keys and returns definition order", () => {
    expect(parseColumns(SET, "hp,bogus,id")).toEqual(["id", "hp"]);
    expect(parseColumns(SET, "")).toBeNull();
    expect(parseColumns(SET, "bogus")).toBeNull();
  });

  it("isDefaultColumns ignores order", () => {
    expect(isDefaultColumns(SET, ["level", "id"])).toBe(true);
    expect(isDefaultColumns(SET, ["id"])).toBe(false);
  });

  it("resolveColumns: URL > cookie > default; invalid layer falls through", () => {
    expect(resolveColumns(SET, "atk", "hp")).toEqual(["atk"]);
    expect(resolveColumns(SET, "bogus", "hp")).toEqual(["hp"]);
    expect(resolveColumns(SET, undefined, "nope")).toEqual(["id", "level"]);
  });
});
