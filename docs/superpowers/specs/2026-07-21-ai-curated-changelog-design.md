# 設計：AI 策展式 changelog（版本差異 → 玩家看得懂的更新日誌）

- **日期**：2026-07-21
- **狀態**：設計定案（已用真實 v7.2.5.9 改版驗證），待實作
- **前置設計**：[`2026-07-08-db-changelog-design.md`](./2026-07-08-db-changelog-design.md)（確定性 diff 引擎、CLI、`/changelog` 頁面的原始設計）
- **相關**：`tthol.sqlite`、`scripts/db-changelog.ts`、`src/lib/changelog/*`

## 1. 目標與背景

原設計已能把新舊 DB 算出**確定性、結構化的 diff**，並用機械式規則（分層、系統性摺疊、截斷）呈現。實際跑第一次跨 schema 改版（v7.2.5.9）暴露兩個機械做法解不掉的問題：

1. **高變更量的表撐不住呈現**：`items` 一個「售價」欄就 2,931 筆變更，200 筆上限截斷藏掉 2,731 筆——玩家看不到全貌，逐列攤開又是洗版。
2. **語意連結只存在於文字**：新增的「端午禮盒」在 `summary`（說明）裡點名了內容物（背飾「晝夢冥鰩」、坐騎「金樽逐浪」…）。這種「禮盒 → 內含哪些道具」的關係**只存在於 prose**，純 row-diff 永遠連不起來。

**核心轉向**：不再用機械規則硬排每一列，改成**讓 AI（Claude）讀確定性 diff 的濃縮摘要，判斷「這次改版有什麼值得講」，產出編輯式報告**——真新聞列出、噪音一句帶過、逐表決定要不要攤開詳情。

### 定案決策（brainstorming 產物，已用 v7.2.5.9 驗證）

| 決策點 | 結論 |
|---|---|
| 呈現方式 | **AI 策展**：AI 讀 diff 摘要 → 產出 highlights + 逐表判定，取代機械式逐列規則 |
| 詳情去留粒度 | **AI 逐表決定** `detail`（攤開實際列）或 `summary`（一句話 + 計數）；跨表真新聞另收進 top-level highlights |
| 信任邊界 | **AI 只策展 + 寫人話；事實一律來自確定性 diff。AI 絕不產出道具層級的事實**（見 §6） |
| 禮盒／說明內容 | **照商品說明轉述**，不擅自把內含道具標成「新道具」（除非它本身也在 diff 的 added 裡） |
| AI 執行時機 | **本機、產生 changelog 時**呼叫一次；人工 review／手改後才 commit |
| 模型 | `claude-opus-4-8`（structured outputs、adaptive thinking）；可用 `--model` 換 |
| 金鑰 | `.env` 的 `ANTHROPIC_API_KEY`（本機、不進 repo、不上正式機） |
| 成本 | 一次改版約 US$0.05–0.1（一版跑一次，可忽略） |
| 降級 | 無金鑰或 `--no-ai` 時照樣產出結構化 JSON（`ai` 層留空），工具不硬綁 API |

## 2. 架構總覽

```
新 tthol.sqlite
      │
diffDatabases()  ← 現有，確定性 diff【事實層】
      │
digestForAI()    ← 新：把 diff 濃縮成有界摘要（各表/各欄筆數、
      │             added/removed 名單+說明、changed 抽樣）；非全量
curateWithClaude() ← 新：Claude 讀 digest → 結構化策展結果
      │             （highlights + 逐表 mode/note）【策展層】
      │
合併 → ChangelogEntry（tables[] 事實 + ai 策展）
      │
人工 review / 手改 note → git commit → 部署
      │
/changelog 頁（build 時讀 JSON；highlights + 逐表 mode 渲染）
```

六個元件：**(A) diff 引擎小改**（added/removed 帶說明）→ **(B) digest 建構**→ **(C) Claude 策展**→ **(D) CLI 串接**→ **(E) 資料格式**→ **(F) 頁面渲染**。

## 3. 元件 A — diff 引擎小改：rich added/removed 攜帶 surfaced fields

**問題**：現行 `TableDiff.added` / `removed` 只帶 `{ idParts, name }`，不帶其他欄。禮盒的內容物寫在 `summary`，AI 因此看不到。

**改法**：rich 層的 `added` / `removed` 列改為攜帶其 **surfaced fields**（`fields` 白名單內的欄，至少 `summary`）：

```ts
// 之前
added?: { idParts: string[]; name?: string }[];
// 之後（rich 層）
added?: { idParts: string[]; name?: string; fields?: { col: string; label: string; value: string }[] }[];
```

- count 層不受影響（維持 `{ idParts, name? }`）。
- 值同樣套長字串截斷（如 120 字，比照原設計 §5 邊界處理）。
- 附帶好處：頁面對 `detail` 模式的 added 道具，可一併顯示其說明，本來就更好。

## 4. 元件 B — digest 建構 `digestForAI(diff): AiDigest`

純函式、無 I/O，把確定性 diff 濃縮成**有界**摘要餵給 AI（避免把 5,844 筆原始列全塞進 prompt 爆 token）。

