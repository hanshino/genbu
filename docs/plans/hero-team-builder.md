---
title: Hero Team Builder implementation plan
created: 2026-08-13
status: approved
---

# Hero Team Builder

## 問題／目標

目前英雄頁能查詢英雄與 `hero_connect` 組合，但玩家無法回答：「指定主英雄後，選幾位相惜英雄，哪一組隊伍能讓指定 bonus 最高？」本功能提供透明、可重現的 client-side optimizer：固定一位主英雄，從其他英雄選出 1–4 位 companions，列出最多 Top 10 的可行隊伍與啟動連結的八項加成總和。

## Settled scope

- 隊伍由 **1 位固定主英雄 + 1–4 位相惜英雄** 組成，最多 5 位。
- `hero_connect` 組合必須由全員在隊伍中才算觸發。
- 所有已觸發連結的 `hp/mp/atk/matk/def/mdef/dodge/hit` bonus 直接相加；這是第一版的透明計算假設，不宣稱遊戲引擎的完整疊加規則。
- 第一版目標固定為八項：`hp`、`mp`、`atk`、`matk`、`def`、`mdef`、`dodge`、`hit`。
- 結果只顯示 Top 10，產品文案只稱「連結加成總和」，不稱戰力、最佳隊伍或官方推薦。
- candidate pool 必須包含所有可能成為最佳解的英雄；不得只取主英雄直接參與的組合成員而漏掉只由 companions 完成的連結。
- 主英雄可搜尋全部 84 位英雄；玩家可選擇「全部英雄皆可用」或只使用自己勾選的英雄。optimizer 只能從可使用集合挑 companions，主英雄一律自動保留。
- 結果分開顯示「含主英雄的連結」與「相惜英雄彼此連結」。未持有英雄只可出現在「再多一位會更好」建議，不得混入當前答案。
- empty state 必須區分「可用人數不足」與「人數足夠但無完整連結」。
- optimizer 為 client-side pure function；不新增 API、Web Worker、dependency，不修改 DB。
- 先做 Open Design 互動 mockup；使用者明確回覆 OK 後，才進入 implementation。

## Non-goals

- 不計算等級、靈氣、英雄自身 stats、完整變身能力或其他未列入八項的效果。
- 不提供自訂權重、名冊儲存、分享或帳號功能。
- 不宣稱有官方「最佳」或 tier 結果；不推導 `hero_connect` 未記錄的觸發條件。
- 不做 API、Web Worker、新 dependency、DB schema/data 修改。
- 不在本 plan 內設計 CMS 或通用 optimizer framework。

## 資料證據

