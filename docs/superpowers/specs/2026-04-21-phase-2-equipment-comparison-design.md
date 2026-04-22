# Phase 2 — 裝備比較 / 加權排行設計

- 日期：2026-04-21
- 範圍：座騎、背飾兩個裝備類型（模組設計可擴展至其他類型）
- 前置：Phase 1 已上線（物品查詢、詳情、隨機素質）

---

## 1. 目標與反思

### 1.1 功能範圍（高階）

1. **加權排行榜（`/ranking`）** — 指定裝備類型與權重公式，列出排行
2. **N 件比較（`/compare`）** — 選擇 2~5 件同類裝備，矩陣式比較
3. **物品詳情頁增強** — 座騎/背飾 加入比較按鈕、屬性 bar chart、預留標籤槽位

### 1.2 對 LINE bot 既有做法的改良

LINE bot 的 Top 30 加權排行是穩定的基礎，但有 4 個可在網頁版改進的盲點：

| LINE bot 盲點        | 網頁版改良                                            |
| -------------------- | ----------------------------------------------------- |
| 單一分數壓平多維屬性 | 排行表多欄顯示 7 流派分數，可任欄排序                 |
| 僅 pairwise 比較     | N 件比較矩陣                                          |
| 純數字缺乏直觀       | 屬性 bar chart                                        |
| 線性加權表達力有限   | 加「硬性門檻」過濾（HIT ≥ X, DEF ≥ Y 等）再套加權分數 |

### 1.3 預留但不實作

**裝備標籤分類（`classifier`）** 放到 Phase 2.5。Phase 2 只：

- 建立 `src/lib/classifier/` 模組骨架（`types.ts` + `classify()` 回空陣列）
- UI 預留 `<ItemTags />` 槽位（渲染 null）
- 排行頁 filter 面板預留「標籤過濾」區塊（隱藏）

---

## 2. 資料流與計算策略

### 2.1 原則

- **資料取得**：Server Component 從 SQLite 取資料；切換 type 透過 URL 參數變動（`router.replace('/ranking?type=背飾')`）觸發伺服端重新 render 並以 streaming 送下新資料
- **運算**：在 Client 端進行（權重調整即時反應、不 round-trip）
- **狀態管理**：URL query string 為 single source of truth；localStorage 僅存「我的配方」與比較盤

### 2.2 資料量與取捨

實測（Phase 1 DB）：

- 座騎：407 列；背飾：366 列
- item_rand（兩類合計）：148 列

取資料策略：

- `/ranking` 頁：按當前 tab（座騎 或 背飾）一次撈該 type 全部 items + item_rand
- Server 端 **trim 欄位**（排除 `picture / icon / summary / note / durability / value`），只保留分數計算 + 顯示欄位，預估壓縮後 ~15-25 KB
- 切換 type tab 時重新 fetch（或 React `cache()` / `swr` 快取）
- `/compare` 頁：依 URL `ids` 參數撈指定 item，per-request

---

## 3. 計算公式

### 3.1 固定屬性加權分數

```
base(item, weights) = Σ weights[key] × item[key]
```

### 3.2 隨機素質期望值

對單一 item：

```
totalRate = Σ row.rate                 // 該 item 全部 rand rows 的 rate 總和
E_random[attrKey X] = Σ ((row.min + row.max) / 2) × (row.rate / totalRate)
                        (只加總 row.attribute == X 的 rows)
```

`row.attribute` 為中文標籤，需透過反查表對回 DB 欄位 key（見 §3.4）。

**範例**：item 22074 的 `外功` 兩列 `(min=3,max=5,rate=970000) + (min=6,max=6,rate=30000)`
→ E_random[str] = 4 × 0.97 + 6 × 0.03 = 4.06

### 3.3 總分

```
score(item, rands, weights) = Σ weights[key] × (item[key] + E_random[key])
```

### 3.4 屬性標籤反查

`item_rand.attribute` 實際使用的 13 個中文標籤：
`內力 / 內勁 / 外功 / 技巧 / 根骨 / 物攻 / 玄學 / 真氣 / 護勁 / 身法 / 重擊 / 防禦 / 體力`

全部可透過反查現有 `itemAttributeNames`（`src/lib/constants/i18n.ts`）對應到 DB 欄位 key。未知標籤 → 回 `null`，計算端忽略。

### 3.5 比較頁的 7 流派差異

對每個預設流派 `P`：`Δ(P) = score(A, P) − score(B, P)`。以 B→A 視角，Δ > 0 代表推薦將 B 換成 A（顯示 ✔️）。N 件比較則對每個流派列出每件的絕對分數，最高值染色。

### 3.6 邊界規則

- 無 `item_rand` rows 的 item → `E_random = 0`
- `totalRate == 0` → 視為 0，不除零
- 權重全 0 或空 → UI 顯示提示、不排序
- `score === 0` 的 item 在排行頁過濾掉

---

