// @vitest-environment node
import { describe, it, expect } from "vitest";
import { getHighlights, getTableMode, getTableNote } from "../present";
import type { ChangelogEntry } from "../types";

function base(): ChangelogEntry {
  return { version: "1", date: "2026-07-22", summary: { added: 0, changed: 0, removed: 0 }, addedTables: [], removedTables: [], tables: [] };
}

describe("present helpers", () => {
  it("ai 缺席：highlights 空、所有表 detail", () => {
    const e = base();
    expect(getHighlights(e)).toEqual([]);
    expect(getTableMode(e, "items")).toBe("detail");
    expect(getTableNote(e, "items")).toBeUndefined();
  });

  it("ai 存在：讀 highlights 與逐表 mode/note；未列的表退 detail", () => {
    const e: ChangelogEntry = {
      ...base(),
      ai: { model: "m", highlights: ["重點一"], tables: { items: { mode: "summary", note: "售價批量" } } },
    };
    expect(getHighlights(e)).toEqual(["重點一"]);
    expect(getTableMode(e, "items")).toBe("summary");
    expect(getTableNote(e, "items")).toBe("售價批量");
    expect(getTableMode(e, "npc")).toBe("detail"); // 未列 → detail
  });
});
