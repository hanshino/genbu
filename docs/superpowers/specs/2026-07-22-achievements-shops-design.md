# 設計:成就圖鑑 + NPC 商店呈現

- **日期**:2026-07-22
- **狀態**:設計定案,待實作
- **相關**:`tthol.sqlite` 2026-07-22 新增六張表(migration `20260722120000_create_achievement_tables.js`、`20260722130000_create_shop_tables.js`,建置管線在 `../tthol_data`)

## 1. 目標與背景

`tthol.sqlite` 這次更新新增了兩批玩法資料,網站尚未呈現:

- **成就系統**:`achievements`(1,266 筆,全部 enabled)+ `achievement_categories`(9 大分類)+ `achievement_sub_cats`(30 子分類)。來源 `ACHIEVEMENT.INI`。
- **NPC 商店**:`shops`(89 家)+ `shop_sells`(販售 1,858 筆、覆蓋 710 種道具)+ `shop_buys`(收購 91 筆)。來源 `SHOP.INI`。

同批但**不在本輪範圍**:`map_dims` / `map_objects` / `map_placements`(6/8 匯入的地圖布點)、`hero` / `hero_connect`(2024 舊表)——留待之後。

### 定案決策(brainstorming 產物)

| 決策點 | 結論 |
|---|---|
| 本輪範圍 | **成就系統 + NPC 商店**(方案 A);地圖布點、英雄資料不做 |
| 成就深度 | 描述 + 點數 + **解碼獎勵**;達成條件參數(source_type/param)**不解碼**,靠現成中文描述 |
| 成就詳細頁 | **不做**——單筆資訊量撐不起一頁,全部在列表內呈現 |
| 商店↔NPC 關聯 | 資料不存在,**先用「商店 #N」呈現**,未來有資料再升級 |
| 商店最高價值面 | 道具詳細頁的「商店販售/收購」區塊(710 種道具受惠) |
| changelog | 六張新表全部註冊進 `PROFILES` |

## 2. 資料考掘的關鍵發現(實作必讀)

### 2.1 成就獎勵解碼(已實證)

`reward_type` / `reward_id` / `reward_amount` 的語意,已用真實資料 join 驗證:

| reward_type | 筆數 | 意義 | 解碼方式 |
|---|---|---|---|
| 0 | 852 | 無獎勵 | reward_id 恆為 0,不顯示獎勵欄 |
| 1 | 226 | 貨幣 ×N | reward_id ∈ {1, 2, 3, 7} 四種貨幣;**名稱待使用者提供**,先顯示「貨幣 #N」 |
| 2 | 3 | 道具 ×N | reward_id join `items.id`(已驗證:百萬官幣 ×50、童玩紀念幣 ×5),連 `/items/[id]` |
| 3 | 47 | 銀兩 ×N | reward_id 恆為 1,amount 即金額(50 萬~5,000 萬) |
| 5 | 138 | 永久屬性加成 | reward_id join `magic.id`(已驗證:1183=物攻增加、1184=內勁增加…),連 `/skills/[id]` |

其他欄位的處理:

- `description` 已是玩家可讀中文(例:「完成任意成就10個」),直接顯示,**不解碼** `source_type` / `param0-4`。
- `prereq_achievement_id` 只有 8 筆非零 → inline 顯示「前置:成就名」,不做連結錨點。
- `reset_type` > 0 表示週期重置(每日課題類)→ 顯示 Badge。
- `enabled` 全為 1、`data_type` 與 `notify_type` 為客戶端行為欄 → 一律忽略。
- `group_no` 同組 = 階梯式成就系列(如 10/50/100/200/500 個)→ 第一版依序連續排列即可,不折疊。

### 2.2 商店資料的形狀與缺口

- **商店沒有名稱、沒有 NPC/地圖關聯**。`SHOP.INI` 只有兩行區段註解:`// 武器店`(ID 9, 1, 2, 6, 3, 4, 5, 11, 41, 43, 48, 50 共 12 家)與 `// 道具店`(其餘 77 家)。此分類寫死在 constants,是唯一可用的商店語意標籤。
- `castle_id` 只有 19 家有值(1~4,各 5/5/7/2 家),應為城池商店;70 家為 NULL(一般商店)。城池名稱待補,先顯示「城池 #N」Badge。
- `shop_buys.rate` 值域 {20, 21, 22, 23, 30, 100},推定為「收購價 = 道具售價(`items.value`)× rate%」——**實作時需抽樣驗證**,頁面以「收購率 N%」呈現並加註語意。
- `shops.style0-3` 為客戶端 UI 樣式欄,忽略。

