# AI 策展式 changelog 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在既有的確定性 DB diff 引擎之上疊一層「AI 策展」，讓 Claude 讀 diff 濃縮摘要、產出玩家看得懂的更新日誌（重點條列 + 逐表決定 detail／summary），事實仍全數來自引擎、AI 只寫人話。

**Architecture:** 六個元件串成單向管線：diff 引擎（既有，小改成 added/removed 攜帶白名單欄現值）→ `digestForAI()`（純函式，把 diff 濃縮成有界摘要）→ `curateWithClaude()`（依賴注入的 client，呼叫 Claude structured output）→ CLI 合併進 `ChangelogEntry.ai` → 人工 review → `/changelog` 頁面依 `ai` 層渲染。AI 只產 highlights + 逐表 mode/note；頁面顯示的道具名稱／數值一律取自事實層 `tables[]`。降級路徑（無金鑰／`--no-ai`／API 失敗）照樣寫出事實層 JSON。

**Tech Stack:** TypeScript、Next.js App Router（Server Components、`force-static`）、better-sqlite3（唯讀）、`@anthropic-ai/sdk`、vitest（jsdom 預設；引擎測試以 `// @vitest-environment node` 覆寫）、Tailwind + shadcn/ui + lucide-react、tsx CLI。

## Global Constraints

以下為專案級硬性要求，每個任務都隱含適用（值逐字取自 spec 與 CLAUDE.md）：

- 所有面向使用者文字用**繁體中文（zh-tw）**。
- UI：shadcn-first → base-ui → lucide 圖示；**禁用 emoji 與 Unicode 字符**（`×`/`▾`/`✓`）；hand-roll 時比照鄰近 shadcn 視覺詞彙（`rounded-md`/`rounded-lg`、`border-border/60`、`bg-card`、`text-muted-foreground`、`hover:bg-muted/50`、`ring-ring`）。
- 預設模型 `claude-opus-4-8`；adaptive thinking（`thinking: { type: "adaptive" }`）；可用 `--model` 覆寫。
- `ANTHROPIC_API_KEY` **只從 `.env` 讀**（本機、不進 repo、不上正式機）；**絕不**把金鑰寫進 system prompt／messages／log。
- **測試絕不打真 API**：`curateWithClaude` 收依賴注入的假 client；真 SDK 只在 CLI 建構。
- `/changelog` 頁維持 `export const dynamic = "force-static"`（正式機 standalone 無 `src/`，`fs` 讀取須發生在 build）。
- `src/lib/changelog/types.ts` **不得 import 任何 runtime 相依**（tsx CLI 與 Next 頁面都要能安全引入）。
- 識別分隔符 `SEP = "\x01"` 絕不外洩到 JSON。
- 降級為第一公民：AI 失敗不可讓整個 changelog 產生流程失敗。
- commit 用 conventional-commit 風格，並附上本 repo 的 `Co-Authored-By` / `Claude-Session` trailer。
- `tthol.sqlite` 為唯讀遊戲資料；唯一例外是 changelog 儀式會在跑 CLI 前用新版覆蓋工作區檔。

## File Structure

| 檔案 | 動作 | 責任 |
|---|---|---|
| `src/lib/changelog/types.ts` | 改 | `RowRef` 加 `fields?: SurfacedField[]`；`RowChange` 改為獨立型別（不 extends）；新增 `SurfacedField`、`AiDigest`/`AiDigestTable`、`AiCuration`；`ChangelogEntry` 加 `ai` |
| `src/lib/changelog/diff.ts` | 改 | rich added/removed 附白名單欄現值（含 `summary`） |
| `src/lib/changelog/digest.ts` | 新 | `digestForAI()` 純函式：diff → 有界摘要 |
| `src/lib/changelog/curate.ts` | 新 | `buildCurationPrompt`/`CURATION_SCHEMA`/`normalizeCuration`/`curateWithClaude`/`curationToAiLayer`/`resolveAiPlan`/`CurationClient`（純邏輯 + DI，無 SDK import） |
| `src/lib/changelog/present.ts` | 新 | 頁面純取值：`getHighlights`/`getTableMode`/`getTableNote` |
| `scripts/db-changelog.ts` | 改 | 串接 AI 步驟、`--no-ai`/`--model`、建構真 Anthropic client、降級 |
| `package.json` | 改 | `changelog` script 改 env 載入；加 `@anthropic-ai/sdk` |
| `src/components/changelog/highlights.tsx` | 新 | 「本版重點」區塊（server component） |
| `src/components/changelog/table-summary-row.tsx` | 新 | summary 模式一行式表列（server component，無展開） |
| `src/components/changelog/version-card.tsx` | 改 | 渲染 highlights；逐表依 mode 走 detail/summary；修 `link` 型別 |
| `src/components/changelog/table-section.tsx` | 改 | detail 模式的新增列可附說明（§3 附帶好處） |
| `src/lib/changelog/__tests__/*` | 新 | digest、curate、present、引擎改動測試 |
| `src/components/changelog/__tests__/*` | 新 | highlights、table-summary-row、version-card render 測試 |

---

## Task 1: diff 引擎 — rich added/removed 攜帶白名單欄現值

**Files:**
- Modify: `src/lib/changelog/types.ts:20-35`（`RowRef`/`RowChange`）
- Modify: `src/lib/changelog/diff.ts`（新增 `surfacedFields` helper、added/removed 附值）
- Modify: `src/components/changelog/version-card.tsx:10`（`link` 型別 ripple 修正）
- Test: `src/lib/changelog/__tests__/diff.test.ts`（新增一個 describe）

**Interfaces:**
- Produces: `SurfacedField = { col: string; label: string; value: string }`；`RowRef.fields?: SurfacedField[]`（僅 rich added/removed 有值）；`RowChange`（獨立型別：`{ idParts: string[]; name?: string; fields: FieldChange[] }`）。Task 2/5 消費 `RowRef.fields`。

- [ ] **Step 1: 改型別，讓 `RowRef` 帶 surfaced fields、`RowChange` 獨立**

`src/lib/changelog/types.ts` 把現有 `RowRef` / `RowChange`（第 20-27 行）換成：

