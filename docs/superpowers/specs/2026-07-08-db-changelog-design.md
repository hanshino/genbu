# 設計：tthol.sqlite 版本差異 → 公開更新日誌 (changelog)

- **日期**：2026-07-08
- **狀態**：設計定案（已納入 review 回饋），待實作
- **相關**：`tthol.sqlite`（每次更新由 `../tthol_data` 建置管線重灌）

## 1. 目標與背景

網站的資料全來自唯讀的 `tthol.sqlite`（18MB binary，直接 commit 進 git，非 LFS）。目前的更新儀式是：拿到新 DB → 覆蓋正式機 → 重新部署。使用者希望：

- 在**本地**算出新舊 DB 的語意差異；
- 做成一條一條、可視化的 **公開更新日誌**（網站上的 `/changelog` 頁），給玩家看；
- 每筆對齊一個**手動輸入的遊戲版本號**。

關鍵前提：**git 本身已經保存每一版 DB 的完整快照**，所以差異可用「HEAD 的舊 blob vs 工作區新檔」重現，不必額外保存舊 DB。

### 定案決策（brainstorming 產物）

| 決策點 | 結論 |
|---|---|
| 受眾／位置 | 網站上的**公開更新頁** `/changelog` |
| 版本號來源 | 每次更新**手動輸入**（`--version`） |
| 追蹤範圍 | **全部玩法表**（排除 `knex_migrations`、`knex_migrations_lock`、`sqlite_*`） |
| 計算方式 | **本地腳本** + 產出 JSON 快照 commit 進 repo（方案 A）；否決 runtime 雙 DB diff（方案 B） |
| 歷史 backfill | 不做，從這次開始記錄 |
| 項目粒度 | **分層**：精華層逐欄中文標籤+深連詳情頁；計數層只顯示計數 |

## 2. 原型試算的關鍵發現（實作必讀）

用真實新舊檔（舊：`genbu/tthol.sqlite`；新：`tthol_data/tthol.sqlite`）跑過拋棄式原型，證實：

1. **機制成立**：識別欄設對後，任務/對話/道具都能乾淨比出來。實例：新任務「端午辨真偽」、`missions.help`「敬請期待」→ 完整劇情、任務步驟「敬請期待0」→「前往成都藥鋪進行準備。」、NPC「孫小五」→「慌張的村民」、道具改名「白蘿蔔」→「夏日水花」。

2. **`items` / `npc` / `monsters` 沒有宣告 PRIMARY KEY**，但都有穩定的遊戲 `id` 欄（`items.id=20000 銀兩`）。
   → **識別欄必須可在設定檔逐表指定**，不能只信 `PRAGMA table_info` 的 pk 旗標。誤用會把「改一個數值」算成「刪一筆+加一筆」。

3. **噪音炸彈一：schema change**。測試檔剛好跨了一次建置管線大改（欄位改名/拆分：`def→extra_def`、`min_damage→damage_min`、`level→base_lv`、`picture→icon`…）。純逐欄比對噴出 13,315 筆假變更，全是 `舊值 → undefined`。
   → 引擎必須**先做 schema diff，只比對兩邊都存在的欄位交集**，並將「新增/移除欄位」單獨列成一行「資料結構調整」，不進 row-level diff。

4. **噪音炸彈二：系統性整批位移**。`items.target` 欄有 11,141 筆全部 `512→2`（單一 from→to 覆蓋該欄 >90% 的變更）。這是建置編碼調整，不是上萬個道具改數值。
   → 引擎**自動偵測**：某欄的變更中，若單一 `from→to` 配對覆蓋率 > 90%（且 distinct 配對數很少），**摺疊成一行摘要**（例：「`target` 全表 512→2」），不炸成上萬列。

5. 濾掉上述噪音後，這次道具真正的「新聞」很短：約 13 個新道具、4 個改名、少數幾筆真實數值調整（`atk 0→150`）、23 筆描述改寫、一批售價（`value`）調整。**這短短一段才是玩家要看的內容** —— 證明分層 + 噪音抑制的方向正確。

> ⚠️ 測試檔是「最壞情況」（跨 schema 改版）。日常連續兩版通常同 schema，逐欄 diff 會乾淨得多。

> 🆕 **首次執行的預期行為**：目前 `HEAD` 的 DB 仍是舊 schema（`def`/`min_damage`/`level`…），而設定檔 `fields` 全用新欄名。首跑 diff 時這些欄多半落在「欄位交集」之外，第一份 changelog 會把大量改名欄位歸進 `structural`（資料結構調整）而非逐欄數值變更——這是設計的既定行為，不是引擎壞掉。之後連續同 schema 的版本就會乾淨呈現數值差異。

