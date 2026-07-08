// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadChangelog } from "../load";
import type { ChangelogEntry } from "../types";

let dir: string;

function entry(version: string, date: string): ChangelogEntry {
  return {
    version,
    date,
    summary: { added: 0, changed: 0, removed: 0 },
    addedTables: [],
    removedTables: [],
    tables: [],
  };
}

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "changelog-test-"));
  fs.writeFileSync(path.join(dir, "2026-07-01-v1.0.json"), JSON.stringify(entry("1.0", "2026-07-01")));
  fs.writeFileSync(path.join(dir, "2026-07-08-v1.2.json"), JSON.stringify(entry("1.2", "2026-07-08")));
  fs.writeFileSync(path.join(dir, "2026-07-08-v1.1.json"), JSON.stringify(entry("1.1", "2026-07-08")));
  fs.writeFileSync(path.join(dir, "README.txt"), "ignore me"); // 非 .json 應被忽略
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("loadChangelog", () => {
  it("依日期新→舊、同日期版本降序排序，只讀 .json", () => {
    const list = loadChangelog(dir);
    expect(list.map((e) => `${e.date}-v${e.version}`)).toEqual([
      "2026-07-08-v1.2",
      "2026-07-08-v1.1",
      "2026-07-01-v1.0",
    ]);
  });

  it("目錄不存在回空陣列", () => {
    expect(loadChangelog(path.join(dir, "nope"))).toEqual([]);
  });
});