```ts
export interface SurfacedField {
  col: string;
  label: string;
  value: string;
}

export interface RowRef {
  idParts: string[]; // 原始識別欄值（不含控制字元）
  name?: string;
  // rich added/removed 專用：白名單欄「現值」（含 summary，如禮盒說明）。
  // 型別與 RowChange.fields（from→to）不同，故 RowChange 不再 extends RowRef。
  fields?: SurfacedField[];
}

export interface RowChange {
  idParts: string[];
  name?: string;
  fields: FieldChange[];
}
```

- [ ] **Step 2: 寫失敗測試**

在 `src/lib/changelog/__tests__/diff.test.ts` 末尾新增：

```ts
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
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `npx vitest run src/lib/changelog/__tests__/diff.test.ts`
Expected: 新 describe 兩案 FAIL（`box.fields` 為 `undefined`）。

- [ ] **Step 4: 實作 — diff.ts 附 surfaced fields**

`src/lib/changelog/diff.ts` 第 1-13 行的 type import 補上 `SurfacedField`：

```ts
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
  SurfacedField,
} from "./types";
```

在 `rowRef` 函式（第 66 行 `}` 之後）新增 helper：

```ts
// rich added/removed：把白名單欄的「現值」攤成 surfaced fields（供 AI digest / 詳情頁）。
function surfacedFields(
  row: Row,
  profile: TableProfile | undefined,
  identity: string[],
  maxStringLen: number,
): SurfacedField[] {
  if (!profile?.fields) return [];
  const out: SurfacedField[] = [];
  for (const [col, label] of Object.entries(profile.fields)) {
    if (identity.includes(col)) continue;
    const v = norm(row[col]);
    if (v === "") continue;
    out.push({ col, label, value: truncate(v, maxStringLen) });
  }
  return out;
}
```

把第 215-216 行的 added/removed 映射改為附值：

```ts
const attach = (r: Row): RowRef => {
  const ref = rowRef(r, identity, profile, o.maxStringLen);
  const f = surfacedFields(r, profile, identity, o.maxStringLen);
  if (f.length) ref.fields = f;
  return ref;
};
const added: RowRef[] = addedRows.map(attach);
const removed: RowRef[] = removedRows.map(attach);
```

（`RowChange` 的建構第 212 行 `{ ...rowRef(...), fields: kept }` 不受影響：`rowRef` 只回 `idParts`/`name`，spread 後補 `fields: FieldChange[]`。）

- [ ] **Step 5: 修 version-card 型別 ripple**

`RowRef` 新增 `fields?: SurfacedField[]` 後，`RowChange`（`fields: FieldChange[]`）不再結構相容 `RowRef`，故 `version-card.tsx` 的 `link(c)` 會編譯失敗。把 `src/components/changelog/version-card.tsx:10` 的 `link` 參數型別放寬成只取需要的欄：

```ts
const link = (r: { idParts: string[]; name?: string }) => ({
  idParts: r.idParts,
  name: r.name,
  href: route ? route(r.idParts) : undefined,
});
```

- [ ] **Step 6: 跑測試 + 型別檢查確認通過**

Run: `npx vitest run src/lib/changelog/__tests__/diff.test.ts && npm run typecheck`
Expected: vitest 全綠（含既有案）；`tsc --noEmit` 無錯。

- [ ] **Step 7: Commit**

```bash
git add src/lib/changelog/types.ts src/lib/changelog/diff.ts src/components/changelog/version-card.tsx src/lib/changelog/__tests__/diff.test.ts
git commit -m "feat(changelog): rich added/removed carry surfaced field values"
```

---

## Task 2: `digestForAI()` — diff → 有界摘要

**Files:**
- Modify: `src/lib/changelog/types.ts`（新增 `AiDigest`/`AiDigestTable`）
- Create: `src/lib/changelog/digest.ts`
- Test: `src/lib/changelog/__tests__/digest.test.ts`

**Interfaces:**
- Consumes: `DbDiff`、`TableDiff`、`RowRef.fields`（Task 1）。
- Produces: `digestForAI(diff: DbDiff): AiDigest`。`AiDigest` 供 Task 3 `buildCurationPrompt` 與 `curateWithClaude` 使用。注意 `digestForAI` 的參數是結構型，`ChangelogEntry` 亦滿足（Task 4 直接傳 entry）。

- [ ] **Step 1: 加 digest 型別**

`src/lib/changelog/types.ts` 末尾（`DiffOptions` 之後）新增：

```ts
export interface AiDigestTable {
  table: string;
  label: string;
  tier: "rich" | "count";
  counts: { added: number; changed: number; removed: number };
  structural?: { addedColumns: number; removedColumns: number }; // 只給數量
  systematic?: { label: string; from: string; to: string; count: number }[];
  rebuilt?: boolean;
  noIdentity?: boolean;
  addedSample?: { name?: string; fields?: Record<string, string> }[]; // label→value（含說明）
  addedSampleTruncated?: number;
  removedSample?: { name?: string }[];
  removedSampleTruncated?: number;
  changedFieldCounts?: Record<string, number>; // 各欄（label）變更筆數
  changedSample?: { name?: string; fields: { label: string; from: string; to: string }[] }[];
  changedSampleTruncated?: number;
}

export interface AiDigest {
  summary: { added: number; changed: number; removed: number };
  addedTables: string[];
  removedTables: string[];
  tables: AiDigestTable[];
}
```

- [ ] **Step 2: 寫失敗測試**

Create `src/lib/changelog/__tests__/digest.test.ts`：

```ts
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
    expect(t.addedSample![0]).toEqual({ name: "端午禮盒", fields: { 名稱: "端午禮盒", 說明: "開箱可得晝夢冥鰩", 售價: "500" } });
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
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `npx vitest run src/lib/changelog/__tests__/digest.test.ts`
Expected: FAIL（`Cannot find module '../digest'`）。

- [ ] **Step 4: 實作 digest.ts**

Create `src/lib/changelog/digest.ts`：

