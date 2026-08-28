// @vitest-environment node
import Database from "better-sqlite3";
import { describe, it, expect } from "vitest";
import { diffDatabases, buildChangelogEntry } from "../diff";
import type { TableProfile } from "../types";

type DB = InstanceType<typeof Database>;

function makeDb(sql: string): DB {
  const d = new Database(":memory:");
  d.exec(sql);
  return d;
}

const itemsProfiles: Record<string, TableProfile> = {
  items: {
    tier: "rich",
    label: "道具",
    identity: ["id"],
    displayName: "name",
    fields: { name: "名稱", atk: "攻擊", value: "售價" },
  },
};

describe("diffDatabases — 核心", () => {
  it("依識別欄判定 added / removed / changed，白名單欄才算變更", () => {
    const old = makeDb(
      "CREATE TABLE items (id INTEGER, name TEXT, atk INTEGER, value INTEGER, note TEXT);" +
        "INSERT INTO items VALUES (1,'劍',10,100,'a'),(2,'盾',5,80,'b');",
    );
    const nw = makeDb(
      "CREATE TABLE items (id INTEGER, name TEXT, atk INTEGER, value INTEGER, note TEXT);" +
        // id1: atk 改(白名單) + note 改(非白名單)；id3 新增；id2 移除
        "INSERT INTO items VALUES (1,'劍',15,100,'CHANGED'),(3,'弓',12,90,'c');",
    );
    const diff = diffDatabases(old, nw, itemsProfiles);
    const t = diff.tables.find((x) => x.table === "items")!;
    expect(t.counts).toEqual({ added: 1, changed: 1, removed: 1 });
    expect(t.added?.[0]).toMatchObject({ idParts: ["3"], name: "弓" });
    expect(t.removed?.[0]).toMatchObject({ idParts: ["2"], name: "盾" });
    // note 非白名單 → 不出現；只有 atk
    expect(t.changed?.[0].fields).toEqual([{ col: "atk", label: "攻擊", from: "10", to: "15" }]);
    expect(diff.summary).toEqual({ added: 1, changed: 1, removed: 1 });
  });

  it("schema 變動的欄位進 structural、不進 row-level，只比交集欄", () => {
    const old = makeDb(
      "CREATE TABLE items (id INTEGER, name TEXT, atk INTEGER, def INTEGER);" +
        "INSERT INTO items VALUES (1,'劍',10,7);",
    );
    const nw = makeDb(
      "CREATE TABLE items (id INTEGER, name TEXT, atk INTEGER, extra_def INTEGER);" +
        "INSERT INTO items VALUES (1,'劍',10,9);", // def→extra_def 改名；atk/name 不變
    );
    const diff = diffDatabases(old, nw, itemsProfiles);
    const t = diff.tables.find((x) => x.table === "items")!;
    expect(t.structural).toEqual({ addedColumns: ["extra_def"], removedColumns: ["def"] });
    expect(t.counts).toEqual({ added: 0, changed: 0, removed: 0 }); // 改名欄不算變更
  });

  it("支援複合識別欄", () => {
    const profiles: Record<string, TableProfile> = {
      magic: { tier: "rich", label: "技能", identity: ["id", "level"], displayName: "name", fields: { name: "名稱", spend_mp: "耗魔" } },
    };
    const old = makeDb(
      "CREATE TABLE magic (id INTEGER, level INTEGER, name TEXT, spend_mp INTEGER);" +
        "INSERT INTO magic VALUES (100,1,'火球',5),(100,2,'火球',8);",
    );
    const nw = makeDb(
      "CREATE TABLE magic (id INTEGER, level INTEGER, name TEXT, spend_mp INTEGER);" +
        "INSERT INTO magic VALUES (100,1,'火球',5),(100,2,'火球',10);",
    );
    const diff = diffDatabases(old, nw, profiles);
    const t = diff.tables.find((x) => x.table === "magic")!;
    expect(t.counts).toEqual({ added: 0, changed: 1, removed: 0 });
    expect(t.changed?.[0].idParts).toEqual(["100", "2"]);
    expect(t.changed?.[0].fields).toEqual([{ col: "spend_mp", label: "耗魔", from: "8", to: "10" }]);
  });

  it("無識別欄 → 全列雜湊 multiset diff（added/removed，無 changed）", () => {
    // 無 profile、無宣告 pk
    const old = makeDb("CREATE TABLE blob (a INTEGER, b TEXT);INSERT INTO blob VALUES (1,'x'),(2,'y'),(2,'y');");
    const nw = makeDb("CREATE TABLE blob (a INTEGER, b TEXT);INSERT INTO blob VALUES (2,'y'),(3,'z');");
    const diff = diffDatabases(old, nw, {});
    const t = diff.tables.find((x) => x.table === "blob")!;
    expect(t.noIdentity).toBe(true);
    // old 有兩筆 (2,y)，new 一筆 → removed 1；(1,x) removed 1；(3,z) added 1
    expect(t.counts).toEqual({ added: 1, changed: 0, removed: 2 });
    expect(t.added).toBeUndefined();
  });
});