## 4. 預設流派（移植自 LINE bot）

從 `tthol-line-bot/src/configs/weighted.config.js` 搬到 `src/lib/scoring/presets.ts`：

| 流派     | 主要權重                                               |
| -------- | ------------------------------------------------------ |
| 純玄系列 | wis:7, dex:3, hit:1, def:0.5, mdef:0.25                |
| 純外系列 | str:11, atk:1, dex:3, hit:1, def:0.5, mdef:0.5         |
| 純內系列 | pow:9, matk:1, dex:3, hit:1, def:0.5, mdef:0.5         |
| 玄內系列 | wis:7, pow:5, matk:1, dex:3, hit:1, def:0.5, mdef:0.25 |
| 玄外系列 | wis:7, str:5, atk:1, dex:3, hit:1, def:0.5, mdef:0.5   |
| 爆刀     | agi:7, str:7, critical:5, def:0.75, mdef:0.75          |
| 手甲     | dex:15, hit:5, atk:7                                   |

需撰寫單元測試逐項驗證與 LINE bot 原始設定一致。

---

## 5. UI 規格

### 5.1 `/ranking` 頁

**布局**：左側 filter 面板（sticky），右側排行表。

**Filter 面板元件**：

- Type tab：`[座騎] [背飾]`（互斥）
- 等級範圍：雙滑桿，上/下限依當前 type 的實際等級分布動態設定（座騎實測 max=140、背飾 max=185）；預設選取區間統一為 min=50 max=100 以聚焦主流裝備
- 流派 radio：7 流派 + `自訂`
- `<WeightEditor>`：屬性下拉（僅可評分屬性）+ 數值輸入 + 增刪 row。選 7 流派時顯示該流派權重，修改會切到「自訂」
- 門檻過濾：數值 input（留空=不限制），初期只露 `命中 / 防禦 / 護勁 / 閃躲`（keys: `hit / def / mdef / dodge`），未來可擴充
- 「儲存為我的配方」按鈕（localStorage）、「載入配方」下拉

**排行表欄位**：

- 排名、名稱、等級、(7 流派分數各一欄)、目前流派分數（高亮）、操作（詳情 / 加入比較）
- 每欄可點擊切換排序；目前排序欄加 arrow 指示
- 點 row 展開顯示 `<StatBarChart>` + 關鍵屬性摘要
- 預設 Top 30，可切「顯示全部」

**URL state**（single source of truth）：

```
/ranking?type=座騎
       &preset=純外              （或 custom）
       &weights=str:11,atk:1,dex:3,hit:1,def:0.5,mdef:0.5
       &minLv=60&maxLv=80
       &hitMin=50&defMin=30
       &sortBy=純外
       &showAll=0
       &highlight=<itemId>       （從 item detail 跳來時 auto-scroll）
```

**localStorage keys**：

- `genbu.ranking.customPresets`：自訂配方清單 `[{name, type, weights}]`

### 5.2 `/compare` 頁

**布局**：上方加入區，下方三個 section。

**元件**：

- `<ItemPicker>`：type-ahead 搜尋框，限制同類型（第一件決定 type，後續只能加同 type）
- 已選裝備 chip 列（可移除、清空）
- Section 1：屬性矩陣。每屬性一列，每裝備一欄，列末顯示「最高值」badge，差異染色（當前件 vs 該列最高值）
- Section 2：7 流派分數矩陣。每流派一列，最高分染藍、最低染灰
- Section 3：`<StatBarChart>` 並排（裝備 >= 3 件時改水平卷動）

**URL state**：`/compare?ids=1234,5678,9012`

**限制**：最多 5 件（超出時 UI 阻擋並提示）。

### 5.3 物品詳情頁增強

條件：`item.type ∈ {座騎, 背飾}`

新增元件：

- `<CompareButton>`：切換 localStorage 比較盤；已加入時顯示「移除」；盤滿 5 件時 disable
- 「在排行榜中查看」連結 → `/ranking?type=X&highlight=<id>`
- `<StatBarChart>`：屬性視覺化
- `<ItemTags>`：Phase 2 渲染 null，為 Phase 2.5 預留

**localStorage key**：

- `genbu.compareTray`：`number[]`（item id 陣列），最多 5 件

### 5.4 共用元件

- `<StatBarChart item maxValues>`：橫向 bar chart；maxValues 為當前 type 內每屬性最高值，作為 100% 比例尺。採手刻純 div + CSS（零依賴）；未來需要折線/散點再引入 recharts
- `<WeightEditor weights onChange>`
- `<ItemPicker type onSelect>`
- `<ItemTags item>`（佔位）

### 5.5 Navbar

追加：`排行榜 / 比較`。最終順序：`首頁 / 物品 / 排行榜 / 比較`。

---

## 6. 檔案結構

