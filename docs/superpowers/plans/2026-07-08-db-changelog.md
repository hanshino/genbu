# tthol.sqlite 版本差異 → 公開更新日誌 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每次覆蓋 `tthol.sqlite` 前，本地跑一支 CLI 算出新舊 DB 的語意差異、對齊手動輸入的版本號、產出 committed JSON 快照，並在網站 `/changelog` 頁把每次更新做成玩家可讀的分層更新日誌。

**Architecture:** 純函式 diff 引擎（`src/lib/changelog/{types,config,diff}.ts`，不含任何 Next/DOM/alias 相依）被兩個消費端共用：一支 `tsx` CLI（`scripts/db-changelog.ts`，讀 `git show HEAD:tthol.sqlite` 舊 blob vs 工作區新檔，寫 `src/data/changelog/<date>-v<version>.json`）與一個**靜態渲染**的 Server Component 頁面（`src/app/changelog/page.tsx`，build 時讀 JSON）。引擎在記憶體 better-sqlite3 上做單元測試。

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict, `moduleResolution: bundler`) · better-sqlite3 12 · vitest 4 (jsdom；引擎測試用 `node` 環境) · tsx (新增，跑 TS CLI) · Tailwind 4 + shadcn/ui。

## Global Constraints

這些是全專案規則，每個 task 的需求都隱含包含本節：