```ts
// 把確定性 diff 濃縮成「有界」摘要餵給 AI，避免把上千筆原始列塞進 prompt。
// 純函式、無 I/O。計數為全量；樣本有上限，超出記 *SampleTruncated。
import type { AiDigest, AiDigestTable, DbDiff, RowChange, TableDiff } from "./types";

const MAX_ADDED = 40;
const MAX_REMOVED = 40;
const MAX_CHANGED = 20;

export function digestForAI(diff: DbDiff): AiDigest {
  return {
    summary: diff.summary,
    addedTables: diff.addedTables,
    removedTables: diff.removedTables,
    tables: diff.tables.map(digestTable),
  };
}

function digestTable(t: TableDiff): AiDigestTable {
  const d: AiDigestTable = { table: t.table, label: t.label, tier: t.tier, counts: t.counts };
  if (t.structural) {
    d.structural = {
      addedColumns: t.structural.addedColumns.length,
      removedColumns: t.structural.removedColumns.length,
    };
  }
  if (t.systematic?.length) {
    d.systematic = t.systematic.map((s) => ({ label: s.label, from: s.from, to: s.to, count: s.count }));
  }
  if (t.rebuilt) d.rebuilt = true;
  if (t.noIdentity) d.noIdentity = true;

  if (t.added?.length) {
    d.addedSample = t.added.slice(0, MAX_ADDED).map((r) => {
      const o: { name?: string; fields?: Record<string, string> } = {};
      if (r.name) o.name = r.name;
      if (r.fields?.length) {
        o.fields = {};
        for (const f of r.fields) o.fields[f.label] = f.value;
      }
      return o;
    });
    const extra = t.added.length - d.addedSample.length + (t.addedTruncated ?? 0);
    if (extra > 0) d.addedSampleTruncated = extra;
  }

  if (t.removed?.length) {
    d.removedSample = t.removed.slice(0, MAX_REMOVED).map((r) => (r.name ? { name: r.name } : {}));
    const extra = t.removed.length - d.removedSample.length + (t.removedTruncated ?? 0);
    if (extra > 0) d.removedSampleTruncated = extra;
  }

  if (t.changed?.length) {
    const counts: Record<string, number> = {};
    for (const c of t.changed) for (const f of c.fields) counts[f.label] = (counts[f.label] ?? 0) + 1;
    d.changedFieldCounts = counts;

    // 「批量欄」= 出現次數最多的欄；優先挑觸及非批量欄的列給 AI 看。
    const bulk = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const score = (c: RowChange) => c.fields.filter((f) => f.label !== bulk).length * 10 + c.fields.length;
    const ranked = [...t.changed].sort((a, b) => score(b) - score(a));
    d.changedSample = ranked.slice(0, MAX_CHANGED).map((c) => ({
      ...(c.name ? { name: c.name } : {}),
      fields: c.fields.map((f) => ({ label: f.label, from: f.from, to: f.to })),
    }));
    const extra = t.changed.length - d.changedSample.length + (t.changedTruncated ?? 0);
    if (extra > 0) d.changedSampleTruncated = extra;
  }

  return d;
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npx vitest run src/lib/changelog/__tests__/digest.test.ts`
Expected: 4 案 PASS。

- [ ] **Step 6: Commit**

```bash
git add src/lib/changelog/types.ts src/lib/changelog/digest.ts src/lib/changelog/__tests__/digest.test.ts
git commit -m "feat(changelog): add digestForAI — bounded diff summary for AI"
```

---

## Task 3: `curateWithClaude()` — 策展邏輯 + DI（無 SDK import）

**Files:**
- Modify: `src/lib/changelog/types.ts`（新增 `AiCuration`；`ChangelogEntry` 加 `ai`）
- Create: `src/lib/changelog/curate.ts`
- Test: `src/lib/changelog/__tests__/curate.test.ts`

**Interfaces:**
- Consumes: `AiDigest`（Task 2）。
- Produces:
  - `CurationClient = { curate(req: { model: string; system: string; user: string; schema: object }): Promise<unknown> }`（抽象 SDK，Task 4 實作）
  - `buildCurationPrompt(digest: AiDigest): { system: string; user: string }`
  - `CURATION_SCHEMA`（json schema 物件）
  - `normalizeCuration(raw: unknown, knownTables: string[]): AiCuration`
  - `curateWithClaude(digest: AiDigest, opts: { client: CurationClient; model?: string }): Promise<AiCuration>`
  - `curationToAiLayer(curation: AiCuration, meta: { model: string; edited?: boolean }): NonNullable<ChangelogEntry["ai"]>`
  - `resolveAiPlan(env: { noAi: boolean; apiKey: string | undefined }): { runAi: boolean; reason: string }`

- [ ] **Step 1: 加 curation 型別**

`src/lib/changelog/types.ts`：新增 `AiCuration`（放在 `AiDigest` 之後）：

```ts
export interface AiCuration {
  highlights: string[]; // 3–12 條本版重點（人話、grounded）
  tables: { table: string; mode: "detail" | "summary"; note?: string }[];
}
```

並把 `ChangelogEntry`（第 61-69 行）補上 `ai`：

```ts
export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  note?: string;
  summary: { added: number; changed: number; removed: number };
  addedTables: string[];
  removedTables: string[];
  tables: TableDiff[]; // 事實層（不動）
  ai?: {
    // 策展層（可缺席＝降級）。頁面顯示的事實一律取自 tables[]，非此。
    model: string; // 產出模型 id；人工樣本填 "hand-authored"
    edited?: boolean; // 人工手改過標 true
    highlights: string[];
    tables: Record<string, { mode: "detail" | "summary"; note?: string }>;
  };
}
```

- [ ] **Step 2: 寫失敗測試**

Create `src/lib/changelog/__tests__/curate.test.ts`：

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  buildCurationPrompt,
  normalizeCuration,
  curateWithClaude,
  curationToAiLayer,
  resolveAiPlan,
  type CurationClient,
} from "../curate";
import type { AiDigest } from "../types";

const digest: AiDigest = {
  summary: { added: 2, changed: 100, removed: 0 },
  addedTables: [],
  removedTables: [],
  tables: [
    {
      table: "items",
      label: "道具",
      tier: "rich",
      counts: { added: 1, changed: 100, removed: 0 },
      addedSample: [{ name: "端午禮盒", fields: { 說明: "開箱可得晝夢冥鰩" } }],
      systematic: [{ label: "售價", from: "0", to: "1", count: 100 }],
    },
  ],
};