describe("diffDatabases — 系統性摺疊", () => {
  function build(rows: string): DB {
    return makeDb(
      "CREATE TABLE items (id INTEGER, name TEXT, atk INTEGER, value INTEGER);" + rows,
    );
  }

  it("單一 from→to 覆蓋 >90% 且 ≥100 筆 → 摺疊成 systematic，並從逐列明細移除", () => {
    // old: 150 筆 atk=0；new: 全部 atk=1，其中 id=1 另外 value 90→95
    const oldRows = "INSERT INTO items VALUES ";
    const newRows = "INSERT INTO items VALUES ";
    const parts: string[] = [];
    const partsNew: string[] = [];
    for (let i = 1; i <= 150; i++) {
      parts.push(`(${i},'x',0,90)`);
      partsNew.push(i === 1 ? `(${i},'x',1,95)` : `(${i},'x',1,90)`);
    }
    const old = build(oldRows + parts.join(",") + ";");
    const nw = build(newRows + partsNew.join(",") + ";");
    const diff = diffDatabases(old, nw, itemsProfiles);
    const t = diff.tables.find((x) => x.table === "items")!;
    expect(t.systematic).toEqual([{ col: "atk", label: "攻擊", from: "0", to: "1", count: 150 }]);
    // atk 被摺疊移除；只剩 id=1 因 value 變更而列入 changed
    expect(t.counts.changed).toBe(1);
    expect(t.changed?.[0].idParts).toEqual(["1"]);
    expect(t.changed?.[0].fields).toEqual([{ col: "value", label: "售價", from: "90", to: "95" }]);
  });

  it("同型變更未達 100 筆 → 不摺疊，逐列呈現", () => {
    const parts: string[] = [];
    const partsNew: string[] = [];
    for (let i = 1; i <= 50; i++) {
      parts.push(`(${i},'x',0,90)`);
      partsNew.push(`(${i},'x',1,90)`);
    }
    const old = build("INSERT INTO items VALUES " + parts.join(",") + ";");
    const nw = build("INSERT INTO items VALUES " + partsNew.join(",") + ";");
    const diff = diffDatabases(old, nw, itemsProfiles);
    const t = diff.tables.find((x) => x.table === "items")!;
    expect(t.systematic).toBeUndefined();
    expect(t.counts.changed).toBe(50);
  });
});

describe("diffDatabases — 防呆", () => {
  it("整表重建：added+removed 超過列數 50% → rebuilt，不逐列噴出", () => {
    const oldRows = "INSERT INTO t VALUES ";
    const newRows = "INSERT INTO t VALUES ";
    const o: string[] = [];
    const n: string[] = [];
    for (let i = 1; i <= 100; i++) o.push(`(${i})`);
    for (let i = 1; i <= 40; i++) n.push(`(${i})`); // 保留 40
    for (let i = 200; i <= 259; i++) n.push(`(${i})`); // 新增 60
    const old = makeDb("CREATE TABLE t (id INTEGER PRIMARY KEY);" + oldRows + o.join(",") + ";");
    const nw = makeDb("CREATE TABLE t (id INTEGER PRIMARY KEY);" + newRows + n.join(",") + ";");
    const diff = diffDatabases(old, nw, {});
    const t = diff.tables.find((x) => x.table === "t")!;
    expect(t.rebuilt).toBe(true);
    expect(t.counts).toEqual({ added: 60, changed: 0, removed: 60 });
    expect(t.added).toBeUndefined();
    expect(t.removed).toBeUndefined();
  });

  it("每表明細上限：超過 maxRowsPerTable 截斷並記 truncated", () => {
    const n: string[] = [];
    for (let i = 1; i <= 250; i++) n.push(`(${i},'x',1,1)`);
    const old = makeDb("CREATE TABLE items (id INTEGER, name TEXT, atk INTEGER, value INTEGER);");
    const nw = makeDb(
      "CREATE TABLE items (id INTEGER, name TEXT, atk INTEGER, value INTEGER);INSERT INTO items VALUES " +
        n.join(",") + ";",
    );
    // rebuildRatio 調高避免觸發重建（全新增本會觸發）
    const diff = diffDatabases(old, nw, itemsProfiles, { rebuildRatio: 2 });
    const t = diff.tables.find((x) => x.table === "items")!;
    expect(t.counts.added).toBe(250);
    expect(t.added?.length).toBe(200);
    expect(t.addedTruncated).toBe(50);
  });
});