## 3. 架構總覽

```
新 tthol.sqlite (覆蓋工作區)
        │
        ▼
  npm run changelog -- --version 1.23
        │  (git show HEAD:tthol.sqlite = 舊 ; 工作區 = 新)
        ▼
  ┌──────────────────────────────┐
  │ diff 引擎 (src/lib/changelog) │  ← 純函式、可測
  │  · schema diff               │
  │  · 逐表 row diff (依識別欄)   │
  │  · 系統性摺疊                 │
  │  · 分層欄位設定檔套用         │
  └──────────────────────────────┘
        │
        ▼
  src/data/changelog/2026-07-08-v1.23.json  (人工 review、可手改 note)
        │
        │  git add tthol.sqlite + JSON ; commit ; 部署
        ▼
  /changelog 頁 (server component, build 時讀 JSON 渲染)
```

四個元件：**(A) 表設定檔** → **(B) diff 引擎** → **(C) CLI 腳本** → **(D) /changelog 頁面**。

## 4. 元件 A — 表設定檔 (`src/lib/changelog/config.ts`)

單一事實來源，決定每張表怎麼被解讀與呈現。使用者會 review 這份。

```ts
export interface TableProfile {
  tier: "rich" | "count";        // 精華層 / 計數層
  label: string;                 // zh-tw 顯示名，如 "道具"
  identity: string[];            // 識別欄（必填，覆寫自動偵測）
  displayName?: string;          // 顯示名稱欄；無則顯示識別值
  fields?: Record<string, string>; // rich 專用：surfaced 欄 → zh-tw 標籤；其餘欄一律忽略
  detailRoute?: (idParts: string[]) => string; // rich 專用：深連既有詳情頁；收識別欄「各部位」陣列，複合鍵可取 idParts[0]（如 magic 用 skill id）
}

export const EXCLUDE = new Set([
  "knex_migrations", "knex_migrations_lock",
]); // sqlite_* 一律排除

export const PROFILES: Record<string, TableProfile> = {
  items: {
    tier: "rich", label: "道具", identity: ["id"], displayName: "name",
    fields: {
      name: "名稱", summary: "說明", value: "售價",
      atk: "攻擊", matk: "法攻", extra_def: "防禦", magic_def: "法防",
      hp: "HP", mp: "MP", hit: "命中", dodge: "迴避",
      str: "力", pow: "氣", vit: "體", dex: "技", agi: "敏", wis: "智",
      damage_min: "傷害下限", damage_max: "傷害上限",
      base_lv: "需求等級", type_name: "類型",
    },
    detailRoute: (id) => `/items/${id}`,
  },
  magic: { // 技能：識別 (id, level)，顯示時以 name 分組
    tier: "rich", label: "技能", identity: ["id", "level"], displayName: "name",
    fields: { name: "名稱", help: "說明", spend_mp: "耗魔", target: "目標", clan: "門派" },
    detailRoute: (idParts) => `/skills/${idParts[0]}`, // idParts = [id, level]，詳情頁用 skill id
  },
  monsters: {
    tier: "rich", label: "怪物", identity: ["id"], displayName: "name",
    fields: { name: "名稱", level: "等級", hp: "HP", extra_def: "防禦",
      damage_min: "傷害下限", damage_max: "傷害上限", drop_exp: "經驗" },
    detailRoute: (id) => `/monsters/${id}`,
    // drop_item(json) 不列入 fields → 忽略
  },
  item_rand: { // 裝備隨機屬性：一件裝備多列（每屬性一列）→ 複合識別 (id, attribute)
    tier: "rich", label: "裝備隨機屬性", identity: ["id", "attribute"], displayName: "attribute",
    fields: { min: "最小值", max: "最大值", rate: "機率" },
    detailRoute: (idParts) => `/items/${idParts[0]}`, // idParts = [id, attribute]
  },
  missions:      { tier: "rich", label: "任務", identity: ["id"], displayName: "name",
                   fields: { name: "名稱", help: "說明" }, detailRoute: (id) => `/missions/${id}` },
  mission_steps: { tier: "rich", label: "任務步驟", identity: ["mission_id", "step_index"],
                   fields: { plain_text: "步驟文字" } }, // raw_text 與 plain_text 擇一，避免重複
  npc:           { tier: "rich", label: "NPC", identity: ["id"], displayName: "name",
                   fields: { name: "名稱", level: "等級" } }, // 無詳情頁
  npc_strings:   { tier: "rich", label: "NPC 對話", identity: ["id"], displayName: "name",
                   fields: { name: "顯示名" } },
  message_options: { tier: "rich", label: "對話選項", identity: ["file_no", "msg_id", "opt_index"],
                     displayName: "text", fields: { text: "選項文字" } },

  // 計數層（只顯示 +N ~N -N；有 displayName 就列新增/移除名稱）
  messages:    { tier: "count", label: "對話訊息", identity: ["file_no", "msg_id"] }, // triggers 為不透明 DSL
  mission_refs:{ tier: "count", label: "任務關聯", identity: ["id"] },
  map_warps:   { tier: "count", label: "地圖傳送點", identity: ["id"] },
  // …其餘玩法表比照 count 層，識別欄依 PRAGMA 自動偵測，偵測不到才手動補
};
```