describe("buildCurationPrompt", () => {
  it("system 含 zh-tw / 不得杜撰 指示；user 內嵌 digest 事實", () => {
    const { system, user } = buildCurationPrompt(digest);
    expect(system).toContain("繁體中文");
    expect(system).toMatch(/不得杜撰|不得捏造/);
    expect(user).toContain("端午禮盒"); // digest 事實有進 prompt
    expect(user).toContain("售價");
  });
});

describe("normalizeCuration", () => {
  it("過濾不存在的表、限制 highlights 上限、保留 note", () => {
    const raw = {
      highlights: Array.from({ length: 20 }, (_, i) => `h${i}`),
      tables: [
        { table: "items", mode: "summary", note: "售價批量" },
        { table: "ghost", mode: "detail" }, // 不在 knownTables
      ],
    };
    const c = normalizeCuration(raw, ["items"]);
    expect(c.highlights.length).toBeLessThanOrEqual(12);
    expect(c.tables).toEqual([{ table: "items", mode: "summary", note: "售價批量" }]);
  });

  it("形狀壞掉丟錯（讓 CLI 降級）", () => {
    expect(() => normalizeCuration({ nope: true }, ["items"])).toThrow();
    expect(() => normalizeCuration(null, ["items"])).toThrow();
  });
});

describe("curateWithClaude", () => {
  it("用注入的假 client；回傳 normalize 後結果（不打真 API）", async () => {
    let seen: { model: string; system: string; user: string; schema: object } | undefined;
    const fake: CurationClient = {
      async curate(req) {
        seen = req;
        return {
          highlights: ["端午活動上線"],
          tables: [
            { table: "items", mode: "summary", note: "售價批量調整" },
            { table: "ghost", mode: "detail" },
          ],
        };
      },
    };
    const c = await curateWithClaude(digest, { client: fake, model: "claude-opus-4-8" });
    expect(seen!.model).toBe("claude-opus-4-8");
    expect(seen!.user).toContain("端午禮盒");
    expect(c.highlights).toEqual(["端午活動上線"]);
    expect(c.tables).toEqual([{ table: "items", mode: "summary", note: "售價批量調整" }]); // ghost 濾掉
  });

  it("model 預設 claude-opus-4-8", async () => {
    let model = "";
    const fake: CurationClient = {
      async curate(req) {
        model = req.model;
        return { highlights: [], tables: [] };
      },
    };
    await curateWithClaude(digest, { client: fake });
    expect(model).toBe("claude-opus-4-8");
  });
});

describe("curationToAiLayer", () => {
  it("tables 陣列 → 以 table 名為鍵的 Record；edited 預設 false", () => {
    const layer = curationToAiLayer(
      { highlights: ["a"], tables: [{ table: "items", mode: "summary", note: "n" }, { table: "npc", mode: "detail" }] },
      { model: "claude-opus-4-8" },
    );
    expect(layer).toEqual({
      model: "claude-opus-4-8",
      edited: false,
      highlights: ["a"],
      tables: { items: { mode: "summary", note: "n" }, npc: { mode: "detail" } },
    });
  });
});