describe("buildChangelogEntry", () => {
  it("無差異回 null", () => {
    const a = makeDb("CREATE TABLE items (id INTEGER, name TEXT, atk INTEGER, value INTEGER);INSERT INTO items VALUES (1,'劍',10,100);");
    const b = makeDb("CREATE TABLE items (id INTEGER, name TEXT, atk INTEGER, value INTEGER);INSERT INTO items VALUES (1,'劍',10,100);");
    const diff = diffDatabases(a, b, itemsProfiles);
    expect(buildChangelogEntry(diff, { version: "1.0", date: "2026-07-08" })).toBeNull();
  });

  it("有差異回帶 meta 的 entry", () => {
    const a = makeDb("CREATE TABLE items (id INTEGER, name TEXT, atk INTEGER, value INTEGER);INSERT INTO items VALUES (1,'劍',10,100);");
    const b = makeDb("CREATE TABLE items (id INTEGER, name TEXT, atk INTEGER, value INTEGER);INSERT INTO items VALUES (1,'劍',20,100);");
    const diff = diffDatabases(a, b, itemsProfiles);
    const entry = buildChangelogEntry(diff, { version: "1.1", date: "2026-07-08", note: "測試" });
    expect(entry).not.toBeNull();
    expect(entry!.version).toBe("1.1");
    expect(entry!.note).toBe("測試");
    expect(entry!.summary.changed).toBe(1);
  });
});

describe("diffDatabases — rich added/removed 帶 surfaced fields", () => {
  const boxProfiles: Record<string, TableProfile> = {
    items: {
      tier: "rich",
      label: "道具",
      identity: ["id"],
      displayName: "name",
      fields: { name: "名稱", summary: "說明", value: "售價" },
    },
  };

  it("rich 新增列帶白名單欄現值（含說明），值套長字串截斷，識別欄不列入", () => {
    const old = makeDb("CREATE TABLE items (id INTEGER, name TEXT, summary TEXT, value INTEGER);");
    const long = "開箱可得".repeat(40); // 160 字 > 120
    const nw = makeDb(
      "CREATE TABLE items (id INTEGER, name TEXT, summary TEXT, value INTEGER);" +
        `INSERT INTO items VALUES (10,'端午禮盒','${long}',500);`,
    );
    // rebuildRatio 調高避免「全新增」觸發整表重建
    const diff = diffDatabases(old, nw, boxProfiles, { rebuildRatio: 2 });
    const t = diff.tables.find((x) => x.table === "items")!;
    const box = t.added![0];
    expect(box.name).toBe("端午禮盒");
    const summary = box.fields!.find((f) => f.col === "summary")!;
    expect(summary.label).toBe("說明");
    expect(summary.value.endsWith("…")).toBe(true);
    expect(summary.value.length).toBe(121); // 120 + "…"
    expect(box.fields!.find((f) => f.col === "value")!.value).toBe("500");
    expect(box.fields!.some((f) => f.col === "id")).toBe(false); // 識別欄排除
  });

  it("空值欄不列入 fields", () => {
    const old = makeDb("CREATE TABLE items (id INTEGER, name TEXT, summary TEXT, value INTEGER);");
    const nw = makeDb(
      "CREATE TABLE items (id INTEGER, name TEXT, summary TEXT, value INTEGER);" +
        "INSERT INTO items VALUES (11,'素坯',NULL,0);",
    );
    const diff = diffDatabases(old, nw, boxProfiles, { rebuildRatio: 2 });
    const box = diff.tables.find((x) => x.table === "items")!.added![0];
    expect(box.fields!.some((f) => f.col === "summary")).toBe(false); // NULL 略過
    expect(box.fields!.find((f) => f.col === "value")!.value).toBe("0"); // 0 非空，保留
  });
});

describe("diffDatabases — 整表新增／移除帶標籤與列數", () => {
  const profiles: Record<string, TableProfile> = {
    achievements: { tier: "count", label: "成就", identity: ["id"] },
  };

  it("新表 → addedTables 帶 label（PROFILES）與列數；無設定表回退機器鍵", () => {
    const old = makeDb("CREATE TABLE items (id INTEGER, name TEXT);INSERT INTO items VALUES (1,'劍');");
    const nw = makeDb(
      "CREATE TABLE items (id INTEGER, name TEXT);INSERT INTO items VALUES (1,'劍');" +
        "CREATE TABLE achievements (id INTEGER, name TEXT);INSERT INTO achievements VALUES (1,'a'),(2,'b'),(3,'c');" +
        "CREATE TABLE mystery (id INTEGER);INSERT INTO mystery VALUES (1);",
    );
    const diff = diffDatabases(old, nw, profiles);
    expect(diff.addedTables).toEqual(
      expect.arrayContaining([
        { table: "achievements", label: "成就", rows: 3 },
        { table: "mystery", label: "mystery", rows: 1 }, // 無 PROFILES → 回退機器鍵
      ]),
    );
    expect(diff.addedTables).toHaveLength(2);
    expect(diff.removedTables).toEqual([]);
  });

  it("移除表 → removedTables 帶舊 DB 列數", () => {
    const old = makeDb(
      "CREATE TABLE items (id INTEGER);INSERT INTO items VALUES (1);" +
        "CREATE TABLE achievements (id INTEGER);INSERT INTO achievements VALUES (1),(2);",
    );
    const nw = makeDb("CREATE TABLE items (id INTEGER);INSERT INTO items VALUES (1);");
    const diff = diffDatabases(old, nw, profiles);
    expect(diff.removedTables).toEqual([{ table: "achievements", label: "成就", rows: 2 }]);
    expect(diff.addedTables).toEqual([]);
  });
});