**運作規則**

- 沒列進 `PROFILES` 的表：預設 `tier:"count"`，識別欄用 `PRAGMA table_info` 自動偵測（複合 PK 支援）；偵測不到 → **改用「整列所有欄的雜湊」當 identity 做 multiset diff**：added/removed 是真實的新增/移除列（不計 changed），並標記 `noIdentity:true`。（純 row-count 淨差無法分辨 added 與 removed，故用全列雜湊；同雜湊計數以保留重複列。）
- rich 層的 `fields` 是**白名單**：只有列出的欄會進 row-level diff 與顯示，其餘欄（`icon`、`oicon`、`log`、`flag_*`、`*_sound`、`type_calc*`…）一律忽略。這是壓噪音最大的槓桿。
- `identity` / `fields` 的欄位以**新 schema（現行建置管線）**為準；舊 schema 已淘汰。

## 5. 元件 B — diff 引擎 (`src/lib/changelog/diff.ts`)

純函式、無 I/O 副作用（DB 連線由呼叫端注入），方便用記憶體 DB 做單元測試。

```ts
diffDatabases(oldDb, newDb, profiles, opts): DbDiff
```

**演算法（逐表）**

1. **表級 diff**：比對兩邊 table 名單 → `addedTables` / `removedTables`。兩邊都有的才做 row-level。
2. **schema diff**：`PRAGMA table_info` 取兩邊欄位集合 → `addedColumns` / `removedColumns`。row-level 只比對**欄位交集**。有結構變動時輸出一則 `structuralNote`。
3. **識別欄**：取 `profile.identity`；無 profile 時自動偵測 pk；仍無 → **以整列所有欄的雜湊作 identityKey**，做 multiset diff：added/removed 為真實的新增/移除列（同雜湊計數以保留重複列），不計 changed，標記 `noIdentity:true`。
4. **載入兩側 rows** 建 `Map<identityKey, row>`（identityKey = 識別欄值以 U+0001 控制字元串接）。
5. **added / removed**：new 有 old 無 → added；old 有 new 無 → removed。
6. **changed**：兩側都有的 key，逐欄比對「交集欄 ∩（rich 層再 ∩ fields 白名單）」。值以 `String()` 正規化比較（null → `""`）。有差異記 `{ col, label, from, to }`。
7. **系統性摺疊**：對每個 (表, 欄) 統計變更中的 `from→to` 分布；若最高頻配對覆蓋率 > 90% 且 distinct ≤ 3 **且該欄總變更數 ≥ 100**（絕對筆數門檻，避免把少量真實調整誤判為建置雜訊），將該欄標為 `systematic`，摺疊成一則 `{ col, label, from, to, count }` 摘要，**從個別 row 的 changed 明細移除該欄**。若某 row 摺疊後已無 surfaced 變更，該 row 不列入 changed。摺疊後的摘要**必定顯示於頁面**（含 `from→to` 與筆數），故即使是真實的全表數值調整（如售價齊漲）玩家仍看得到「售價 100→120，全表 N 筆」這則頭條，只是不逐列展開。

**輸出型別**（→ 序列化成 JSON）

```ts
interface DbDiff {
  addedTables: string[];
  removedTables: string[];
  tables: TableDiff[];   // 有任何變動的表才收錄，rich 排前
  summary: { added: number; changed: number; removed: number };
}
interface TableDiff {
  table: string; label: string; tier: "rich" | "count";
  counts: { added: number; changed: number; removed: number };
  structural?: { addedColumns: string[]; removedColumns: string[] };
  systematic?: { col: string; label: string; from: string; to: string; count: number }[];
  // rich 層才填明細；count 層 added/removed 只帶 {idParts,name}，changed 省略
  // idParts = 原始識別欄陣列（供 detailRoute 與顯示；不含控制字元）
  added?:   { idParts: string[]; name?: string }[];
  removed?: { idParts: string[]; name?: string }[];
  changed?: { idParts: string[]; name?: string; fields: { col: string; label: string; from: string; to: string }[] }[];
  noIdentity?: boolean;
}
```