describe("resolveAiPlan", () => {
  it("--no-ai → 不跑", () => {
    expect(resolveAiPlan({ noAi: true, apiKey: "sk-x" }).runAi).toBe(false);
  });
  it("無金鑰 → 不跑", () => {
    expect(resolveAiPlan({ noAi: false, apiKey: undefined }).runAi).toBe(false);
  });
  it("有金鑰且未停用 → 跑", () => {
    expect(resolveAiPlan({ noAi: false, apiKey: "sk-x" }).runAi).toBe(true);
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `npx vitest run src/lib/changelog/__tests__/curate.test.ts`
Expected: FAIL（`Cannot find module '../curate'`）。

- [ ] **Step 4: 實作 curate.ts（純邏輯 + DI，不 import SDK）**

Create `src/lib/changelog/curate.ts`：

```ts
// AI 策展層：把 digest 變成 highlights + 逐表 mode/note。
// 刻意不 import @anthropic-ai/sdk：真 client 由 CLI 注入（見 scripts/db-changelog.ts）。
// 測試注入假 client，不打真 API、不需金鑰。
import type { AiCuration, AiDigest, ChangelogEntry } from "./types";

const DEFAULT_MODEL = "claude-opus-4-8";
const MAX_HIGHLIGHTS = 12;

// SDK 抽象：CLI 用真 Anthropic 實作，測試用假物件。
export interface CurationClient {
  curate(req: { model: string; system: string; user: string; schema: object }): Promise<unknown>;
}

// Claude structured output schema（json_schema；動態鍵不友善，故 tables 用陣列）。
export const CURATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["highlights", "tables"],
  properties: {
    highlights: { type: "array", items: { type: "string" }, maxItems: MAX_HIGHLIGHTS },
    tables: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["table", "mode"],
        properties: {
          table: { type: "string" },
          mode: { type: "string", enum: ["detail", "summary"] },
          note: { type: "string" },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = [
  "你在為武林同萌傳（TTHOL）玩家寫「更新日誌」，用繁體中文（zh-tw）、遊戲圈口語。",
  "只根據提供的 diff 摘要（digest）下判斷；不得杜撰 digest 沒有的道具、數值或名稱。",
  "逐表判定 detail（有玩法新聞、值得攤開逐列）或 summary（批量／建置噪音，一句帶過）。",
  "把「保留N」「敬請期待」之類佔位符被填入，理解為『新內容上線』而非單純修改。",
  "禮盒／道具說明點名的內容物，照說明轉述（如「開箱可得…」），不得斷言那些內容物本身是新道具。",
  "系統性摺疊、售價批量、上千筆計數變更 → 收成一句，點出是建置調整而非玩法變更。",
  "highlights 3–12 條，聚焦本版真正重點；tables 只列你想標成 summary 或特別要 detail 的表。",
].join("\n");

export function buildCurationPrompt(digest: AiDigest): { system: string; user: string } {
  const user =
    "以下是本次改版的確定性 diff 摘要（JSON）。請據此產出更新日誌策展結果：\n\n" +
    "```json\n" +
    JSON.stringify(digest, null, 2) +
    "\n```";
  return { system: SYSTEM_PROMPT, user };
}

export function normalizeCuration(raw: unknown, knownTables: string[]): AiCuration {
  if (!raw || typeof raw !== "object") throw new Error("AI 回傳非物件");
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.highlights)) throw new Error("AI 回傳缺 highlights 陣列");
  const known = new Set(knownTables);
  const highlights = r.highlights
    .filter((h): h is string => typeof h === "string" && h.trim() !== "")
    .slice(0, MAX_HIGHLIGHTS);
  const tablesRaw = Array.isArray(r.tables) ? r.tables : [];
  const tables: AiCuration["tables"] = [];
  for (const t of tablesRaw) {
    if (!t || typeof t !== "object") continue;
    const o = t as Record<string, unknown>;
    if (typeof o.table !== "string" || !known.has(o.table)) continue;
    if (o.mode !== "detail" && o.mode !== "summary") continue;
    const entry: AiCuration["tables"][number] = { table: o.table, mode: o.mode };
    if (typeof o.note === "string" && o.note.trim() !== "") entry.note = o.note;
    tables.push(entry);
  }
  return { highlights, tables };
}

export async function curateWithClaude(
  digest: AiDigest,
  opts: { client: CurationClient; model?: string },
): Promise<AiCuration> {
  const model = opts.model ?? DEFAULT_MODEL;
  const { system, user } = buildCurationPrompt(digest);
  const raw = await opts.client.curate({ model, system, user, schema: CURATION_SCHEMA });
  return normalizeCuration(raw, digest.tables.map((t) => t.table));
}

export function curationToAiLayer(
  curation: AiCuration,
  meta: { model: string; edited?: boolean },
): NonNullable<ChangelogEntry["ai"]> {
  const tables: Record<string, { mode: "detail" | "summary"; note?: string }> = {};
  for (const t of curation.tables) tables[t.table] = t.note ? { mode: t.mode, note: t.note } : { mode: t.mode };
  return { model: meta.model, edited: meta.edited ?? false, highlights: curation.highlights, tables };
}

export function resolveAiPlan(env: {
  noAi: boolean;
  apiKey: string | undefined;
}): { runAi: boolean; reason: string } {
  if (env.noAi) return { runAi: false, reason: "--no-ai" };
  if (!env.apiKey) return { runAi: false, reason: "未設定 ANTHROPIC_API_KEY" };
  return { runAi: true, reason: "" };
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npx vitest run src/lib/changelog/__tests__/curate.test.ts`
Expected: 全部 PASS。

- [ ] **Step 6: Commit**

```bash
git add src/lib/changelog/types.ts src/lib/changelog/curate.ts src/lib/changelog/__tests__/curate.test.ts
git commit -m "feat(changelog): add curateWithClaude — AI curation with injectable client"
```

---

## Task 4: CLI 串接 + 真 Anthropic client + 降級

**Files:**
- Modify: `package.json:15`（`changelog` script）+ 依賴
- Modify: `scripts/db-changelog.ts`
- 手動驗收（此任務無自動測試；純邏輯已於 Task 3 覆蓋）

**Interfaces:**
- Consumes: `digestForAI`（Task 2）、`curateWithClaude`/`curationToAiLayer`/`resolveAiPlan`/`CurationClient`（Task 3）。
- Produces: 產生的 JSON 於有金鑰時帶 `ai` 層；無金鑰／`--no-ai`／API 失敗時只寫事實層。

- [ ] **Step 1: 裝 SDK、改 script 的 env 載入**

Run: `npm install @anthropic-ai/sdk`

改 `package.json:15`：

```json
    "changelog": "node --env-file-if-exists=.env --import tsx scripts/db-changelog.ts",
```

（`--env-file-if-exists` 讓 `.env` 不存在也不報錯 → 自然降級。positional 版本號傳遞不受影響。）

- [ ] **Step 2: 檔頭用法註解補上新旗標**

`scripts/db-changelog.ts` 第 3-8 行的用法註解改為：

```ts
// 用法（務必「先跑腳本、再 commit 新 DB」）：
//   1. 用新的 tthol.sqlite 覆蓋工作區檔（尚未 git add）
//   2. npm run changelog -- 1.23 [--note "說明"]   （版本號＝第一個位置參數）
//      有 .env 的 ANTHROPIC_API_KEY 時會自動跑 AI 策展；--no-ai 可略過，--model 換模型
//   3. review src/data/changelog/<date>-v1.23.json（highlights 可手改，改過把 ai.edited 設 true）
//   4. git add tthol.sqlite src/data/changelog/*.json && git commit
```

- [ ] **Step 3: 新增 imports 與 Args 欄位**

`scripts/db-changelog.ts` 第 18-21 行的 import 區塊後補上：

```ts
import Anthropic from "@anthropic-ai/sdk";
import { digestForAI } from "../src/lib/changelog/digest";
import {
  curateWithClaude,
  curationToAiLayer,
  resolveAiPlan,
  type CurationClient,
} from "../src/lib/changelog/curate";
```

`Args` interface（第 28-35 行）加兩欄：

```ts
interface Args {
  version?: string;
  date: string;
  note?: string;
  from: string; // git ref 或檔案路徑
  to: string; // 檔案路徑
  force: boolean;
  noAi: boolean;
  model: string;
}
```

`parseArgs` 的 defaults（第 38-43 行）加：

```ts
  const args: Args = {
    date: new Date().toISOString().slice(0, 10),
    from: "HEAD",
    to: path.join(PROJECT_ROOT, DB_FILE),
    force: false,
    noAi: false,
    model: "claude-opus-4-8",
  };
```

parseArgs 迴圈（第 44-56 行）新增兩個分支（放在 `--force` 之後、positional fallback 之前）：

```ts
    if (a === "--force") args.force = true;
    else if (a === "--no-ai") args.noAi = true;
    else if (a === "--model") args.model = argv[++i];
    else if (a === "--version") args.version = argv[++i];
```

用法錯誤訊息（第 104-106 行）補上新旗標：

```ts
    console.error(
      "用法：npm run changelog -- <版本號> [--date YYYY-MM-DD] [--note 說明] [--from HEAD|路徑] [--to 路徑] [--no-ai] [--model <id>] [--force]",
    );
```

- [ ] **Step 4: 加真 Anthropic client 工廠**

在 `main()` 之前（第 100 行 `async function main()` 上方）新增：

```ts
// 真 client：唯一碰 SDK 的地方。金鑰由 SDK 自 process.env.ANTHROPIC_API_KEY 讀取，
// 絕不寫進 prompt/log。structured output 用 json_schema 約束，取文字後 JSON.parse。
function anthropicClient(): CurationClient {
  const anthropic = new Anthropic();
  return {
    async curate({ model, system, user, schema }) {
      const res = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        system,
        messages: [{ role: "user", content: user }],
        output_config: { format: { type: "json_schema", name: "curation", schema } },
      });
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return JSON.parse(text);
    },
  };
}
```

> ⚠️ **實作前先確認 SDK 形狀**：`@anthropic-ai/sdk` 的 `messages.create` + `output_config.format`（json_schema）確切鍵名以 claude-api skill 的 `typescript/` 文件為準；若不確定，先 WebFetch SDK repo 對照，勿臆測。若該版 SDK 的 structured-output 鍵名不同，調整 `output_config` 這段；其餘（DI 介面、JSON.parse、降級）不變。此處若配置有誤，`normalizeCuration` 會丟錯 → 走 Step 5 降級寫事實層，不會產出壞資料。

- [ ] **Step 5: 在寫檔前插入 AI 策展（含降級）**

`scripts/db-changelog.ts` 目前第 138-149 行：null 檢查後、`fsp.writeFile` 之前。把該段改為（在 `if (!entry) {...}` 之後、`await fsp.mkdir(...)` 之前插入）：

```ts
  if (!entry) {
    console.error("新舊 DB 無語意差異（或 HEAD 已是新檔）。未寫檔。");
    process.exit(1);
  }

  // ── AI 策展（可降級）──────────────────────────────
  const plan = resolveAiPlan({ noAi: args.noAi, apiKey: process.env.ANTHROPIC_API_KEY });
  if (plan.runAi) {
    try {
      // entry 結構滿足 digestForAI 的 DbDiff 形參（summary/addedTables/removedTables/tables）
      const curation = await curateWithClaude(digestForAI(entry), {
        client: anthropicClient(),
        model: args.model,
      });
      entry.ai = curationToAiLayer(curation, { model: args.model, edited: false });
      console.log(`\n本版重點（AI 策展，${args.model}，請 review）：`);
      for (const h of entry.ai.highlights) console.log("  • " + h);
    } catch (e) {
      console.warn("\n[警告] AI 策展失敗，僅輸出事實層：" + String(e));
    }
  } else {
    console.log(`\n[提示] 略過 AI 策展（${plan.reason}）。`);
  }
  // ─────────────────────────────────────────────────

  await fsp.mkdir(OUT_DIR, { recursive: true });