### 2.3 規模結論(免分頁的依據)

最大的大分類「征戰」共 349 筆成就、最大子分類「降魔誅妖」257 筆;商店最多一家賣 55 種。**兩個主題頁都不需要分頁**,只有成就搜尋需要 cap(100 筆 + 提示縮小關鍵字)。

## 3. 架構總覽

```
tthol.sqlite ──(better-sqlite3, readonly, Server Components only)
   │
   ├─ src/lib/queries/achievements.ts ─→ /achievements 成就圖鑑(單頁)
   │        └ join items / magic 解碼獎勵
   ├─ src/lib/queries/shops.ts ────────→ /shops 商店列表
   │                                  ─→ /shops/[id] 商店詳細
   │                                  ─→ items/[id] 的 ShopAvailabilitySection
   └─ src/lib/changelog/config.ts ────→ PROFILES 註冊六張新表
```

## 4. 資料層

### 4.1 types

- `src/lib/types/achievement.ts`:`AchievementCategory`(含子分類與筆數)、`AchievementRow`(列表列,含解碼獎勵欄位 `rewardKind` / `rewardLabel` / `rewardHref?`)。
- `src/lib/types/shop.ts`:`ShopSummary`(列表列)、`ShopDetail`、`ShopSellEntry` / `ShopBuyEntry`、道具頁用的 `ItemShopAvailability`。

### 4.2 queries(每個 module 配 `__tests__`,沿用現有查詢測試模式)

`src/lib/queries/achievements.ts`:

- `getAchievementCategories()`:大分類 + 各自子分類 + 每子分類筆數與點數加總(一次查回,供 Tabs 與分節標題)。
- `getAchievementsByCategory(categoryId)`:該大分類全部成就,按 `sub_cat_id, group_no, id` 排序;獎勵欄位在 SQL 內 LEFT JOIN `items`(reward_type=2)與 `magic`(reward_type=5;`magic` 同 id 每等級一列、名稱一致,須以子查詢取單列避免重複)取名稱;前置成就名稱 self-join。
- `searchAchievements(keyword)`:名稱 + 描述 LIKE,跨全分類,回傳附大/子分類名稱,`LIMIT 100`。

`src/lib/queries/shops.ts`:

- `getShops()`:89 家 + 每家販售/收購種數(GROUP BY 彙總)。
- `getShopDetail(id)`:shop 本體 + sells(join `items` 取名稱、type)+ buys(join `items`)。
- `getShopsSellingItem(itemId)`:賣此道具的商店(id、類型、castle、價格)。
- `getShopsBuyingItem(itemId)`:收購此道具的商店與 rate。

### 4.3 constants