```
src/
├── app/
│   ├── ranking/
│   │   ├── page.tsx                  # Server
│   │   └── ranking-client.tsx        # Client
│   ├── compare/
│   │   ├── page.tsx                  # Server
│   │   └── compare-client.tsx        # Client
│   └── items/[id]/page.tsx           # 既有，加 CompareButton, StatBarChart
├── components/
│   ├── ranking/
│   │   ├── ranking-table.tsx
│   │   ├── weight-editor.tsx
│   │   ├── preset-selector.tsx
│   │   ├── level-range.tsx
│   │   └── threshold-filters.tsx
│   ├── compare/
│   │   ├── compare-matrix.tsx
│   │   ├── compare-presets.tsx
│   │   ├── item-picker.tsx
│   │   └── compare-bar.tsx
│   └── items/
│       ├── stat-bar-chart.tsx
│       ├── item-tags.tsx             # Phase 2 render null
│       └── compare-button.tsx
├── lib/
│   ├── scoring/                      # Phase 2 新模組
│   │   ├── types.ts
│   │   ├── presets.ts
│   │   ├── score.ts
│   │   ├── random-expected.ts
│   │   └── attribute-alias.ts
│   ├── classifier/                   # Phase 2.5 預留
│   │   ├── types.ts
│   │   └── index.ts                  # Phase 2 回 []
│   ├── queries/items.ts              # 擴充 getItemsByType, getItemsByIds, getItemRandsByIds
│   └── hooks/
│       ├── use-compare-tray.ts
│       └── use-custom-presets.ts
└── configs/
    └── weighted.ts                   # re-export from lib/scoring/presets
```

**依賴方向規則**：

- `classifier → scoring` ✓（之後可依賴）
- `scoring → classifier` ✗（絕對不可）
- `components/* → lib/*` ✓
- Server Component → `lib/queries/*`
- Client Component 只吃 props / URL，不直接讀 DB

---

## 7. 測試策略

### 7.1 單元測試

- `lib/scoring/score.ts`
  - 固定屬性加總正確
  - 空 rand → E 全 0
  - 單 attr 多列 rand → 正確加權平均（以 item 22074 為參考）
  - 未知權重 key → 忽略不 crash
  - 負權重正常計算
- `lib/scoring/random-expected.ts`
  - `totalRate == 0` 不除零
  - 多 attr 跨列分組
- `lib/scoring/attribute-alias.ts`
  - 13 個已知中文標籤全部可反查
  - 未知標籤回 null
- `lib/scoring/presets.ts`
  - 7 流派與 LINE bot `weighted.config.js` 逐項比對

### 7.2 整合測試（Route + render）

- `/ranking?type=座騎&preset=純外` SSR 成功、scored list 非空
- `/compare?ids=A,B,C` 正確撈 3 件、矩陣列數 == 屬性數

### 7.3 手動 QA

- 權重拖動 → 排行即時更新、無閃爍
- URL 直接貼連結可還原全部狀態
- localStorage 無痕模式降級（不 crash，單純不儲存）
- 比較頁單件 / 超過 5 件
- 手機寬度排行表水平卷動可讀

### 7.4 不做

UI 視覺回歸測試。

---

## 8. 非目標（Out of Scope）

以下 Phase 2 刻意不做，留待後續：

- 裝備標籤規則引擎（Phase 2.5，僅預留 API）
- 帽/衣/鞋/飾/武器 的排行與比較（模組已可擴展，但 Phase 2 不啟用）
- Pareto frontier 散點圖
- 「我目前裝備 → 推薦升級」工作流
- 權重敏感度分析（擾動 ±20% 看排名變動）
- 視覺回歸測試
- 移動端專屬 UI（僅保證可讀）

---

## 9. 風險與緩解

| 風險                                                    | 緩解                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Client 端資料量（~15-25 KB per type）在慢網路下首載偏慢 | Server 端欄位 trim，且只在切換 type 時重抓                                           |
| 權重拖動造成重排行計算卡頓（O(N) N=400）                | 純乘加運算輕量，不擔心；若出現可加 `useDeferredValue`                                |
| localStorage 在無痕模式拋錯                             | `use-*` hook 內 try/catch 降級為純 in-memory state                                   |
| URL 過長（7 流派權重全塞 custom）                       | 只在 `preset=custom` 時塞 weights；預設流派僅帶 preset 名                            |
| 未來加入新裝備類型時 preset 不適用                      | Preset 資料模型附 `applicableTypes: string[]`，Phase 2 先全部設為 `['座騎', '背飾']` |

---

## 10. 交付檢核

Phase 2 可視為完成，當：

- [ ] `/ranking` 與 `/compare` 上線並可從 navbar 進入
- [ ] 物品詳情頁「加入比較」+ bar chart 生效
- [ ] 7 流派加權測試通過
- [ ] URL state 可分享還原
- [ ] `scoring` 模組 `coverage > 80%`
- [ ] `classifier` 骨架存在、全部公開 API 回空值
- [ ] 手動 QA checklist 通過