```

- [ ] **Step 6: 型別 + lint 檢查**

Run: `npm run typecheck && npm run lint`
Expected: 皆通過。（若 `output_config`/`TextBlock` 型別報錯，回 Step 4 依實際 SDK 型別調整。）

- [ ] **Step 7: 手動驗收降級路徑（不需金鑰、不動既有 fixture）**

前置：工作區已有新版 `tthol.sqlite`（v7.2.5.9），HEAD 為舊版。跑 `--no-ai` 並輸出到暫存日期，避免覆蓋 `2026-07-21-v7.2.5.9.json` 人工樣本：

Run: `npm run changelog -- 7.2.5.9 --no-ai --date 2026-07-22`
Expected：終端印出「[提示] 略過 AI 策展（--no-ai）」+ 各表計數；寫出 `src/data/changelog/2026-07-22-v7.2.5.9.json`，該檔**無 `ai` 欄**（純事實層）。

驗證無 `ai` 欄後刪掉暫存產物：

Run: `git status --short src/data/changelog/`（確認只多了 `2026-07-22-v7.2.5.9.json`）
接著：`rm src/data/changelog/2026-07-22-v7.2.5.9.json`

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json scripts/db-changelog.ts
git commit -m "feat(changelog): wire AI curation into CLI with graceful degradation"
```

---

## Task 5: 頁面渲染 — 本版重點 + 逐表 detail/summary

**Files:**
- Create: `src/lib/changelog/present.ts`
- Create: `src/components/changelog/highlights.tsx`
- Create: `src/components/changelog/table-summary-row.tsx`
- Modify: `src/components/changelog/version-card.tsx`
- Modify: `src/components/changelog/table-section.tsx`（detail 新增列附說明）
- Test: `src/lib/changelog/__tests__/present.test.ts`、`src/components/changelog/__tests__/highlights.test.tsx`、`src/components/changelog/__tests__/table-summary-row.test.tsx`、`src/components/changelog/__tests__/version-card.test.tsx`

**Interfaces:**
- Consumes: `ChangelogEntry.ai`（Task 3）、`RowRef.fields`（Task 1）。
- Produces: `getHighlights(entry): string[]`、`getTableMode(entry, table): "detail" | "summary"`、`getTableNote(entry, table): string | undefined`（`ai` 缺席→detail；`ai` 有但該表未列→detail）。

- [ ] **Step 1: 寫 present 純函式失敗測試**

Create `src/lib/changelog/__tests__/present.test.ts`：

```ts
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/changelog/__tests__/present.test.ts`
Expected: FAIL（`Cannot find module '../present'`）。

- [ ] **Step 3: 實作 present.ts**

Create `src/lib/changelog/present.ts`：

```ts
// 頁面用純取值：把 ai 層缺席時的預設（detail）集中於此，元件不必各自判斷。
import type { ChangelogEntry } from "./types";

export function getHighlights(entry: ChangelogEntry): string[] {
  return entry.ai?.highlights ?? [];
}

export function getTableMode(entry: ChangelogEntry, table: string): "detail" | "summary" {
  return entry.ai?.tables[table]?.mode ?? "detail";
}

export function getTableNote(entry: ChangelogEntry, table: string): string | undefined {
  return entry.ai?.tables[table]?.note;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/changelog/__tests__/present.test.ts`
Expected: PASS。

- [ ] **Step 5: 寫元件失敗測試（highlights + summary row）**

Create `src/components/changelog/__tests__/highlights.test.tsx`：

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Highlights } from "../highlights";