| 證據                                              | 用途                                                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/lib/types/hero.ts:5-75`                      | `HeroStats`、`HeroSummary`、`HeroCombination` 與 nullable 八項 bonus 的型別；null 保留原始資料語意 |
| `src/lib/queries/heroes.ts:13-28`                 | 取得英雄列表與 `hero_connect` 參與次數                                                             |
| `src/lib/queries/heroes.ts:49-90`                 | 取得單一英雄與自身 stats；本功能不使用自身 stats                                                   |
| `src/lib/queries/heroes.ts:117-149`               | 將 `hero_connect` row 轉為 members 與 bonus；null 不補寫回資料                                     |
| `src/lib/queries/heroes.ts:152-175`               | 目前只支援依單一英雄反查組合；team builder 需要新增全量組合 query                                  |
| `src/lib/queries/__tests__/heroes.test.ts`        | 既有英雄 query、84 筆 hero、75 筆連結及 nullable bonus 的測試依據                                  |
| `src/lib/queries/__tests__/schema-smoke.test.ts`  | SQLite schema smoke test 的既有位置                                                                |
| `src/app/heroes/page.tsx`                         | 現有英雄入口；可加入 team builder 入口／CTA                                                        |
| `src/components/heroes/hero-combination-list.tsx` | 現有八項 bonus 顯示順序與「目前未知」文案；新 UI 應維持資料語意邊界                                |
| `src/components/ui/combobox.tsx`                  | 可重用的 accessible Combobox primitive                                                             |
| `src/components/compare/item-picker.tsx`          | 搜尋、鍵盤選取、最多 10 筆候選的既有 picker pattern                                                |
| `src/components/layout/navbar.tsx:15-46`          | 導覽群組與 active route pattern；team builder 可掛在英雄資料庫入口下                               |

## 關鍵決策

1. **全員觸發：** 對每個 `hero_connect`，只有其所有 non-null members 都出現在隊伍中才啟動；主英雄不是特殊觸發例外。
2. **允許 companions-only link：** 一組連結可以完全由 companions 包含，即使 `hero_connect` 不含主英雄，也要計入，避免漏掉最佳解。
3. **恰好 slots：** 每個候選結果枚舉恰好 `slots` 個 companions；`slots` 為 1–4，不用「最多 slots」混合不同隊伍大小。
4. **null arithmetic：** 計算時 `null` 視為 0；原始 `null` 仍保留在 query/model，UI 不把 null 說成資料庫實際 0。
5. **排序：** 先按指定 target 的 `targetScore` descending；同分時按 companion IDs 的 ascending lexicographic tuple 排序，確保穩定可重現。
6. **可行結果：** 至少啟動一組連結才列入結果；沒有任何 triggered link 時不列出，即使隊伍本身合法。
7. **資料載入：** Server page 取得 heroes 與全量 combinations，轉成可序列化 props 傳給 client optimizer/UI；不把 `getDb()` 帶進 client。

## Mockup approval gate（先於 implementation）

先交付 Open Design 互動 mockup，mockup 通過使用者明確「OK」後，才可建立下列 implementation units。mockup 必須展示：

- desktop 與 mobile breakpoint；
- 主英雄搜尋／選取（可用 ID 或名稱搜尋）；
- companions 格數選擇 1–4，並清楚顯示隊伍上限 5；
- 八項目標選擇：hp、mp、atk、matk、def、mdef、dodge、hit；
- Top 10 結果卡，顯示主英雄、companions、`targetScore`、已啟動連結；
- 每張結果卡顯示八項「連結加成總和」，不能混入英雄自身 stats；
- 假設文案：「全員在隊伍才觸發」與「所有已觸發連結的 bonus 直接相加」；
- empty state、無可行結果 state、loading/error 邊界（即使 optimizer 本身同步）；
- keyboard navigation、visible focus、combobox label、結果區域可被 screen reader 理解；
- mobile 上不需橫向捲動即可讀取主英雄、隊伍、目標與主要結果。

Approval record：2026-08-13 使用者核可 roster-v2 mockup，並明確要求依此實作。核可稿：`genbu-hero-team-builder-roster-v2-fd67/hero-team-builder.html`。

## Implementation units（mockup OK 後）

### 1. Data query and contracts

- Modify `src/lib/queries/heroes.ts`：新增取得全量 `HeroCombination[]` 的 server query，沿用 `rowToCombination`，不改變 nullable bonus。
- Modify `src/lib/queries/__tests__/heroes.test.ts`：覆蓋全量 combinations、members、nullable bonus 與 query 結果可供 optimizer 使用。
- Modify `src/lib/queries/__tests__/schema-smoke.test.ts`：加入 hero/hero_connect 欄位與 row-shape smoke（只驗 schema，不宣稱完整遊戲語意）。
- Modify `src/app/heroes/page.tsx`：加入 `/heroes/team-builder` 的入口連結或 CTA。

### 2. Pure optimizer

- Create `src/lib/hero-team-optimizer.ts`，定義最小 input/output types，輸入 `HeroSummary[]`、全量 `HeroCombination[]`、`mainHeroId`、`slots`、target 與可使用英雄 IDs。
- 先建立 candidate pool：全體英雄排除主英雄，並確認包含所有 combinations 的 members；不得用主英雄局部 adjacency 縮小到會漏解的 pool。
- 用 DFS／combinations 枚舉恰好 `slots` 個 companions；隊伍集合為 `{mainHeroId, ...companions}`。
- 對每隊掃描全部 `hero_connect`，以 member IDs subset 判定 triggered links，累加八項 bonus（`null ?? 0`）。
- 過濾 triggered links 數為 0 的結果，計算八項總和與 targetScore，排序後 `.slice(0, 10)`。
- 同分 comparator 使用 companion IDs 已排序後的 lexicographic tuple；不可依輸入順序產生不穩定結果。

### 3. Page and client UI

- Create `src/app/heroes/team-builder/page.tsx`：server 端載入 heroes／combinations，設定 metadata，傳 serializable data 給 client component。
- Create `src/components/heroes/hero-team-builder.tsx`：`"use client"`，管理主英雄、slots、target 與可使用英雄 state；重算使用 pure optimizer，不使用 API 或 effect-based data fetch。
- Reuse `Combobox` from `src/components/ui/combobox.tsx`，參考 `src/components/compare/item-picker.tsx` 的搜尋與鍵盤選取 pattern。
- UI 只呈現「連結加成總和」與已觸發 link details；假設、unknown、無結果狀態要靠近結果區域。
- 若需要導覽列新增項目，僅修改 `src/components/layout/navbar.tsx` 的既有英雄導覽，不新增獨立 navigation system。

### 4. Tests

- Create `src/lib/__tests__/hero-team-optimizer.test.ts`：使用小型 fixture 驗證：
  - 主英雄固定且 companions 數量恰好為 1–4；
  - 全員在隊伍才觸發；
  - companions-only link 會計入；
  - null bonus 等同算術 0，但輸入資料仍為 null；
  - 零 triggered links 不列出；
  - target desc、companion IDs lexicographic tie-break、Top 10；
  - candidate pool 不漏掉最佳解。
- 同一測試檔加入 small brute-force oracle：對縮減 fixture 以直接全組合掃描產生 oracle，與 optimizer 結果（隊伍、triggered links、八項 totals、排序）對照。
- Optionally modify `src/data/guides.ts` 與其 guide test：若 team builder 需要在既有 guides hub 顯示入口，才加入最小 guide metadata；不為了預留而新增。
- Create corresponding component test for `hero-team-builder.tsx`：主英雄搜尋、slots、target、結果卡、假設文案、empty state 與基本 keyboard/a11y semantics。

## Optimizer 規則（可直接實作的 contract）

```ts
type HeroBonusKey = "hp" | "mp" | "atk" | "matk" | "def" | "mdef" | "dodge" | "hit";
type HeroTarget = HeroBonusKey;

