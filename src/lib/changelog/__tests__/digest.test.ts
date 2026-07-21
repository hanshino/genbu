// @vitest-environment node
import Database from "better-sqlite3";
import { describe, it, expect } from "vitest";
import { diffDatabases } from "../diff";
import { digestForAI } from "../digest";
import type { TableProfile } from "../types";

type DB = InstanceType<typeof Database>;
function makeDb(sql: string): DB {
  const d = new Database(":memory:");
  d.exec(sql);
  return d;
}

const profiles: Record<string, TableProfile> = {
  items: {
    tier: "rich",
    label: "道具",
    identity: ["id"],
    displayName: "name",
    fields: { name: "名稱", summary: "說明", value: "售價", atk: "攻擊" },
  },
};

describe("digestForAI", () => {
  it("新增列樣本帶 label→value（含說明）", () => {
    const old = makeDb("CREATE TABLE items (id INTEGER, name TEXT, summary TEXT, value INTEGER, atk INTEGER);");
    const nw = makeDb(
      "CREATE TABLE items (id INTEGER, name TEXT, summary TEXT, value INTEGER, atk INTEGER);" +
        "INSERT INTO items VALUES (1,'端午禮盒','開箱可得晝夢冥鰩',500,0);",
    );
    const dg = digestForAI(diffDatabases(old, nw, profiles, { rebuildRatio: 2 }));
    const t = dg.tables.find((x) => x.table === "items")!;
    expect(t.addedSample![0]).toEqual({ name: "端午禮盒", fields: { 名稱: "端午禮盒", 說明: "開箱可得晝夢冥鰩", 售價: "500", 攻擊: "0" } });
  });

  it("新增列樣本有界（>40 截斷並記 truncated）", () => {
    const rows: string[] = [];
    for (let i = 1; i <= 60; i++) rows.push(`(${i},'x','',1,1)`);
    const old = makeDb("CREATE TABLE items (id INTEGER, name TEXT, summary TEXT, value INTEGER, atk INTEGER);");
    const nw = makeDb(
      "CREATE TABLE items (id INTEGER, name TEXT, summary TEXT, value INTEGER, atk INTEGER);INSERT INTO items VALUES " +
        rows.join(",") + ";",
    );
    const dg = digestForAI(diffDatabases(old, nw, profiles, { rebuildRatio: 2 }));
    const t = dg.tables.find((x) => x.table === "items")!;
    expect(t.counts.added).toBe(60); // 計數為全量
    expect(t.addedSample!.length).toBe(40); // 樣本有界
    expect(t.addedSampleTruncated).toBe(20);
  });

  it("changedFieldCounts 統計各欄；changedSample 優先挑非批量欄的列", () => {
    // 150 筆只改 value（批量）；id=1 另改 name（非批量）
    const o: string[] = [];
    const n: string[] = [];
    for (let i = 1; i <= 150; i++) {
      o.push(`(${i},'x','',90,0)`);
      n.push(i === 1 ? `(1,'新名','',95,0)` : `(${i},'x','',95,0)`);
    }
    const old = makeDb("CREATE TABLE items (id INTEGER, name TEXT, summary TEXT, value INTEGER, atk INTEGER);INSERT INTO items VALUES " + o.join(",") + ";");
    const nw = makeDb("CREATE TABLE items (id INTEGER, name TEXT, summary TEXT, value INTEGER, atk INTEGER);INSERT INTO items VALUES " + n.join(",") + ";");
    const dg = digestForAI(diffDatabases(old, nw, profiles));
    const t = dg.tables.find((x) => x.table === "items")!;
    // value 未達系統性摺疊（不是 >90% 同一 from→to？90→95 全體同型且 ≥100 → 會摺疊）
    // 故 value 進 systematic，changed 只剩 id=1（name+? ）
    expect(t.systematic?.some((s) => s.label === "售價")).toBe(true);
    expect(t.changedFieldCounts).toEqual({ 名稱: 1 });
    expect(t.changedSample![0].fields.some((f) => f.label === "名稱")).toBe(true);
  });

  it("structural 只給欄數，不外洩欄名", () => {
    const old = makeDb("CREATE TABLE items (id INTEGER, name TEXT, def INTEGER);INSERT INTO items VALUES (1,'劍',7);");
    const nw = makeDb("CREATE TABLE items (id INTEGER, name TEXT, extra_def INTEGER);INSERT INTO items VALUES (1,'劍',9);");
    const dg = digestForAI(diffDatabases(old, nw, profiles));
    const t = dg.tables.find((x) => x.table === "items")!;
    expect(t.structural).toEqual({ addedColumns: 1, removedColumns: 1 });
  });

  it("0 值欄位被完整保留（不過濾零值）", () => {
    const old = makeDb("CREATE TABLE items (id INTEGER, name TEXT, summary TEXT, value INTEGER, atk INTEGER);");
    const nw = makeDb(
      "CREATE TABLE items (id INTEGER, name TEXT, summary TEXT, value INTEGER, atk INTEGER);" +
        "INSERT INTO items VALUES (1,'便宜貨','無用',0,0);",
    );
    const dg = digestForAI(diffDatabases(old, nw, profiles, { rebuildRatio: 2 }));
    const t = dg.tables.find((x) => x.table === "items")!;
    // 售價 = 0 和 攻擊 = 0 都應被保留
    expect(t.addedSample![0].fields).toEqual({
      名稱: "便宜貨",
      說明: "無用",
      售價: "0",
      攻擊: "0",
    });
  });
});