- `src/lib/constants/achievement.ts`:`REWARD_CURRENCY_NAMES: Record<number, string>`(id 1/2/3/7,先填「貨幣 #N」佔位,**待使用者提供正名**);reward_type 顯示邏輯的標籤。
- `src/lib/constants/shop.ts`:`WEAPON_SHOP_IDS`(上述 12 個 ID)、`CASTLE_NAMES: Record<number, string>`(1~4,佔位「城池 #N」)、商店類型標籤。

## 5. 頁面設計

### 5.1 `/achievements` 成就圖鑑(單頁,無詳細頁)

- URL state:`?cat=<大分類id>&search=<關鍵字>`,預設 `cat=1`(功名錄)。
- 版面:
  - 頂部大分類導覽(9 個):以**連結式分類頁籤**呈現(`Link` + `aria-current`,視覺對齊現有地圖頁的 chip 樣式)。不用 `Tabs` 元件——它是 client 端狀態切換,而分類是 URL param 驅動的 server 渲染,連結語意才正確。
  - Tab 內容按**子分類分節**:節標題 = 子分類名 + 筆數 + 該節成就點數加總。
  - 成就列(hand-roll 列表列,對齊現有 `LinkListSection` 視覺):成就名(粗體)、點數 Badge、描述(muted)、獎勵行(解碼結果:道具/技能為連結,銀兩/貨幣為文字)、`reset_type>0` 顯示「週期重置」Badge、前置成就 inline 文字。
- 搜尋:輸入關鍵字時**忽略 cat**,跨全分類搜名稱+描述,結果列額外顯示「大分類 · 子分類」;上限 100 筆,滿了顯示「結果過多,請縮小關鍵字」。搜尋框沿用現有 filter 元件模式(client component 推 URL param,debounce)。
- 頁尾註記資料來源 `ACHIEVEMENT.INI` 與「貨幣名稱暫以編號顯示」的說明。

### 5.2 `/shops` 商店列表 + `/shops/[id]` 商店詳細

- `/shops`:兩節 — 「武器店」(12 家)、「道具店」(77 家)。每列:「商店 #ID」、城池 Badge(有 castle_id 時)、販售 N 種、收購 M 種。列連到詳細頁。
- `/shops/[id]`:
  - 標題「商店 #N」+ 類型 Badge + 城池 Badge。
  - 「販售」`Table`:道具名(連 `/items/[id]`)、類型、單價;按價格排序。
  - 「收購」`Table`(有資料才顯示):道具名、收購率 %。
  - 頁尾註記:資料來源 `SHOP.INI`;商店暫無名稱與 NPC 對應;收購率語意說明。
- 無效 id → `notFound()`,同現有詳細頁模式。

### 5.3 道具頁 `ShopAvailabilitySection`

- 新增 `src/components/items/shop-availability-section.tsx`,插在 `ItemDropList`(掉落來源)之後——「哪裡買」與「哪裡打」相鄰。
- 內容:「商店販售」列出商店(連 `/shops/[id]`)+ 價格;若被收購,附收購率一行。
- 販售與收購皆無資料 → 整段隱藏(回傳 null),同現有 section 慣例。

### 5.4 入口與 changelog

- `navbar.tsx` 的「資料庫」群組尾端加 `{ href: "/achievements", label: "成就" }`、`{ href: "/shops", label: "商店" }`。
- 首頁 `features` 加兩張卡:成就圖鑑(「1,200+ 成就分類瀏覽,點數與獎勵一覽」)、商店查詢(「NPC 商店販售與收購,道具頁直查哪裡買」)。首頁 stats 三格不動。
- `src/lib/changelog/config.ts` `PROFILES` 註冊:
  - `achievements`:rich,identity `["id"]`,fields:`name` 名稱、`description` 描述、`points` 點數、`reward_amount` 獎勵數量,detailRoute → `/achievements`。
  - `shop_sells`:rich,identity `["shop_id", "item_id"]`,fields:`price` 價格,detailRoute → `/shops/${idParts[0]}`。
  - `shops`、`shop_buys`、`achievement_categories`、`achievement_sub_cats`:count 層。

## 6. 錯誤處理與邊界

- 獎勵 join 不到名稱(道具/技能 id 失效)→ fallback 顯示「#id」,不擲錯。
- `reward_type` 出現未知值 → 顯示「獎勵 #type(#id ×amount)」,保底不炸頁。
- `/achievements?cat=` 不存在的分類 id → fallback 到預設分類。
- 商店 `castle_id` NULL → 不顯示城池 Badge。
- 全部查詢唯讀;禁止修改 `tthol.sqlite`(專案既有鐵律)。

## 7. 測試

- `src/lib/queries/__tests__/achievements.test.ts`:分類樹形狀、依分類查詢的排序與筆數、獎勵解碼五種 type 各一例(含 fallback)、搜尋 cap。
- `src/lib/queries/__tests__/shops.test.ts`:列表彙總數、詳細頁 join、`getShopsSellingItem` 以已知道具(如 20001 青銅刀)驗證、無資料道具回空陣列。
- changelog config 既有測試若鎖表清單,更新對應 fixture。

## 8. 已知限制與後續(不在本輪)

- 商店名稱 / NPC / 地圖關聯:待 `tthol_data` 解出資料後升級商店頁標題與位置資訊。
- 貨幣(reward_type=1)與城池名稱:constants 佔位,待使用者提供後一行補上。
- 成就達成條件參數(source_type/param)解碼、成就與怪物/道具的反向連結:未來若要做「哪些成就跟這隻怪有關」再議。
- 地圖布點(`map_placements`)呈現、`hero`/`hero_connect`:另開一輪。