- **設計來源**：所有行為以已核准的 spec 為準 —— `docs/superpowers/specs/2026-07-08-db-changelog-design.md`。有出入以本 plan 的程式碼為準。
- **`tthol.sqlite` 唯讀**：永不修改、永不寫入該檔；只以 `{ readonly: true }` 開啟。
- **引擎純淨**：`src/lib/changelog/types.ts`、`config.ts`、`diff.ts` **不得** import 任何 Next.js、React、DOM、`node:fs` 以外的 I/O，或 `@/` 別名。彼此之間只用**相對路徑**（`./types` 等）import，`better-sqlite3` 僅以 `import type` 引入（型別會在編譯時被抹除，不產生 runtime 相依）。這是讓引擎能同時被 tsx CLI 與 Next 頁面共用的前提。
- **CLI 用相對 import**：`scripts/db-changelog.ts` 以相對路徑（`../src/lib/changelog/...`）import 引擎，不用 `@/` 別名（`tsx` 不解析 tsconfig paths）。`@/` 別名只留給 `src/app`、`src/components` 下的 Next 程式碼。
- **`/changelog` 必須靜態**：頁面 `export const dynamic = "force-static"`，且**不使用任何 dynamic API**（`cookies`/`headers`/動態 `searchParams`）。正式機是 Next `output: "standalone"`，runner 內沒有 `src/` 目錄，所有 `fs` 讀取只能發生在 build 階段。
- **zh-tw**：所有面向使用者的文字用繁體中文。
- **shadcn-first**：UI 先用 `src/components/ui/` 既有元件（`Card`/`Badge`/`Collapsible`/`Table`）；圖示一律用 `lucide-react`，**禁用** Unicode 符號字元（`×`/`▾`/`✓`）與 emoji。數值前後綴（`+` / `~` / `−`）屬內容文字非圖示，可直接寫在字串裡（`−` 用 U+2212 減號）。
- **Server Component 預設**：只有需要互動（Collapsible 展開）的元件才加 `"use client"`。
- **commit 訊息結尾**：每個 commit 訊息都以下面兩行結尾（與 repo 慣例一致）：
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0161aNv2Kvhm1L1fnoqNjVNc
  ```
- **分支**：在 `feat/db-changelog` 上工作（spec 已於此分支，HEAD `9e1affd`）。

---

## File Structure

| 檔案 | 責任 | Task |
|---|---|---|
| `src/lib/changelog/types.ts` | 所有型別（`TableProfile`/`TableDiff`/`DbDiff`/`ChangelogEntry`/`DiffOptions`…） | 1 |
| `src/lib/changelog/config.ts` | `EXCLUDE` 集合 + `PROFILES` 逐表設定檔（單一事實來源，使用者可增刪標籤） | 1 |
| `src/lib/changelog/diff.ts` | 純函式引擎：`diffDatabases()` + `buildChangelogEntry()` | 2 |
| `src/lib/changelog/__tests__/diff.test.ts` | 引擎單元測試（記憶體 DB） | 2 |
| `scripts/db-changelog.ts` | tsx CLI：取舊 blob、跑 diff、寫 JSON、印摘要 | 3 |
| `package.json` | 加 `changelog` script + `tsx` devDependency | 3 |
| `src/lib/changelog/load.ts` | build 時讀 `src/data/changelog/*.json`、依日期新→舊排序 | 4 |
| `src/lib/changelog/__tests__/load.test.ts` | loader 單元測試（fixture 目錄） | 4 |
| `src/data/changelog/.gitkeep` | 確保資料夾存在（loader 對缺目錄已容錯） | 4 |
| `src/app/changelog/page.tsx` | 靜態 Server Component 頁面 | 5 |
| `src/components/changelog/version-card.tsx` | Server：一版一張 Card；用 config 算 detailRoute href | 5 |
| `src/components/changelog/summary-badges.tsx` | Server：+新增 / ~變更 / −下架 badge 列 | 5 |
| `src/components/changelog/table-section.tsx` | Client：每表可收合區塊 | 5 |
| `src/components/layout/navbar.tsx` | 加「更新紀錄」連結（修改既有） | 5 |

依賴順序：Task 1 → 2 → 3；Task 4 → 5。Task 3 與 Task 4/5 皆依賴 Task 1/2 的型別與引擎，彼此獨立。

---

## Task 1: 型別與表設定檔

**Files:**
- Create: `src/lib/changelog/types.ts`
- Create: `src/lib/changelog/config.ts`
- Test: `src/lib/changelog/__tests__/config.test.ts`

**Interfaces:**
- Consumes: 無（基礎層）。
- Produces:
  - `types.ts` 匯出 interface：`TableProfile`、`FieldChange`、`RowRef`、`RowChange`、`SystematicChange`、`TableDiff`、`DbDiff`、`ChangelogEntry`、`DiffOptions`。
  - `config.ts` 匯出 `const EXCLUDE: Set<string>`、`const PROFILES: Record<string, TableProfile>`。

- [ ] **Step 1: 寫型別檔**

Create `src/lib/changelog/types.ts`:

```ts
// 更新日誌 diff 引擎共用型別。刻意不 import 任何 runtime 相依，
// 讓 tsx CLI 與 Next 頁面都能安全引入。

export interface TableProfile {
  tier: "rich" | "count"; // 精華層（逐欄明細+深連）/ 計數層（只計數）
  label: string; // zh-tw 顯示名，如 "道具"
  identity: string[]; // 識別欄（覆寫自動偵測）；空陣列 → 引擎改用全列雜湊 fallback
  displayName?: string; // 顯示名稱欄
  fields?: Record<string, string>; // rich 專用白名單：欄名 → zh-tw 標籤；其餘欄一律忽略
  detailRoute?: (idParts: string[]) => string; // rich 專用：深連詳情頁；收識別欄陣列
}

export interface FieldChange {
  col: string;
  label: string;
  from: string;
  to: string;
}

export interface RowRef {
  idParts: string[]; // 原始識別欄值（不含控制字元）
  name?: string;
}

export interface RowChange extends RowRef {
  fields: FieldChange[];
}

export interface SystematicChange {
  col: string;
  label: string;
  from: string;
  to: string;
  count: number;
}

export interface TableDiff {
  table: string;
  label: string;
  tier: "rich" | "count";
  counts: { added: number; changed: number; removed: number };
  structural?: { addedColumns: string[]; removedColumns: string[] };
  systematic?: SystematicChange[];
  added?: RowRef[];
  removed?: RowRef[];
  changed?: RowChange[];
  addedTruncated?: number;
  removedTruncated?: number;
  changedTruncated?: number;
  noIdentity?: boolean; // 無識別欄 → 全列雜湊 multiset diff
  rebuilt?: boolean; // 整表重建防呆觸發
}

export interface DbDiff {
  addedTables: string[];
  removedTables: string[];
  tables: TableDiff[]; // 有變動的表才收錄，rich（core 最前）排前
  summary: { added: number; changed: number; removed: number };
}

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  note?: string;
  summary: { added: number; changed: number; removed: number };
  addedTables: string[];
  removedTables: string[];
  tables: TableDiff[];
}

export interface DiffOptions {
  maxRowsPerTable?: number; // 每表明細上限，預設 200
  maxStringLen?: number; // 長字串輸出截斷，預設 120
  systematicMinCount?: number; // 系統性摺疊絕對筆數門檻，預設 100
  systematicCoverage?: number; // 系統性摺疊覆蓋率門檻，預設 0.9
  systematicMaxDistinct?: number; // 系統性摺疊 distinct 配對上限，預設 3
  rebuildRatio?: number; // 整表重建門檻（added+removed 佔比），預設 0.5
  rebuildMinRows?: number; // 觸發整表重建的最小列數門檻，預設 50（避免小表誤觸）
}
```

- [ ] **Step 2: 寫設定檔**

Create `src/lib/changelog/config.ts`（欄位標籤是初版建議，使用者日後可增刪）:

```ts
import type { TableProfile } from "./types";

// 內部/遷移表一律排除；sqlite_* 由引擎額外過濾。
export const EXCLUDE = new Set(["knex_migrations", "knex_migrations_lock"]);

export const PROFILES: Record<string, TableProfile> = {
  items: {
    tier: "rich",
    label: "道具",
    identity: ["id"],
    displayName: "name",
    fields: {
      name: "名稱",
      summary: "說明",
      value: "售價",
      atk: "攻擊",
      matk: "法攻",
      extra_def: "防禦",
      magic_def: "法防",
      hp: "HP",
      mp: "MP",
      hit: "命中",
      dodge: "迴避",
      str: "力",
      pow: "氣",
      vit: "體",
      dex: "技",
      agi: "敏",
      wis: "智",
      damage_min: "傷害下限",
      damage_max: "傷害上限",
      base_lv: "需求等級",
      type_name: "類型",
    },
    detailRoute: (idParts) => `/items/${idParts[0]}`,
  },
  magic: {
    tier: "rich",
    label: "技能",
    identity: ["id", "level"],
    displayName: "name",
    fields: { name: "名稱", help: "說明", spend_mp: "耗魔", target: "目標", clan: "門派" },
    detailRoute: (idParts) => `/skills/${idParts[0]}`, // idParts = [id, level]
  },
  monsters: {
    tier: "rich",
    label: "怪物",
    identity: ["id"],
    displayName: "name",
    fields: {
      name: "名稱",
      level: "等級",
      hp: "HP",
      extra_def: "防禦",
      damage_min: "傷害下限",
      damage_max: "傷害上限",
      drop_exp: "經驗",
    },
    detailRoute: (idParts) => `/monsters/${idParts[0]}`,
  },
  item_rand: {
    tier: "rich",
    label: "裝備隨機屬性",
    identity: ["id", "attribute"], // 一件裝備多列（每屬性一列）
    displayName: "attribute",
    fields: { min: "最小值", max: "最大值", rate: "機率" },
    detailRoute: (idParts) => `/items/${idParts[0]}`, // idParts = [id, attribute]
  },
  missions: {
    tier: "rich",
    label: "任務",
    identity: ["id"],
    displayName: "name",
    fields: { name: "名稱", help: "說明" },
    detailRoute: (idParts) => `/missions/${idParts[0]}`,
  },
  mission_steps: {
    tier: "rich",
    label: "任務步驟",
    identity: ["mission_id", "step_index"],
    fields: { plain_text: "步驟文字" },
  },
  npc: {
    tier: "rich",
    label: "NPC",
    identity: ["id"],
    displayName: "name",
    fields: { name: "名稱", level: "等級" },
  },
  npc_strings: {
    tier: "rich",
    label: "NPC 對話",
    identity: ["id"],
    displayName: "name",
    fields: { name: "顯示名" },
  },
  message_options: {
    tier: "rich",
    label: "對話選項",
    identity: ["file_no", "msg_id", "opt_index"],
    displayName: "text",
    fields: { text: "選項文字" },
  },

  // 計數層（只顯示 +N ~N −N）
  messages: { tier: "count", label: "對話訊息", identity: ["file_no", "msg_id"] },
  mission_refs: { tier: "count", label: "任務關聯", identity: ["id"] },
  map_warps: { tier: "count", label: "地圖傳送點", identity: ["id"] },
};
```

- [ ] **Step 3: 寫設定檔健全性測試**

Create `src/lib/changelog/__tests__/config.test.ts`:

```ts
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
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test -- src/lib/changelog/__tests__/config.test.ts`
Expected: 3 tests PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/changelog/types.ts src/lib/changelog/config.ts src/lib/changelog/__tests__/config.test.ts
git commit
```
Commit 訊息（記得加 Global Constraints 的 trailer）：`feat(changelog): add diff engine types and per-table config`

---

## Task 2: 純函式 diff 引擎

**Files:**
- Create: `src/lib/changelog/diff.ts`
- Test: `src/lib/changelog/__tests__/diff.test.ts`

**Interfaces:**
- Consumes: `./types`（Task 1 全部型別）、`./config` 的 `EXCLUDE`；`import type BetterSqlite3 from "better-sqlite3"`。
- Produces:
  - `diffDatabases(oldDb: BetterSqlite3.Database, newDb: BetterSqlite3.Database, profiles: Record<string, TableProfile>, opts?: DiffOptions): DbDiff`
  - `buildChangelogEntry(diff: DbDiff, meta: { version: string; date: string; note?: string }): ChangelogEntry | null`（無差異回 `null`）

- [ ] **Step 1: 寫引擎測試（涵蓋全部行為）**

Create `src/lib/changelog/__tests__/diff.test.ts`。用記憶體 DB，`node` 環境避免 jsdom 干擾原生模組：

```ts
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
    let oldRows = "INSERT INTO items VALUES ";
    let newRows = "INSERT INTO items VALUES ";
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
    let oldRows = "INSERT INTO t VALUES ";
    let newRows = "INSERT INTO t VALUES ";
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test -- src/lib/changelog/__tests__/diff.test.ts`
Expected: FAIL —— `Failed to resolve import "../diff"`（檔案尚未建立）。

> 若出現 `better-sqlite3` 載入/ESM 相關錯誤（而非上面的 resolve 錯誤），在 `vitest.config.ts` 的 `test` 物件加一行 `server: { deps: { external: ["better-sqlite3"] } }` 後再跑。

- [ ] **Step 3: 寫引擎**

Create `src/lib/changelog/diff.ts`:

```ts
import type BetterSqlite3 from "better-sqlite3";
import type {
  DbDiff,
  TableDiff,
  TableProfile,
  DiffOptions,
  RowRef,
  RowChange,
  FieldChange,
  SystematicChange,
  ChangelogEntry,
} from "./types";
import { EXCLUDE } from "./config";

type DB = BetterSqlite3.Database;
type Row = Record<string, unknown>;

const SEP = "\x01"; // identityKey 內部分隔符；不外洩到 JSON

const DEFAULTS: Required<DiffOptions> = {
  maxRowsPerTable: 200,
  maxStringLen: 120,
  systematicMinCount: 100,
  systematicCoverage: 0.9,
  systematicMaxDistinct: 3,
  rebuildRatio: 0.5,
  rebuildMinRows: 50,
};

const CORE_TABLES = new Set(["items", "magic", "monsters"]);

function listTables(db: DB): string[] {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all() as { name: string }[];
  return rows.map((r) => r.name).filter((n) => !EXCLUDE.has(n) && !n.startsWith("sqlite_"));
}

function schemaOf(db: DB, table: string): { names: string[]; pk: string[] } {
  const info = db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string; pk: number }[];
  const names = info.map((c) => c.name);
  const pk = info
    .filter((c) => c.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((c) => c.name);
  return { names, pk };
}

function norm(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function loadRows(db: DB, table: string): Row[] {
  return db.prepare(`SELECT * FROM "${table}"`).all() as Row[];
}

function rowRef(row: Row, identity: string[], profile: TableProfile | undefined, maxStringLen: number): RowRef {
  const ref: RowRef = { idParts: identity.map((c) => norm(row[c])) };
  const dn = profile?.displayName;
  if (dn && row[dn] != null && row[dn] !== "") ref.name = truncate(norm(row[dn]), maxStringLen);
  return ref;
}

function multisetDiff(oldRows: Row[], newRows: Row[], cols: string[]): { added: number; removed: number } {
  const hash = (r: Row) => cols.map((c) => norm(r[c])).join(SEP);
  const oldC = new Map<string, number>();
  for (const r of oldRows) {
    const k = hash(r);
    oldC.set(k, (oldC.get(k) ?? 0) + 1);
  }
  const newC = new Map<string, number>();
  for (const r of newRows) {
    const k = hash(r);
    newC.set(k, (newC.get(k) ?? 0) + 1);
  }
  let added = 0;
  let removed = 0;
  for (const [k, n] of newC) {
    const ol = oldC.get(k) ?? 0;
    if (n > ol) added += n - ol;
  }
  for (const [k, ol] of oldC) {
    const n = newC.get(k) ?? 0;
    if (ol > n) removed += ol - n;
  }
  return { added, removed };
}

function diffTable(
  oldDb: DB,
  newDb: DB,
  table: string,
  profile: TableProfile | undefined,
  o: Required<DiffOptions>,
): TableDiff {
  const label = profile?.label ?? table;
  const tier: "rich" | "count" = profile?.tier ?? "count";

  const oldSchema = schemaOf(oldDb, table);
  const newSchema = schemaOf(newDb, table);
  const oldColSet = new Set(oldSchema.names);
  const newColSet = new Set(newSchema.names);
  const addedColumns = newSchema.names.filter((c) => !oldColSet.has(c));
  const removedColumns = oldSchema.names.filter((c) => !newColSet.has(c));
  const sharedCols = newSchema.names.filter((c) => oldColSet.has(c));

  const td: TableDiff = { table, label, tier, counts: { added: 0, changed: 0, removed: 0 } };
  if (addedColumns.length || removedColumns.length) {
    td.structural = { addedColumns, removedColumns };
  }

  let identity = profile?.identity ?? [];
  if (identity.length === 0) identity = newSchema.pk;
  const identityUsable =
    identity.length > 0 && identity.every((c) => oldColSet.has(c) && newColSet.has(c));

  const oldRows = loadRows(oldDb, table);
  const newRows = loadRows(newDb, table);

  if (!identityUsable) {
    const { added, removed } = multisetDiff(oldRows, newRows, sharedCols);
    td.noIdentity = true;
    td.counts = { added, changed: 0, removed };
    return td;
  }

  const keyOf = (r: Row) => identity.map((c) => norm(r[c])).join(SEP);
  const oldMap = new Map<string, Row>();
  for (const r of oldRows) oldMap.set(keyOf(r), r);
  const newMap = new Map<string, Row>();
  for (const r of newRows) newMap.set(keyOf(r), r);

  const addedRows: Row[] = [];
  const removedRows: Row[] = [];
  for (const [k, r] of newMap) if (!oldMap.has(k)) addedRows.push(r);
  for (const [k, r] of oldMap) if (!newMap.has(k)) removedRows.push(r);

  // 整表重建防呆（兩層皆適用）
  const totalRows = Math.max(oldRows.length, newRows.length);
  if (totalRows >= o.rebuildMinRows && (addedRows.length + removedRows.length) / totalRows > o.rebuildRatio) {
    td.rebuilt = true;
    td.counts = { added: addedRows.length, changed: 0, removed: removedRows.length };
    return td;
  }

  const surfaced =
    tier === "rich" && profile?.fields
      ? sharedCols.filter((c) => c in profile.fields! && !identity.includes(c))
      : sharedCols.filter((c) => !identity.includes(c));

  const pairStats = new Map<string, Map<string, number>>();
  const raw: { row: Row; diffs: FieldChange[] }[] = [];
  let changedCount = 0;
  for (const [k, rn] of newMap) {
    const ro = oldMap.get(k);
    if (!ro) continue;
    const diffs: FieldChange[] = [];
    for (const c of surfaced) {
      const from = norm(ro[c]);
      const to = norm(rn[c]);
      if (from === to) continue;
      diffs.push({
        col: c,
        label: profile?.fields?.[c] ?? c,
        from: truncate(from, o.maxStringLen),
        to: truncate(to, o.maxStringLen),
      });
      if (tier === "rich") {
        const pk = `${from}${SEP}${to}`;
        let m = pairStats.get(c);
        if (!m) pairStats.set(c, (m = new Map()));
        m.set(pk, (m.get(pk) ?? 0) + 1);
      }
    }
    if (diffs.length) {
      changedCount++;
      if (tier === "rich") raw.push({ row: rn, diffs });
    }
  }

  // 計數層：只回計數，不列明細、不做系統性摺疊
  if (tier !== "rich") {
    td.counts = { added: addedRows.length, changed: changedCount, removed: removedRows.length };
    return td;
  }

  // 系統性摺疊
  const systematic = new Map<string, SystematicChange>();
  for (const [col, m] of pairStats) {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    if (total < o.systematicMinCount || m.size > o.systematicMaxDistinct) continue;
    const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top[1] / total > o.systematicCoverage) {
      const sepIdx = top[0].indexOf(SEP);
      systematic.set(col, {
        col,
        label: profile?.fields?.[col] ?? col,
        from: truncate(top[0].slice(0, sepIdx), o.maxStringLen),
        to: truncate(top[0].slice(sepIdx + SEP.length), o.maxStringLen),
        count: top[1],
      });
    }
  }

  const changed: RowChange[] = [];
  for (const rc of raw) {
    const kept = rc.diffs.filter((d) => !systematic.has(d.col));
    if (kept.length) changed.push({ ...rowRef(rc.row, identity, profile, o.maxStringLen), fields: kept });
  }

  const added: RowRef[] = addedRows.map((r) => rowRef(r, identity, profile, o.maxStringLen));
  const removed: RowRef[] = removedRows.map((r) => rowRef(r, identity, profile, o.maxStringLen));

  td.counts = { added: added.length, changed: changed.length, removed: removed.length };
  if (systematic.size) td.systematic = [...systematic.values()];

  if (added.length > o.maxRowsPerTable) {
    td.added = added.slice(0, o.maxRowsPerTable);
    td.addedTruncated = added.length - o.maxRowsPerTable;
  } else if (added.length) td.added = added;

  if (removed.length > o.maxRowsPerTable) {
    td.removed = removed.slice(0, o.maxRowsPerTable);
    td.removedTruncated = removed.length - o.maxRowsPerTable;
  } else if (removed.length) td.removed = removed;

  if (changed.length > o.maxRowsPerTable) {
    td.changed = changed.slice(0, o.maxRowsPerTable);
    td.changedTruncated = changed.length - o.maxRowsPerTable;
  } else if (changed.length) td.changed = changed;

  return td;
}

function isEmpty(td: TableDiff): boolean {
  return (
    td.counts.added === 0 &&
    td.counts.changed === 0 &&
    td.counts.removed === 0 &&
    !td.structural &&
    !(td.systematic && td.systematic.length)
  );
}

function rank(td: TableDiff): number {
  if (td.tier === "rich") return CORE_TABLES.has(td.table) ? 0 : 1;
  return 2;
}

export function diffDatabases(
  oldDb: DB,
  newDb: DB,
  profiles: Record<string, TableProfile>,
  opts: DiffOptions = {},
): DbDiff {
  const o = { ...DEFAULTS, ...opts };
  const oldTables = new Set(listTables(oldDb));
  const newTables = new Set(listTables(newDb));
  const all = [...new Set([...oldTables, ...newTables])].sort();

  const addedTables = all.filter((t) => !oldTables.has(t) && newTables.has(t));
  const removedTables = all.filter((t) => oldTables.has(t) && !newTables.has(t));
  const both = all.filter((t) => oldTables.has(t) && newTables.has(t));

  const tables: TableDiff[] = [];
  for (const t of both) {
    const td = diffTable(oldDb, newDb, t, profiles[t], o);
    if (!isEmpty(td)) tables.push(td);
  }
  tables.sort((a, b) => rank(a) - rank(b) || a.table.localeCompare(b.table));

  const summary = tables.reduce(
    (acc, t) => ({
      added: acc.added + t.counts.added,
      changed: acc.changed + t.counts.changed,
      removed: acc.removed + t.counts.removed,
    }),
    { added: 0, changed: 0, removed: 0 },
  );

  return { addedTables, removedTables, tables, summary };
}

export function buildChangelogEntry(
  diff: DbDiff,
  meta: { version: string; date: string; note?: string },
): ChangelogEntry | null {
  const empty =
    diff.addedTables.length === 0 && diff.removedTables.length === 0 && diff.tables.length === 0;
  if (empty) return null;
  return {
    version: meta.version,
    date: meta.date,
    note: meta.note,
    summary: diff.summary,
    addedTables: diff.addedTables,
    removedTables: diff.removedTables,
    tables: diff.tables,
  };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test -- src/lib/changelog/__tests__/diff.test.ts`
Expected: 全部 test PASS（核心 4 + 系統性 2 + 防呆 2 + entry 2）。

- [ ] **Step 5: 型別檢查**

Run: `npm run typecheck`
Expected: 無錯誤。

- [ ] **Step 6: Commit**

```bash
git add src/lib/changelog/diff.ts src/lib/changelog/__tests__/diff.test.ts
git commit
```
Commit 訊息：`feat(changelog): add pure diff engine with systematic-collapse and rebuild guard`

---

## Task 3: tsx CLI 腳本

**Files:**
- Create: `scripts/db-changelog.ts`
- Modify: `package.json`（加 `changelog` script + `tsx` devDependency）

**Interfaces:**
- Consumes: `../src/lib/changelog/diff`（`diffDatabases`、`buildChangelogEntry`）、`../src/lib/changelog/config`（`PROFILES`）。
- Produces: 執行 `npm run changelog -- <v>` → 寫出 `src/data/changelog/<date>-v<version>.json`。無測試自動化（I/O 腳本）；以真實新舊檔手動驗收。

- [ ] **Step 1: 安裝 tsx**

Run: `npm install -D tsx`
Expected: `package.json` devDependencies 出現 `tsx`；`package-lock.json` 更新。

- [ ] **Step 2: 加 npm script**

Modify `package.json`，在 `scripts` 內 `sync:images` 上一行加入：

```json
    "changelog": "tsx scripts/db-changelog.ts",
```

（放在 `"test:watch"` 與 `"sync:images"` 之間即可，注意 JSON 逗號。）

- [ ] **Step 3: 寫 CLI 腳本**

Create `scripts/db-changelog.ts`:

```ts
// 本地版本差異 → 更新日誌 JSON。
//
// 用法（務必「先跑腳本、再 commit 新 DB」）：
//   1. 用新的 tthol.sqlite 覆蓋工作區檔（尚未 git add）
//   2. npm run changelog -- 1.23 [--note "說明"]   （版本號＝第一個位置參數）
//   3. review src/data/changelog/<date>-v1.23.json（可手改 note）
//   4. git add tthol.sqlite src/data/changelog/*.json && git commit
//
// 舊 DB 預設取自 git（HEAD:tthol.sqlite 的 blob）；用 spawn 直接把二進位
// pipe 進暫存檔，不經 shell 重導向（Windows 下 > 會破壞二進位）。

import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { diffDatabases, buildChangelogEntry } from "../src/lib/changelog/diff";
import { PROFILES } from "../src/lib/changelog/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DB_FILE = "tthol.sqlite";
const OUT_DIR = path.join(PROJECT_ROOT, "src", "data", "changelog");

interface Args {
  version?: string;
  date: string;
  note?: string;
  from: string; // git ref 或檔案路徑
  to: string; // 檔案路徑
  force: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    date: new Date().toISOString().slice(0, 10),
    from: "HEAD",
    to: path.join(PROJECT_ROOT, DB_FILE),
    force: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") args.force = true;
    else if (a === "--version") args.version = argv[++i];
    else if (a === "--date") args.date = argv[++i];
    else if (a === "--note") args.note = argv[++i];
    else if (a === "--from") args.from = argv[++i];
    else if (a === "--to") args.to = argv[++i];
    // 版本號為第一個位置參數（避免 npm 攔截 --version）；--version 保留為相容別名。
    else if (!a.startsWith("--") && args.version === undefined) args.version = a;
  }
  return args;
}

function gitBlobToTemp(ref: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), `tthol-old-${process.pid}.sqlite`);
    const out = fs.createWriteStream(tmp);
    const child = spawn("git", ["show", `${ref}:${DB_FILE}`], {
      cwd: PROJECT_ROOT,
      windowsHide: true,
    });
    let err = "";
    let closed = false;
    let finished = false;
    let code: number | null = null;
    const settle = () => {
      if (!(closed && finished)) return;
      if (code === 0) resolve(tmp);
      else reject(new Error(`git show ${ref}:${DB_FILE} 失敗：${err.trim()}`));
    };
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.stdout.pipe(out);
    child.on("close", (c) => {
      code = c;
      closed = true;
      settle();
    });
    out.on("error", reject);
    out.on("finish", () => {
      finished = true;
      settle();
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.version) {
    console.error(
      "用法：npm run changelog -- <版本號> [--date YYYY-MM-DD] [--note 說明] [--from HEAD|路徑] [--to 路徑] [--force]",
    );
    process.exit(1);
  }

  let oldPath: string;
  let cleanup: string | null = null;
  if (fs.existsSync(args.from)) {
    oldPath = args.from;
  } else {
    try {
      oldPath = await gitBlobToTemp(args.from);
      cleanup = oldPath;
    } catch (e) {
      console.error(String(e));
      console.error(`取不到舊 DB。若 HEAD 尚無 ${DB_FILE}，請用 --from <舊檔路徑>。`);
      process.exit(1);
    }
  }

  const oldDb = new Database(oldPath, { readonly: true });
  const newDb = new Database(args.to, { readonly: true, fileMustExist: true });
  const diff = diffDatabases(oldDb, newDb, PROFILES);
  oldDb.close();
  newDb.close();
  if (cleanup) fs.rmSync(cleanup, { force: true });

  const entry = buildChangelogEntry(diff, { version: args.version, date: args.date, note: args.note });
  if (!entry) {
    console.error("新舊 DB 無語意差異（或 HEAD 已是新檔）。未寫檔。");
    process.exit(1);
  }

  await fsp.mkdir(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `${args.date}-v${args.version}.json`);
  if (fs.existsSync(outFile) && !args.force) {
    console.error(`檔案已存在：${path.relative(PROJECT_ROOT, outFile)}（加 --force 覆寫）`);
    process.exit(1);
  }
  await fsp.writeFile(outFile, JSON.stringify(entry, null, 2) + "\n", "utf8");

  console.log(`\n更新日誌 v${args.version}（${args.date}）`);
  console.log(`  總計：+${entry.summary.added} ~${entry.summary.changed} −${entry.summary.removed}`);
  if (entry.addedTables.length) console.log(`  新增表：${entry.addedTables.join(", ")}`);
  if (entry.removedTables.length) console.log(`  移除表：${entry.removedTables.join(", ")}`);
  for (const t of entry.tables) {
    const flags = [
      t.rebuilt ? "重建" : "",
      t.noIdentity ? "無識別" : "",
      t.structural ? "結構變動" : "",
      t.systematic?.length ? `系統性x${t.systematic.length}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    console.log(
      `  ${t.label}(${t.table})  +${t.counts.added} ~${t.counts.changed} −${t.counts.removed}` +
        (flags ? `  [${flags}]` : ""),
    );
  }
  console.log(`\n已寫入 ${path.relative(PROJECT_ROOT, outFile)}`);
  console.log("請 review 內容（可手改 note），再：");
  console.log(`  git add ${DB_FILE} src/data/changelog/*.json && git commit`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: 手動驗收（用真實新舊檔）**

用 `../tthol_data/tthol.sqlite`（最新）當「新檔」、目前工作區 `tthol.sqlite` 當「舊檔」試算（不覆蓋工作區檔，用 `--to` 指到新檔）：

Run:
```bash
npm run changelog -- 0.0-test --to ../tthol_data/tthol.sqlite --note "試算驗收"
```
Expected:
- 終端印出各表 `+N ~N −N` 摘要（items 應有少量新增/改名/數值變更；跨 schema 版可能看到 `結構變動` 與 `系統性x…` 旗標——這是 spec §2 記載的首跑預期行為）。
- 產生 `src/data/changelog/<今日日期>-v0.0-test.json`（檔名格式 `<date>-v<version>`，例如 `2026-07-08-v0.0-test.json`）。
- 打開 JSON 確認：`tables[].changed[].fields` 有 zh-tw label、`idParts` 不含控制字元、rich 表 `added/removed` 帶 `name`。

- [ ] **Step 5: 刪掉驗收產物**

Run: `git status` 確認只有 `package.json`/`package-lock.json`/`scripts/db-changelog.ts` 該進版控；把試算 JSON 刪掉：
```bash
rm src/data/changelog/*-v0.0-test.json
```
（若 `src/data/changelog/` 目前不存在會由腳本自動建立；Task 4 才正式提交 `.gitkeep`。此處確保不誤commit 測試檔。）

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/db-changelog.ts
git commit
```
Commit 訊息：`feat(changelog): add db-changelog CLI (tsx) with git-blob diff`

---

## Task 4: build 時資料 loader

**Files:**
- Create: `src/lib/changelog/load.ts`
- Create: `src/data/changelog/.gitkeep`
- Test: `src/lib/changelog/__tests__/load.test.ts`

**Interfaces:**
- Consumes: `./types` 的 `ChangelogEntry`；`node:fs`、`node:path`。
- Produces: `loadChangelog(dir?: string): ChangelogEntry[]`（依 `date` 新→舊、同日期 `version` 降序；目錄不存在回 `[]`）。以及匯出 `CHANGELOG_DIR` 常數。

- [ ] **Step 1: 寫 loader 測試**

Create `src/lib/changelog/__tests__/load.test.ts`（用 `node` 環境操作暫存目錄）:

```ts
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test -- src/lib/changelog/__tests__/load.test.ts`
Expected: FAIL — `Failed to resolve import "../load"`。

- [ ] **Step 3: 寫 loader**

Create `src/lib/changelog/load.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import type { ChangelogEntry } from "./types";

export const CHANGELOG_DIR = path.join(process.cwd(), "src", "data", "changelog");

// 只在 build 階段（Server Component 靜態渲染）呼叫。
export function loadChangelog(dir: string = CHANGELOG_DIR): ChangelogEntry[] {
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const entries: ChangelogEntry[] = [];
  for (const f of files) {
    const raw = fs.readFileSync(path.join(dir, f), "utf8");
    entries.push(JSON.parse(raw) as ChangelogEntry);
  }
  entries.sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : b.version.localeCompare(a.version),
  );
  return entries;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test -- src/lib/changelog/__tests__/load.test.ts`
Expected: 2 tests PASS。

- [ ] **Step 5: 建立資料夾佔位檔**

Create `src/data/changelog/.gitkeep`（空檔）:

```
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/changelog/load.ts src/lib/changelog/__tests__/load.test.ts src/data/changelog/.gitkeep
git commit
```
Commit 訊息：`feat(changelog): add build-time changelog loader`

---

## Task 5: /changelog 頁面與元件

**Files:**
- Create: `src/app/changelog/page.tsx`
- Create: `src/components/changelog/version-card.tsx`
- Create: `src/components/changelog/summary-badges.tsx`
- Create: `src/components/changelog/table-section.tsx`
- Modify: `src/components/layout/navbar.tsx`

**Interfaces:**
- Consumes: `@/lib/changelog/load` 的 `loadChangelog`；`@/lib/changelog/config` 的 `PROFILES`（僅 server 端 `version-card` 使用，用來算 `detailRoute` href）；`@/lib/changelog/types`（type-only）；`@/components/ui/{card,badge,collapsible,table}`。
- Produces: 靜態頁面 `/changelog`；導覽列多一個「更新紀錄」入口。

> 分工：`page.tsx`/`version-card.tsx`/`summary-badges.tsx` 是 **Server Component**（沿用 `about/page.tsx` 已驗證的「server 頁面直接用 Card/Badge」模式）。只有 `table-section.tsx` 因需要 Collapsible 互動而是 **Client Component**，且只接收「已序列化、含 href 字串」的純資料——`detailRoute` 函式在 server 端就算完，config 的函式不會進 client bundle。

- [ ] **Step 1: 寫 Client 端可收合表區塊**

Create `src/components/changelog/table-section.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FieldChange, SystematicChange } from "@/lib/changelog/types";

export interface RowView {
  idParts: string[];
  name?: string;
  href?: string;
}
export interface ChangedRowView extends RowView {
  fields: FieldChange[];
}
export interface TableSectionData {
  table: string;
  label: string;
  tier: "rich" | "count";
  counts: { added: number; changed: number; removed: number };
  structural?: { addedColumns: string[]; removedColumns: string[] };
  systematic?: SystematicChange[];
  noIdentity?: boolean;
  rebuilt?: boolean;
  added?: RowView[];
  removed?: RowView[];
  changed?: ChangedRowView[];
  addedTruncated?: number;
  removedTruncated?: number;
  changedTruncated?: number;
}

function rowLabel(r: RowView): string {
  return r.name ?? r.idParts.join(" / ");
}

function RowLink({ r }: { r: RowView }) {
  if (r.href) {
    return (
      <Link href={r.href} className="text-primary hover:underline">
        {rowLabel(r)}
      </Link>
    );
  }
  return <span>{rowLabel(r)}</span>;
}

export function TableSection({ data }: { data: TableSectionData }) {
  const { counts } = data;
  return (
    <Collapsible className="border-border/60 rounded-md border">
      <CollapsibleTrigger className="hover:bg-muted/50 group flex items-center justify-between gap-2 rounded-md px-3 py-2">
        <span className="text-sm font-medium">{data.label}</span>
        <span className="text-muted-foreground flex items-center gap-2 text-xs">
          <span>{`+${counts.added} ~${counts.changed} −${counts.removed}`}</span>
          <ChevronDownIcon
            className="size-4 transition-transform group-data-[panel-open]:rotate-180"
            aria-hidden
          />
        </span>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="space-y-3 px-3 pb-3 text-sm">
          {data.rebuilt ? (
            <p className="text-muted-foreground text-xs">
              {`整表重建（識別不穩定，+${counts.added} / −${counts.removed}）`}
            </p>
          ) : null}

          {data.structural ? (
            <p className="text-muted-foreground text-xs">
              {"資料結構調整："}
              {data.structural.addedColumns.length
                ? `新增欄位 ${data.structural.addedColumns.join("、")} `
                : ""}
              {data.structural.removedColumns.length
                ? `移除欄位 ${data.structural.removedColumns.join("、")}`
                : ""}
            </p>
          ) : null}

          {data.systematic?.map((s) => (
            <p key={s.col} className="text-muted-foreground text-xs">
              {`${s.label} 全表 ${s.from}→${s.to}（建置調整，${s.count} 筆）`}
            </p>
          ))}

          {data.added?.length ? (
            <div>
              <p className="mb-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">新增</p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {data.added.map((r, i) => (
                  <li key={`a-${i}`}>
                    <RowLink r={r} />
                  </li>
                ))}
              </ul>
              {data.addedTruncated ? (
                <p className="text-muted-foreground mt-1 text-xs">{`另有 ${data.addedTruncated} 筆未列出`}</p>
              ) : null}
            </div>
          ) : null}

          {data.removed?.length ? (
            <div>
              <p className="mb-1 text-xs font-medium text-red-600 dark:text-red-400">下架</p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {data.removed.map((r, i) => (
                  <li key={`r-${i}`}>
                    <RowLink r={r} />
                  </li>
                ))}
              </ul>
              {data.removedTruncated ? (
                <p className="text-muted-foreground mt-1 text-xs">{`另有 ${data.removedTruncated} 筆未列出`}</p>
              ) : null}
            </div>
          ) : null}

          {data.changed?.length ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">變更</p>
              {data.changed.map((r, i) => (
                <div key={`c-${i}`} className="border-border/40 rounded border p-2">
                  <p className="mb-1 font-medium">
                    <RowLink r={r} />
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>欄位</TableHead>
                        <TableHead>原值</TableHead>
                        <TableHead>新值</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.fields.map((f) => (
                        <TableRow key={f.col}>
                          <TableCell>{f.label}</TableCell>
                          <TableCell className="text-muted-foreground">{f.from || "—"}</TableCell>
                          <TableCell>{f.to || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
              {data.changedTruncated ? (
                <p className="text-muted-foreground text-xs">{`另有 ${data.changedTruncated} 筆未列出`}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
```

> 註：`group-data-[panel-open]:rotate-180` 依賴 base-ui Collapsible 在開啟時於 trigger 上加 `data-panel-open`。若實測箭頭未旋轉，屬純視覺、不影響功能——可留待微調。

- [ ] **Step 2: 寫摘要 badge 列（Server）**

Create `src/components/changelog/summary-badges.tsx`:

```tsx
import { PlusIcon, PencilLineIcon, MinusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function SummaryBadges({
  summary,
}: {
  summary: { added: number; changed: number; removed: number };
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge
        variant="outline"
        className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
      >
        <PlusIcon aria-hidden />
        {`${summary.added} 新增`}
      </Badge>
      <Badge
        variant="outline"
        className="border-amber-500/40 text-amber-600 dark:text-amber-400"
      >
        <PencilLineIcon aria-hidden />
        {`${summary.changed} 變更`}
      </Badge>
      <Badge variant="outline" className="border-red-500/40 text-red-600 dark:text-red-400">
        <MinusIcon aria-hidden />
        {`${summary.removed} 下架`}
      </Badge>
    </div>
  );
}
```

- [ ] **Step 3: 寫版本卡（Server；算 href）**

Create `src/components/changelog/version-card.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PROFILES } from "@/lib/changelog/config";
import type { ChangelogEntry, TableDiff, RowRef } from "@/lib/changelog/types";
import { SummaryBadges } from "./summary-badges";
import { TableSection, type TableSectionData } from "./table-section";

function toSectionData(td: TableDiff): TableSectionData {
  const route = PROFILES[td.table]?.detailRoute;
  const link = (r: RowRef) => ({
    idParts: r.idParts,
    name: r.name,
    href: route ? route(r.idParts) : undefined,
  });
  return {
    table: td.table,
    label: td.label,
    tier: td.tier,
    counts: td.counts,
    structural: td.structural,
    systematic: td.systematic,
    noIdentity: td.noIdentity,
    rebuilt: td.rebuilt,
    added: td.added?.map(link),
    removed: td.removed?.map(link),
    changed: td.changed?.map((c) => ({ ...link(c), fields: c.fields })),
    addedTruncated: td.addedTruncated,
    removedTruncated: td.removedTruncated,
    changedTruncated: td.changedTruncated,
  };
}

export function VersionCard({ entry }: { entry: ChangelogEntry }) {
  const tableLine = [
    entry.addedTables.length ? `新增資料表：${entry.addedTables.join("、")}` : "",
    entry.removedTables.length ? `移除資料表：${entry.removedTables.join("、")}` : "",
  ]
    .filter(Boolean)
    .join("　");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{`v${entry.version}`}</Badge>
          <span className="text-muted-foreground text-sm">{entry.date}</span>
        </div>
        <CardTitle className="sr-only">{`版本 ${entry.version}`}</CardTitle>
        {entry.note ? <p className="text-sm leading-relaxed">{entry.note}</p> : null}
        <SummaryBadges summary={entry.summary} />
      </CardHeader>
      <CardContent className="space-y-2">
        {tableLine ? <p className="text-muted-foreground text-xs">{tableLine}</p> : null}
        {entry.tables.map((t) => (
          <TableSection key={t.table} data={toSectionData(t)} />
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: 寫頁面（靜態 Server Component）**

Create `src/app/changelog/page.tsx`:

```tsx
import type { Metadata } from "next";
import { HistoryIcon } from "lucide-react";
import { loadChangelog } from "@/lib/changelog/load";
import { VersionCard } from "@/components/changelog/version-card";

// 正式機為 Next standalone，runner 無 src/；必須靜態渲染讓 fs 讀取發生在 build 階段。
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "更新紀錄 | 玄武",
  description: "武林同萌傳資料庫的版本更新紀錄 — 每次資料更新的新增、變更與下架項目。",
};

export default function ChangelogPage() {
  const entries = loadChangelog();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8 flex items-center gap-3">
        <HistoryIcon className="text-primary size-6" aria-hidden />
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">更新紀錄</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            資料庫每次更新的異動摘要，對齊遊戲版本。
          </p>
        </div>
      </header>

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">尚無更新紀錄。</p>
      ) : (
        <div className="space-y-6">
          {entries.map((e) => (
            <VersionCard key={`${e.date}-${e.version}`} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: 導覽列加入口**

Modify `src/components/layout/navbar.tsx`：

(a) 桌面版 —— 在 `<DesktopLink href="/tools" label="工具" pathname={pathname} />` 下一行加：

```tsx
          <DesktopLink href="/changelog" label="更新紀錄" pathname={pathname} />
```

(b) 手機版 —— 在手機選單的 `工具` MobileLink 區塊後、`關於` 的 `border-t` 區塊前，加：

```tsx
                <MobileLink
                  href="/changelog"
                  label="更新紀錄"
                  pathname={pathname}
                  onNavigate={() => setOpen(false)}
                />
```

具體位置：找到手機版這段
```tsx
                <MobileLink
                  href="/tools"
                  label="工具"
                  pathname={pathname}
                  onNavigate={() => setOpen(false)}
                />

                <div className="border-border/60 mt-2 border-t pt-3">
```
在 `工具` 的 `</MobileLink>`（即 `/>`）與 `<div className="border-border/60 ...">` 之間插入 (b) 的區塊。

- [ ] **Step 6: 產一份真資料驗證頁面（暫時）**

為了讓頁面有東西可渲染，臨時產一份 changelog JSON（用 Task 3 CLI，對真實新檔）：

Run:
```bash
npm run changelog -- 0.0-preview --to ../tthol_data/tthol.sqlite --note "頁面預覽用，稍後刪除"
```
Expected: 產生 `src/data/changelog/<today>-v0.0-preview.json`。

- [ ] **Step 7: 建置驗證（靜態渲染必須成功）**

Run: `npm run build`
Expected:
- build 成功。
- 輸出的 route 清單中 `/changelog` 標記為靜態（`○ (Static)` 或 `●`），**不是** `ƒ (Dynamic)`。若顯示 Dynamic，檢查是否誤用了 dynamic API 或漏了 `export const dynamic = "force-static"`。

- [ ] **Step 8: 目視驗證**

Run: `npm run dev`，瀏覽 `http://localhost:3000/changelog`
Expected:
- 顯示一張 `v0.0-preview` 卡片，含日期、note、綠/琥珀/紅摘要 badge。
- 每張表可點擊展開/收合；rich 表（道具/技能/怪物）排前。
- 展開道具：新增項目名稱可點，連到 `/items/[id]`；變更項目顯示「欄位/原值/新值」小表格；若有系統性摺疊顯示「XXX 全表 a→b（建置調整，N 筆）」。
- 導覽列（桌面與手機）都有「更新紀錄」入口且可到達本頁。

- [ ] **Step 9: 刪掉預覽資料**

Run:
```bash
rm src/data/changelog/*-v0.0-preview.json
```
（頁面對空資料夾會顯示「尚無更新紀錄」，`.gitkeep` 仍在。正式資料由日後真實更新時產生。）

- [ ] **Step 10: 最終檢查 + Commit**

Run: `npm run lint && npm test`
Expected: lint 無錯、所有測試通過。

```bash
git add src/app/changelog src/components/changelog src/components/layout/navbar.tsx
git commit
```
Commit 訊息：`feat(changelog): add public /changelog page with tiered diff view`

---

## Self-Review

**1. Spec coverage**（逐節對照 `2026-07-08-db-changelog-design.md`）：

- §2 首跑預期行為 → Task 3 Step 4 明示「跨 schema 版可能看到結構變動/系統性旗標」。✅
- §4 表設定檔（含 item_rand、EXCLUDE、fields 白名單、運作規則） → Task 1 `config.ts` 逐字落地；白名單行為由 Task 2 `surfaced` 實作 + `diff.test.ts` 「白名單欄才算變更」驗證。✅
- §4 無識別欄 fallback（全列雜湊 multiset） → Task 2 `multisetDiff` + 測試「無識別欄」。✅
- §5 演算法 1-6（表級/schema/識別/載入/added-removed/changed 交集+白名單） → Task 2 `diffTable` + 核心測試。✅
- §5 演算法 7 系統性摺疊（>90% 且 distinct≤3 且 ≥100，且必顯示摘要） → Task 2 systematic 區塊 + 兩個系統性測試；摘要於 Task 5 `table-section` 一律渲染。✅
- §5 輸出型別（idParts、truncated、noIdentity、rebuilt、systematic） → Task 1 `types.ts` 全數涵蓋。✅
- §5 邊界（U+0001 內部分隔不外洩、每表 200 上限+truncated、長字串 120 截斷、整表重建 50% 防呆） → Task 2 `SEP`/`rowRef`/`truncate`/`rebuildRatio` + 截斷/重建測試。✅
- §6 CLI（參數、git blob spawn 不經 shell、錯誤處理、空 diff exit 1、--force、先跑再 commit、tsx+相對 import） → Task 3 全數落地。✅
- §7 資料格式與頁面（一版一檔、無 index.json、force-static 無 dynamic API、Card/Badge/Collapsible/lucide、rich 排前、深連、截斷提示、navbar 連結） → Task 4 loader + Task 5 頁面/元件/navbar。✅
- §8 測試策略（記憶體 DB 斷言各條） → Task 2 `diff.test.ts` + Task 4 `load.test.ts` + Task 1 `config.test.ts`；人工驗收於 Task 3 Step 4 與 Task 5 Step 8。✅
- §9 檔案清單 → 與本 plan File Structure 一致。✅

無未覆蓋需求。

**2. Placeholder scan**：全部步驟含實際程式碼與明確指令；無 TBD/TODO/「類似 Task N」。Task 5 Step 1 的 `data-panel-open` 備註是明確的「若…則…」條件說明，非佔位。✅

**3. Type consistency**：
- `diffDatabases`/`buildChangelogEntry` 簽章（Task 2 Produces）與 Task 3 CLI import 一致。
- `TableDiff` 欄位（`added?/removed?/changed?/*Truncated/systematic/structural/noIdentity/rebuilt`）在 `types.ts`（Task 1）定義，`diff.ts`（Task 2）寫入，`table-section.tsx`/`version-card.tsx`（Task 5）讀取，名稱一致。
- `TableSectionData`/`RowView`/`ChangedRowView` 由 `table-section.tsx` 定義並由 `version-card.tsx` import 使用，`toSectionData` 產出的形狀與之相符（`changed` 帶 `fields`）。
- `RowRef.idParts`、`FieldChange.{col,label,from,to}`、`SystematicChange.{col,label,from,to,count}` 跨引擎與 UI 一致。
- `loadChangelog` 回傳 `ChangelogEntry[]`，頁面 `entries.map` 用 `entry.version/date/note/summary/tables/addedTables/removedTables` 皆存在於型別。

一致，無簽章漂移。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-08-db-changelog.md`. Two execution options:

**1. Subagent-Driven（推薦）** — 每個 task 派一個全新 subagent，task 之間我來 review，迭代快。

**2. Inline Execution** — 在本 session 直接依 executing-plans 批次執行，設檢查點供 review。

要走哪一種？