**邊界處理**

- 複合識別欄 → 記憶體內比對用 U+0001 控制字元分隔串接成 identityKey（避免 `(10714,1)` 與 `(1071,41)` 串成同鍵 `107141`）。**但輸出 JSON 不寫入含控制字元的字串**：每列另存原始識別欄陣列 `idParts: string[]`，顯示與 `detailRoute` 皆用它；若需單一 `id` 字串則以 `/` 連接。`magic` 顯示時前端再依 `name` 分組（同技能多等級）。
- rich 層明細可能仍很長（例：`items.value` 售價變更數千筆且非系統性）→ **每表明細設上限**（如 200 筆），超過則截斷並記 `truncated:N`；前端顯示「另有 N 筆未列出」。截斷屬「刻意設限」，須在輸出與 UI 明示（不可靜默吞掉）。
- 長字串（說明、對話）比較用完整值，但輸出前截斷到合理長度（如 120 字）避免 JSON 爆量。
- **整表重建防呆（計數層 id 穩定性）**：計數層多倚賴 AUTOINCREMENT `id` 的 append 穩定性，這是來源建置管線的性質、非保證。若來源某次重排導致某表 added+removed 超過該表列數的 50%，會噴出上千筆假新增/移除（系統性摺疊只作用於 changed，救不了此情形）→ 引擎偵測到此比例時，摺疊成一行「整表重建（識別不穩定，+N/−N）」，不逐列展開。

## 6. 元件 C — CLI 腳本 (`scripts/db-changelog.ts`, `npm run changelog`)

**流程**

1. 解析參數：`--version <字串>`（必填）、`--date <YYYY-MM-DD>`（預設今天）、`--note <字串>`（選填）、`--from <git-ref|路徑>`（預設 `HEAD` 的 `tthol.sqlite` blob）、`--to <路徑>`（預設工作區 `tthol.sqlite`）、`--force`。
2. 取舊 DB：以 `child_process.spawn("git", ["show", "HEAD:tthol.sqlite"])`（**不經 shell**）把 stdout 以 buffer pipe 進 OS temp 的 `WriteStream`；**切勿用 PowerShell/shell 重導向**（Windows 下 `>` 會做編碼轉換破壞二進位 blob）。新 DB 用工作區檔。兩者以 better-sqlite3 唯讀開啟。
3. 呼叫 `diffDatabases(...)`，組成 changelog entry（含 version / date / note / summary / tables）。
4. 寫檔 `src/data/changelog/<date>-v<version>.json`；終端印摘要（各表 +N ~N -N、結構變動、系統性摺疊）供人工瞄一眼。
5. 提示使用者：review JSON、可手改 `note`，再 `git add tthol.sqlite src/data/changelog/*.json && git commit`。

**錯誤處理**

- 缺 `--version` → 印用法並 exit 1。
- diff 為空（新舊無差異，或使用者已先 commit 新 DB 使 `HEAD` == 新檔）→ 警告「無變更，未寫檔」並 exit 1，避免產生空 entry。
- 目標 JSON 已存在 → 除非 `--force` 否則拒絕覆寫。
- `git show HEAD:tthol.sqlite` 失敗（HEAD 無此檔）→ 提示改用 `--from <路徑>`。

**關鍵使用規則**：**先跑腳本、再 commit 新 DB**。（順序寫進 README / 腳本說明。）

**TS 執行方式**：repo 既有 `scripts/*.mjs` 以 `node` 直跑、無 `tsx`/`ts-node`。CLI 以 TS 撰寫（`scripts/db-changelog.ts`）並**加 `tsx` 為 devDependency**，`package.json` 的 `changelog` script = `tsx scripts/db-changelog.ts`。為免 CLI 端還要解析 `@/` 路徑別名，**腳本與 `src/lib/changelog/*` 引擎之間一律用相對路徑 import**（`@/` 別名只留給 Next 頁面；引擎為純函式、不 import 任何 Next/alias 相依，才能同時被頁面與 CLI 共用）。

## 7. 元件 D — 資料格式與 `/changelog` 頁面

### 資料存放

- 一版一檔：`src/data/changelog/<YYYY-MM-DD>-v<version>.json`（好排序、PR 一眼看出新增一版）。
- 不做 index.json（YAGNI）——頁面 server component 直接讀整個資料夾。
- Entry 結構 = `{ version, date, note, summary, addedTables, removedTables, tables: TableDiff[] }`。

### 頁面 `src/app/changelog/page.tsx`（Server Component）