```ts
interface AiDigest {
  summary: { added: number; changed: number; removed: number };
  addedTables: string[];
  removedTables: string[];
  tables: {
    table: string; label: string; tier: "rich" | "count";
    counts: { added: number; changed: number; removed: number };
    structural?: { addedColumns: number; removedColumns: number }; // 只給數量，不列欄名
    systematic?: { label: string; from: string; to: string; count: number }[];
    rebuilt?: boolean; noIdentity?: boolean;
    // rich 專用（皆有界；超出附上 truncated 計數）
    addedSample?: { name?: string; fields?: Record<string, string> }[];   // 含 summary
    removedSample?: { name?: string }[];
    changedFieldCounts?: Record<string, number>;                         // 各欄變更筆數
    changedSample?: { name?: string; fields: { label: string; from: string; to: string }[] }[]; // 偏重非批量欄
  }[];
}
```

**有界規則**：`addedSample` / `removedSample` 上限（如各 40）、`changedSample` 上限（如 20，優先挑「觸及非批量欄」的列，例：名稱/說明變更），超出於 digest 內標 `truncated`，讓 AI 知道「還有更多同型」而不逐筆看。

## 5. 元件 C — Claude 策展 `curateWithClaude(digest, opts): AiCuration`

呼叫 `@anthropic-ai/sdk`，用 **structured outputs** 強制回傳固定 schema（不需自行 parse）。

```ts
// Claude 回傳（structured output schema，用 zod / json_schema 約束）
interface AiCuration {
  highlights: string[];                                   // 3–12 條，本版重點（人話、grounded）
  tables: { table: string; mode: "detail" | "summary"; note?: string }[];
}
```

**呼叫細節**：
- `model: "claude-opus-4-8"`（可 `opts.model` 覆寫）
- `thinking: { type: "adaptive" }`、`output_config: { effort: "medium" }`
- `client.messages.parse({ ..., output_config: { format: <schema> } })`
- 不需 streaming（輸出小，`max_tokens` 約 4,000）
- **依賴注入**：`curateWithClaude` 收一個 client（或 fetch-like）介面，測試可注入假 client，不打真 API。

**系統提示要點**（寫進實作）：
- 你在為 TTHOL 玩家寫更新日誌，用**繁體中文（zh-tw）**、遊戲圈口語。
- 只根據提供的 digest 事實下判斷；**不得杜撰 digest 沒有的道具/數值/名稱**。
- 逐表判定 `detail`（有玩法新聞、值得攤開）或 `summary`（批量/建置噪音，一句帶過）。
- 把 `保留N` / `敬請期待` 之類佔位符被填入，理解為「**新內容上線**」而非「修改」。
- 禮盒/道具說明點名的內容物，**照說明轉述**（「開箱可得…」），不得斷言那些內容物本身是新道具。
- 系統性摺疊、售價批量、上千筆 count 變更 → 收成一句，點出是建置調整而非玩法變更。

## 6. 信任邊界與失效防護（設計核心）

**原則：確定性引擎 = 事實；AI = 策展 + 文字。頁面顯示的道具名稱/數值/from→to 一律取自 `tables[]`（引擎），不取自 AI。**

- **AI 幻覺被隔離**：AI 只輸出 highlights（人話）與逐表 mode/note。最糟情況是「重點寫得不好」，人工 review 改掉即可，不會出現不存在的道具。
- **grounding**：highlights 以 digest 提供的真實名稱/說明為據；系統提示明令不得杜撰。
- **禮盒內容 = 轉述非升級**：禮盒說明是「真・新增道具（禮盒本身）的真・說明欄」，可呈現；但內含的「晝夢冥鰩」等在 diff 未必是新列（v7.2.5.9 實測它們早在庫），故只轉述、不標「新」。
- **人工 review 為最後關卡**：CLI 產出後印出報告，使用者可直接手改 JSON 的 `ai` 層，改過標 `edited: true`。
- **本質限制（誠實記載）**：DB diff 抓「row 有沒有變」，非「遊戲有沒有發佈」。早已種在庫、這次才用禮盒發佈的道具，row-diff 抓不到；AI 讀說明文字部分補足，但改不了「changelog = 兩份 DB 快照之差」的本質。

## 7. 元件 D — CLI 串接（`scripts/db-changelog.ts`）

在 `diffDatabases()` 之後、寫檔之前插入：`digestForAI()` → `curateWithClaude()` → 合併進 entry。

- 新旗標：`--no-ai`（略過 AI，只產事實層）、`--model <id>`（換模型）。
- 金鑰：改用 `node --env-file-if-exists=.env --import tsx scripts/db-changelog.ts`（Node 24 支援 `--env-file-if-exists`，`.env` 不存在也不報錯 → 自然降級）；`package.json` 的 `changelog` script 同步改。positional 版本號傳遞不受影響。
- 降級：抓不到 `ANTHROPIC_API_KEY` 或 `--no-ai` → 跳過 AI、`ai` 留空、印提示。
- AI 呼叫失敗（網路/額度/refusal）→ 警告但**仍寫出事實層 JSON**，不讓整個流程失敗。
- 終端印出 highlights 供人工先瞄。