interface OptimizeInput {
  heroes: HeroSummary[];
  combinations: HeroCombination[];
  mainHeroId: number;
  slots: 1 | 2 | 3 | 4;
  target: HeroTarget;
  availableHeroIds?: number[];
}
```

輸出至少包含 `mainHeroId`、sorted `companionIds`、triggered combinations（並可依是否含主英雄分組）、八項 totals 與 `targetScore`。省略 `availableHeroIds` 代表全部可用；提供時只能從該集合挑 companions，主英雄不因漏勾而被排除。若主英雄不存在、slots 不在 1–4、或 candidate pool 無法產生完整隊伍，回傳空結果而不是猜測。hero IDs 以 number 比較；lexicographic tie-break 指數列逐項比較，不是把 ID 串成字串。

## 驗收條件

- 可由 `/heroes` 進入 team builder；主英雄可搜尋與鍵盤選取。
- 可切換全部 84 位皆可用或只用勾選英雄；受限模式的答案不得包含未勾選 companions。
- slots 僅能為 1–4，隊伍最多 5 人；結果符合恰好 slots companions。
- 每個結果的所有 triggered links 都滿足全員在隊伍；companions-only link 不會遺漏。
- 結果只包含至少一組 triggered link，最多 10 筆，排序符合 contract。
- 八項總和只來自已觸發 `hero_connect` bonus，null 視為 0；畫面只稱「連結加成總和」。
- 假設與限制在結果區可見；不呈現等級、靈氣、英雄自身 stats 或未解碼能力。
- 已觸發連結依「含主英雄」／「相惜英雄彼此」分組；缺少英雄建議不得混入當前 Top 10。
- 可用人數不足與無完整連結使用不同 empty state。
- desktop/mobile、keyboard、focus、combobox label、empty/no-result state 通過 component test 與 mockup gate；不把未做 browser/mobile manual smoke 寫成已驗證。
- SQLite 檔案內容與 schema unchanged；沒有 API、Web Worker 或新 dependency。

## 風險與處理

| 風險                                               | 處理                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `hero_connect` 真實引擎的疊加或觸發規則未完全記錄  | 明示「全員在隊伍」與「bonus 直接相加」是第一版假設；不稱官方最佳解                          |
| candidate pool 縮減造成漏掉 companions-only 最佳解 | pool 至少涵蓋全量 hero；用 brute-force oracle fixture 驗證                                  |
| nullable bonus 被誤解為資料庫 0                    | query 保留 null；optimizer 僅在 arithmetic layer 以 0 計算，UI 顯示假設                     |
| 75 組 combinations 全量枚舉成本上升                | 84 heroes、slots ≤ 4 的第一版使用同步 pure optimizer；先測試實際耗時，沒有證據不引入 Worker |
| hero 名稱或 ref 缺失                               | 沿用 query fallback `英雄 #id`；不丟棄資料 row                                              |
| accessibility／mobile 退化                         | 先以 Open Design approval gate 固定資訊階層，再以 component test 與明確驗收條件檢查         |

## 實作順序

1. 以本文件與 settled contract 產出 Open Design desktop/mobile mockup。（完成）
2. 等待使用者明確 OK；未 OK 前停止，不修改 implementation files。（2026-08-13 完成）
3. 新增／修改 hero query、types contract test、schema smoke test。
4. 新增 optimizer 與 brute-force oracle tests，先讓 pure logic 通過。
5. 新增 server page、client builder 與 component test。
6. 加入 `/heroes` CTA（必要時才更新 guide metadata/nav）。
7. 執行驗證 commands，依驗收條件檢查 diff；不修改 DB。

## 驗證 commands

```bash
npm test -- src/lib/__tests__/hero-team-optimizer.test.ts src/lib/queries/__tests__/heroes.test.ts
npm test -- src/lib/queries/__tests__/schema-smoke.test.ts
npm test -- src/components/heroes/__tests__/hero-team-builder.test.tsx
npm run typecheck
npm run build
git diff --check -- docs/plans/hero-team-builder.md
git diff --stat -- docs/plans/hero-team-builder.md
```

若 repository 的 test runner 不接受上述 path filter，改用既有 package script 的等價 targeted syntax；不得因此宣稱未執行的驗證已通過。Validation owner：orchestrator。