讀 `src/data/changelog/*.json`，依日期新→舊。遵守 CLAUDE.md 的 **shadcn-first**：

> **必須靜態渲染**：正式機用 Next `output: "standalone"`（見 `next.config.ts`），runner 內**只有 `.next/standalone` + `.next/static` + `public`，沒有 `src/` 目錄**。頁面須 `export const dynamic = "force-static"` 且**不使用任何 dynamic API**（`cookies`/`headers`/動態 `searchParams`…），使 `fs.readdir("src/data/changelog")` 只發生在 **build 階段（builder stage，repo 完整）**、產出靜態 HTML；runtime 不再讀檔。否則本機 dev 正常、上線必炸（`ENOENT: src/data/changelog`）。

- 每版一張 `Card`：標頭 `Badge`（版本號）+ 日期 + `note`；摘要列以綠/琥珀/紅 `Badge` 顯示 `+130 新增 · 52 變更 · −4 下架`，圖示用 lucide `Plus` / `PencilLine` / `Minus`（**禁用符號字元/emoji**）。
- 結構變動（若有）以一則明顯的 note 呈現：「資料結構調整：新增欄位 X、移除欄位 Y」。
- 每張表一個可收合區塊（用既有 `src/components/ui/collapsible.tsx`），**預設收合、先露出計數**；rich 表排前、core（道具/技能/怪物）最前。
- 展開後：
  - **系統性摺疊**：一行「`攻擊目標` 全表 512→2（建置調整，11141 筆）」。
  - **新增/下架**：列名稱；rich 且有 `detailRoute` 者深連詳情頁（`/items/[id]` 等）。
  - **變更**：名稱 + 小 `Table`「欄位 / 舊 → 新」（用 zh-tw 標籤）。
  - 截斷時顯示「另有 N 筆未列出」。
- 在 `src/components/layout/navbar.tsx` 加 `/changelog` 連結。

## 8. 測試策略（vitest，既有 `*.test.ts` 慣例）

`src/lib/changelog/__tests__/diff.test.ts`：用記憶體 better-sqlite3 建小 schema，斷言：

- added / removed / changed 依識別欄正確判定；
- 複合識別欄；無識別欄 fallback（全列雜湊 multiset diff → added/removed，無 changed，含重複列計數）；
- rich 層 `fields` 白名單：白名單外的欄變動**不**產生 changed；
- schema diff：新增/移除欄位進 `structural`、不進 row-level；只比交集欄；
- 系統性摺疊：>90% 單一配對**且 ≥100 筆**的欄被摺成一行，且從個別 row 明細移除；**未達 100 筆**的同型變更不摺疊、仍逐列呈現；
- 整表重建防呆：added+removed 超過表列數 50% 時摺疊成單行、不逐列噴出；
- 明細截斷上限與 `truncated` 計數。

**人工驗收**：拿現有新舊檔跑一次腳本，對照 JSON 與 `/changelog` 頁面渲染。

## 9. 檔案清單

| 檔案 | 用途 |
|---|---|
| `src/lib/changelog/config.ts` | 表設定檔（PROFILES / EXCLUDE） |
| `src/lib/changelog/diff.ts` | 純函式 diff 引擎 |
| `src/lib/changelog/types.ts` | DbDiff / TableDiff / TableProfile 型別 |
| `src/lib/changelog/__tests__/diff.test.ts` | 單元測試 |
| `scripts/db-changelog.ts` | CLI 腳本（`npm run changelog`） |
| `src/data/changelog/*.json` | 每版差異快照（產出物，commit 進 repo） |
| `src/app/changelog/page.tsx` | 公開更新頁 |
| `src/components/changelog/*` | 版本卡、可收合表區塊等元件 |
| `src/components/layout/navbar.tsx` | 加 `/changelog` 連結（修改既有） |
| `package.json` | 加 `"changelog"` script + `tsx` devDependency（修改既有） |

## 10. 未決 / 後續可精修（不阻擋實作）

- **售價（`value`）大量變更**：本次非系統性但達數千筆，UI 可能需要「售價調整專區/摘要」而非逐筆列出；先用截斷上限擋著，日後再評估。
- **placeholder 填坑語意**：「保留1 → 端午辨真偽」目前歸類為「變更」，語意上更像「新增內容」；未來可加規則把「舊值符合 `保留\d*`/`敬請期待`」的變更升級為「新增」。
- **magic 分組顯示**：同技能多等級的 row 在前端依 `name` 分組，避免同名洗版。
- rich 層各表 `fields` 標籤是初版建議，使用者 review `config.ts` 時可增刪。