## 8. 元件 E — 資料格式（`ChangelogEntry` 加 `ai` 層）

```ts
interface ChangelogEntry {
  version: string; date: string; note?: string;
  summary: { added: number; changed: number; removed: number };
  addedTables: string[]; removedTables: string[];
  tables: TableDiff[];            // 事實層（現有，不動）
  ai?: {                          // 策展層（新；可為空＝降級）
    model: string;                // 產出模型 id；人工樣本填 "hand-authored"
    edited?: boolean;             // 人工手改過標 true
    highlights: string[];
    tables: Record<string, { mode: "detail" | "summary"; note?: string }>;
  };
}
```

- Claude structured output 回傳 `tables` 為**陣列**（structured outputs 對動態鍵不友善）；CLI 合併時轉成以 table 名為鍵的 **Record**（頁面查找方便）。
- 事實層 `tables[]` 與策展層 `ai` 解耦：`ai` 缺席時頁面退回原機械式呈現。

## 9. 元件 F — `/changelog` 頁面渲染

遵守 CLAUDE.md shadcn-first、lucide 圖示、無 emoji、zh-tw、`force-static`。

- 版本卡頂部新增「**本版重點**」區塊，渲染 `ai.highlights`（清單）。
- 每表由 `ai.tables[t.table].mode` 驅動：
  - `detail` → 沿用原逐列呈現（added/changed/removed，深連 `/items/[id]` 等）。
  - `summary` → 只顯示 `ai.tables[t.table].note` 一句 + 計數 badge，不可展開。
- **降級**（`entry.ai` 缺席）→ 完全退回原機械式呈現，頁面不炸。

## 10. 測試策略（vitest）

- `digestForAI()`：純函式，記憶體 DB → 斷言濃縮正確、**有界**（不外洩全量）、rich added 帶得到 summary。
- `curateWithClaude()`：**依賴注入假 client**，不打真 API、不需金鑰；斷言 digest → 呼叫參數、structured 回傳 → 合併成 `ai` 層正確。
- 引擎改動 A：斷言 rich added/removed 帶 surfaced fields、值有截斷；count 層不受影響。
- 頁面：`ai` 有／無兩種資料都能渲染（含 `detail`/`summary` 兩種 mode）。
- 人工驗收：真檔跑一次，對照 highlights 與頁面。

## 11. 驗證證據（v7.2.5.9，已完成）

已用真實 v7.2.5.9 改版手工走完整條管線（見 `src/data/changelog/2026-07-21-v7.2.5.9.json` 的 `ai` 層，`model: "hand-authored"`）：

- digest 有界但保住真新聞：端午三任務、三禮盒、日月迷宮拆分全數留住。
- AI 正確把 `保留1→端午辨真偽`、`敬請期待→前往成都藥鋪` 重新理解為「新內容上線」。
- 2,931 筆售價、51 欄結構改名、上千筆 count 變更 → 各收成一句。
- 禮盒內容照說明轉述成功。
- 六行 highlights 讓玩家一次看懂改版。

此檔即第一份人工樣本 + 實作 fixture。

## 12. 檔案清單

| 檔案 | 動作 | 用途 |
|---|---|---|
| `src/lib/changelog/types.ts` | 改 | `TableDiff.added/removed` 帶 fields；新增 `AiDigest`/`AiCuration`；`ChangelogEntry` 加 `ai` |
| `src/lib/changelog/diff.ts` | 改 | rich added/removed 填 surfaced fields |
| `src/lib/changelog/digest.ts` | 新 | `digestForAI()` 純函式 |
| `src/lib/changelog/curate.ts` | 新 | `curateWithClaude()`（DI client） |
| `src/lib/changelog/__tests__/*` | 新/改 | digest、curate（假 client）、引擎改動測試 |
| `scripts/db-changelog.ts` | 改 | 串接 AI 步驟、`--no-ai`/`--model`、env 載入、降級 |
| `package.json` | 改 | `changelog` script 改 env 載入；加 `@anthropic-ai/sdk`（+ zod，若採用）依賴 |
| `src/app/changelog/page.tsx` | 改 | 渲染 `ai.highlights` |
| `src/components/changelog/*` | 改 | 逐表依 `ai.tables[x].mode` 呈現 detail/summary |

## 13. 未決 / 後續（不阻擋實作）

- **禮盒內容深連詳情頁**：把說明裡的道具名解析成 `/items/[id]` 連結（需 prose→名稱→id 比對，模糊，先列後續）。
- **highlights 更強 grounding**：讓 AI 引用 diff 實體 id、CLI 驗證存在才收（初版靠系統提示 + 人工 review）。
- **`--regenerate`**：對既有 entry 只重跑 AI 層、不重算 diff。
- **~~被 AI 收進 `summary` 的表，是否需要「展開看完整清單」的保底？~~ 已定案 (a)**（2026-07-22）：接受 AI 裁量，`summary` 模式只顯示 note 一句 + 計數 badge，**不提供展開**。逐列事實仍保留在 `tables[]` JSON（受 200 筆截斷）供 raw 檢視／未來擴充；日後真有需求再補 (b) 展開/下載 UI。
