import { describe, it, expect } from "vitest";
import { getItems } from "../items";
import { getSkills } from "../magic";
import { getMonsters } from "../monsters";

// unfilteredTotal 只在「有套篩選 + 篩完 0 筆」時才算，用來讓空狀態說出
// 「是篩選擋掉的，清掉會有 N 筆」。其餘情況必須是 undefined（不多跑 count）。
describe("unfilteredTotal gating", () => {
  it("is undefined when results exist", () => {
    expect(getItems({ search: "極品", pageSize: 5 }).unfilteredTotal).toBeUndefined();
    expect(getSkills({ pageSize: 5 }).unfilteredTotal).toBeUndefined();
    expect(getMonsters({ pageSize: 5 }).unfilteredTotal).toBeUndefined();
  });

  it("is undefined when 0 results but no filter active", () => {
    const gibberish = "zzz這串不可能存在zzz";
    expect(getItems({ search: gibberish }).total).toBe(0);
    expect(getItems({ search: gibberish }).unfilteredTotal).toBeUndefined();
    expect(getSkills({ search: gibberish }).unfilteredTotal).toBeUndefined();
    expect(getMonsters({ search: gibberish }).unfilteredTotal).toBeUndefined();
  });

  it("items: reports the unfiltered count when a type filter empties the results", () => {
    const unfiltered = getItems({ search: "極品", pageSize: 1 });
    expect(unfiltered.total).toBeGreaterThan(0);

    const overFiltered = getItems({ search: "極品", type: "__no_such_type__", pageSize: 1 });
    expect(overFiltered.total).toBe(0);
    expect(overFiltered.unfilteredTotal).toBe(unfiltered.total);
  });

  it("skills: reports the unfiltered count when a clan filter empties the results", () => {
    const unfiltered = getSkills({ search: "刀", pageSize: 1 });
    expect(unfiltered.total).toBeGreaterThan(0);

    const overFiltered = getSkills({ search: "刀", clan: "__no_such_clan__", pageSize: 1 });
    expect(overFiltered.total).toBe(0);
    expect(overFiltered.unfilteredTotal).toBe(unfiltered.total);
  });

  it("monsters: reports the unfiltered count when a level filter empties the results", () => {
    const unfiltered = getMonsters({ search: "蛇", pageSize: 1 });
    expect(unfiltered.total).toBeGreaterThan(0);

    // levelMin/levelMax 會被 clamp，用 elemental 這種自由字串才保證篩到 0 筆。
    const overFiltered = getMonsters({
      search: "蛇",
      elemental: "__no_such_elemental__",
      pageSize: 1,
    });
    expect(overFiltered.total).toBe(0);
    expect(overFiltered.unfilteredTotal).toBe(unfiltered.total);
  });

  it("monsters: baseline n.type > 0 is not treated as a user filter", () => {
    const gibberish = "zzz這串不可能存在zzz";
    const r = getMonsters({ search: gibberish });
    expect(r.total).toBe(0);
    expect(r.unfilteredTotal).toBeUndefined();
  });
});