describe("Highlights", () => {
  it("有項目：顯示標題與每條重點", () => {
    render(<Highlights items={["端午活動上線", "日月迷宮拆分"]} />);
    expect(screen.getByText("本版重點")).toBeInTheDocument();
    expect(screen.getByText("端午活動上線")).toBeInTheDocument();
    expect(screen.getByText("日月迷宮拆分")).toBeInTheDocument();
  });

  it("空陣列：不渲染", () => {
    const { container } = render(<Highlights items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

Create `src/components/changelog/__tests__/table-summary-row.test.tsx`：

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TableSummaryRow } from "../table-summary-row";

describe("TableSummaryRow", () => {
  it("顯示標籤、計數、note", () => {
    render(<TableSummaryRow label="道具" counts={{ added: 3, changed: 5844, removed: 45 }} note="售價批量調整" />);
    expect(screen.getByText("道具")).toBeInTheDocument();
    expect(screen.getByText("+3 ~5844 −45")).toBeInTheDocument();
    expect(screen.getByText("售價批量調整")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: 跑測試確認失敗**

Run: `npx vitest run src/components/changelog/__tests__/highlights.test.tsx src/components/changelog/__tests__/table-summary-row.test.tsx`
Expected: FAIL（模組不存在）。

- [ ] **Step 7: 實作兩個 server 元件**

Create `src/components/changelog/highlights.tsx`：

```tsx
import { SparklesIcon } from "lucide-react";

// 無對應 shadcn callout primitive，hand-roll 並比照鄰近 shadcn 視覺詞彙（CLAUDE.md §5）。
export function Highlights({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="border-border/60 bg-muted/30 rounded-lg border p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <SparklesIcon className="text-primary size-4" aria-hidden />
        本版重點
      </p>
      <ul className="space-y-1.5">
        {items.map((h, i) => (
          <li key={i} className="text-sm leading-relaxed">
            {h}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Create `src/components/changelog/table-summary-row.tsx`：

```tsx
// summary 模式：一句話 + 計數，無展開（設計定案 a）。server component。
export function TableSummaryRow({
  label,
  counts,
  note,
}: {
  label: string;
  counts: { added: number; changed: number; removed: number };
  note?: string;
}) {
  return (
    <div className="border-border/60 rounded-md border px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-muted-foreground text-xs">
          {`+${counts.added} ~${counts.changed} −${counts.removed}`}
        </span>
      </div>
      {note ? <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{note}</p> : null}
    </div>
  );
}
```

- [ ] **Step 8: 跑測試確認通過**

Run: `npx vitest run src/components/changelog/__tests__/highlights.test.tsx src/components/changelog/__tests__/table-summary-row.test.tsx`
Expected: PASS。

- [ ] **Step 9: 接進 VersionCard（highlights + 逐表 mode）**

改 `src/components/changelog/version-card.tsx`。第 1-6 行 import 區塊補上：

```ts
import { Highlights } from "./highlights";
import { TableSummaryRow } from "./table-summary-row";
import { getHighlights, getTableMode, getTableNote } from "@/lib/changelog/present";
```

把 `<CardContent>`（第 52-57 行）改為：

```tsx
      <CardContent className="space-y-2">
        <Highlights items={getHighlights(entry)} />
        {tableLine ? <p className="text-muted-foreground text-xs">{tableLine}</p> : null}
        {entry.tables.map((t) =>
          getTableMode(entry, t.table) === "summary" ? (
            <TableSummaryRow
              key={t.table}
              label={t.label}
              counts={t.counts}
              note={getTableNote(entry, t.table)}
            />
          ) : (
            <TableSection key={t.table} data={toSectionData(t)} />
          ),
        )}
      </CardContent>
```

- [ ] **Step 10: detail 新增列附說明（§3 附帶好處）**

改 `src/components/changelog/table-section.tsx`。`RowView`（第 9-13 行）加 `desc?`：

```ts
export interface RowView {
  idParts: string[];
  name?: string;
  href?: string;
  desc?: string;
}
```

在新增區塊的 `<li>`（第 93-97 行）把內容改為附說明：

```tsx
                {data.added.map((r, i) => (
                  <li key={`a-${i}`} className="w-full">
                    <RowLink r={r} />
                    {r.desc ? (
                      <span className="text-muted-foreground ml-2 text-xs">{r.desc}</span>
                    ) : null}
                  </li>
                ))}
```

再改 `version-card.tsx` 的 `toSectionData`（第 8-31 行）：`added` 映射帶入 `desc`（取 `summary` 欄現值）。把 `link` 與 `added` 兩處改為：

```ts
  const link = (r: { idParts: string[]; name?: string }) => ({
    idParts: r.idParts,
    name: r.name,
    href: route ? route(r.idParts) : undefined,
  });
  const addedLink = (r: RowRef) => ({
    ...link(r),
    desc: r.fields?.find((f) => f.col === "summary")?.value,
  });
```

並把 `added: td.added?.map(link),`（第 23 行）改為 `added: td.added?.map(addedLink),`。（`removed`/`changed` 維持 `link`。）

- [ ] **Step 11: VersionCard 整合 render 測試**

Create `src/components/changelog/__tests__/version-card.test.tsx`：

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VersionCard } from "../version-card";
import type { ChangelogEntry } from "@/lib/changelog/types";

const items = { table: "items", label: "道具", tier: "rich" as const, counts: { added: 3, changed: 5844, removed: 45 } };

describe("VersionCard", () => {
  it("有 ai：顯示本版重點；summary 表顯示 note、不出現逐列表格", () => {
    const entry: ChangelogEntry = {
      version: "7.2.5.9",
      date: "2026-07-22",
      summary: { added: 3, changed: 5844, removed: 45 },
      addedTables: [],
      removedTables: [],
      tables: [items],
      ai: {
        model: "claude-opus-4-8",
        highlights: ["端午活動上線"],
        tables: { items: { mode: "summary", note: "售價批量調整" } },
      },
    };
    render(<VersionCard entry={entry} />);
    expect(screen.getByText("本版重點")).toBeInTheDocument();
    expect(screen.getByText("端午活動上線")).toBeInTheDocument();
    expect(screen.getByText("售價批量調整")).toBeInTheDocument();
    expect(screen.queryByText("欄位")).not.toBeInTheDocument(); // summary 無逐列表格
  });

  it("無 ai：不顯示本版重點，退回 detail（表標籤仍在）", () => {
    const entry: ChangelogEntry = {
      version: "7.2.5.9",
      date: "2026-07-22",
      summary: { added: 3, changed: 5844, removed: 45 },
      addedTables: [],
      removedTables: [],
      tables: [items],
    };
    render(<VersionCard entry={entry} />);
    expect(screen.queryByText("本版重點")).not.toBeInTheDocument();
    expect(screen.getByText("道具")).toBeInTheDocument();
  });
});
```

- [ ] **Step 12: 跑本任務全部測試 + 型別 + lint**

Run: `npx vitest run src/lib/changelog/__tests__/present.test.ts src/components/changelog && npm run typecheck && npm run lint`
Expected: 全綠。

- [ ] **Step 13: Commit**

```bash
git add src/lib/changelog/present.ts src/components/changelog/ src/lib/changelog/__tests__/present.test.ts
git commit -m "feat(changelog): render AI highlights and per-table detail/summary"
```

---

## Task 6: 整合驗收 — 全測試 + 真 API 一次跑 + build

**Files:**
- 無新增檔；驗證整條管線並收尾。

**Interfaces:**
- Consumes: Task 1-5 全部產出。

- [ ] **Step 1: 全測試套件**

Run: `npx vitest run src/lib/changelog src/components/changelog`
Expected: 全綠。（若 `npm test` 全量出現 vitest worker 啟動逾時，屬環境 flakiness，非本功能失敗；以 scoped 執行為準並註記。）

- [ ] **Step 2: 型別 + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 皆通過；`/changelog` 於 build 階段靜態渲染成功（讀既有 `2026-07-21-v7.2.5.9.json` 人工樣本，其 `ai` 層照渲染）。

- [ ] **Step 3: 真 API 端到端（需 `.env` 金鑰；手動）**

前置：`.env` 內有 `ANTHROPIC_API_KEY`；工作區為新版 `tthol.sqlite`。覆蓋人工樣本前先備份，用 `--force` 重新產出並比對：

Run: `cp src/data/changelog/2026-07-21-v7.2.5.9.json /tmp/handauthored-backup.json`
Run: `npm run changelog -- 7.2.5.9 --date 2026-07-21 --force`
Expected：
- 終端印出「本版重點（AI 策展，claude-opus-4-8，請 review）」+ 數條 highlights。
- 產出 JSON 帶 `ai` 層（`model: "claude-opus-4-8"`、`edited: false`、`highlights[]`、`tables{}`）。
- 事實層 `tables[]` 與備份一致（AI 未改事實）。

用 diff 對照事實層未變：
Run: `node -e "const a=require('/tmp/handauthored-backup.json'),b=require('./src/data/changelog/2026-07-21-v7.2.5.9.json');console.log('tables 事實一致:',JSON.stringify(a.tables)===JSON.stringify(b.tables))"`
Expected: `tables 事實一致: true`。

- [ ] **Step 4: 人工 review highlights 與頁面**

- 讀產出 JSON 的 `ai.highlights`，確認：端午三任務、三禮盒（含內容物轉述）、日月迷宮拆分、新怪物都在；售價批量／結構調整被收成一句 summary。
- `npm run dev` 開 `/changelog`，確認本版重點區塊 + summary 表一行式 + detail 表可展開皆正常、無 emoji/Unicode 字符、zh-tw。
- 若 highlights 需手改：直接改 JSON，並把 `ai.edited` 設為 `true`。

- [ ] **Step 5: Commit（若採用 AI 產出取代人工樣本）**

由使用者決定是否以 AI 產出取代 `2026-07-21` 人工樣本。若採用：

```bash
git add tthol.sqlite src/data/changelog/2026-07-21-v7.2.5.9.json
git commit -m "chore(changelog): regenerate v7.2.5.9 entry with AI curation"
```

若保留人工樣本，還原：`cp /tmp/handauthored-backup.json src/data/changelog/2026-07-21-v7.2.5.9.json`。

---

## Self-Review

**1. Spec coverage**（逐節對照 spec §3–§10）：

- §3 引擎小改（added/removed 帶 fields）→ Task 1 ✅
- §4 `digestForAI` 有界摘要 → Task 2 ✅
- §5 `curateWithClaude`（structured output、DI、系統提示要點）→ Task 3 ✅
- §6 信任邊界（AI 只 highlights/mode、事實取自 tables[]、禮盒轉述、人工 review、降級）→ Task 3 系統提示 + Task 4 降級 + Task 5 渲染取自 tables[] + Task 6 Step 3 事實一致驗證 ✅
- §7 CLI（`--no-ai`/`--model`、`--env-file-if-exists`、降級、印 highlights、API 失敗仍寫事實層）→ Task 4 ✅
- §8 資料格式（`ChangelogEntry.ai`、陣列→Record）→ Task 3（型別 + `curationToAiLayer`）✅
- §9 頁面（highlights 區塊、逐表 mode、降級退回）→ Task 5 ✅
- §10 測試策略（digest 純函式、curate 假 client、引擎改動、頁面兩態）→ Task 2/3/1/5 測試 ✅
- §13 定案 (a)（summary 無展開）→ Task 5 `TableSummaryRow` 無 Collapsible ✅

**2. Placeholder scan**：全任務步驟均含實際程式碼與明確指令；Task 4 Step 4 的 SDK 形狀「先確認」是真實研究動作（附 fallback），非佔位。無 TBD/TODO。✅

**3. Type consistency**：
- `RowChange` 於 Task 1 改為獨立型別（不 extends `RowRef`），連帶 `version-card.tsx` `link` 放寬型別於同一任務修掉 → typecheck 綠。
- `digestForAI(diff: DbDiff)` 於 Task 4 傳入 `entry`（`ChangelogEntry`）— 結構相容（含 `summary`/`addedTables`/`removedTables`/`tables`）✅
- `CurationClient`、`curateWithClaude`、`curationToAiLayer`、`resolveAiPlan` 於 Task 3 定義，Task 4 依相同簽章消費 ✅
- `getTableMode`/`getHighlights`/`getTableNote`（Task 5）簽章與 `version-card.tsx` 用法一致 ✅
