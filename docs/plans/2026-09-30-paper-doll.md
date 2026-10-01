# 紙娃娃換裝（試穿 / 換裝沙龍）

> 狀態：**規劃中，尚未實作**。genbu 端要等 tthol_data 產出外裝資料表才能開工。
> 建立於 2026-09-30。

---

## 這份文件要解決什麼

想讓玩家在網站上看到「角色穿上某件裝備長什麼樣子」：

1. **物品頁試穿**：在 `items/[id]` 用預設角色穿上這件裝備，並能轉方向看。
2. **換裝沙龍**（`/tools/salon`）：選性別、頭型，各部位挑道具，即時拼出整套造型，並可分享。

遊戲本身就是紙娃娃系統：角色由 頭 / 帽 / 衣 / 褲 / 坐騎 / 背飾 / 左飾 / 中飾 / 右手 / 左手 十個圖層疊成，每件裝備用道具的 `oicon` 指到一組外裝圖。這些圖和規則已在 tthol_data 端驗證過（2026-09-30），做法見下方「tthol_data 端已確認的事」。

---

## 分工：大部分工作在 tthol_data

genbu 只讀 `tthol.sqlite`，**不碰遊戲素材**。所以這個功能拆成兩條線：

| 線 | 做什麼 | 狀態 |
|---|---|---|
| **tthol_data** | 解外裝素材、把「道具 → 外裝圖」與「拼裝規則」做成資料表、把每張圖上傳 PictShare | 資料表已完成；圖片上傳待執行（10,520 張） |
| **genbu** | 讀那些表、疊圖元件、物品頁試穿、換裝沙龍頁 | 等 tthol_data |

genbu 端**不寫死任何偏移量或圖層順序**，全部從 DB 讀。規則只在 tthol_data 的 config 維護一份，之後改規則只要重建 DB、不用改前端。

---

## tthol_data 端已確認的事（背景，genbu 不用重做）

- 外裝圖在遊戲封包 data6 / data7 的 `shape/doll3/`（185,467 個檔）。RPGViewer 解不出來（會卡在 ZIP 的 65,535 檔上限），tthol_data 用自己的解包程式處理。
- 道具 → 外裝：`items.oicon` 對到 `DOLL_{M,F}_{部位}.OBD` 的 `Sequence = 性別基數 + 部位 × 1000 + oicon`（男 100000 / 女 300000；帽 1、衣 2、褲 / 坐騎 3、背飾 4、左飾 5、中飾 6）。武器是右手 100000 / 左手 150000 + 武器群組 × 1000 + oicon，群組看目錄檔的武器名稱。
- 目前的覆蓋率：`item_doll` 9,682 列中 9,420 列有目錄條目；有圖的部位 3,357 個（16,785 張）。約 210 個部位客戶端本來就沒有圖。
- 素材只有 5 個方向（1、2、3、7、8），另外 3 個推測是左右鏡像，尚未驗證。
- 拼裝規則（目測對齊，尚未跟遊戲截圖逐像素比對）：
  - 各圖層用自己的錨點對齊到同一原點。
  - 褲子往下 32 px；頭、帽子、背飾往上 16 px（共用脖子掛點）。
  - 圖層順序依方向：面向鏡頭時背飾最底；背對（方向 2、3）時背飾畫在身體上面。

---

## genbu 會拿到的資料（tthol_data 已實作，2026-09-30）

| 表 | 用途 | 主要欄位 |
|---|---|---|
| `doll_slots` | 10 個部位的中文名稱、排序、互斥規則 | `slot, label, catalog, sort_order, replaces` |
| `item_doll` | 道具 → 外裝部位（只列 `items.sex` 允許的性別）；**一件可能有多列** | `item_id, gender, slot, sequence, role, equip_slot, has_part` |
| `doll_parts` | 目錄檔的每個條目；**頭型就是 `slot = 'head'` 的列**（男 11 / 女 10） | `gender, slot, sequence, name, directory, wait_action, wait_frame, sprites` |
| `doll_frame_images` | 每張外裝圖 | `gender, slot, sequence, action, dir, url, width, height, anchor_x, anchor_y` |
| `doll_slot_rules` | 拼裝規則（8 個方向 × 10 個部位） | `slot, dir, mirror_of, z_order, offset_x, offset_y` |

- `slot`：`head` 頭型、`cap` 帽子、`body` 衣服、`foot` 褲子、`horse` 坐騎、`wing` 背飾、`ornament1` 左飾、`ornament2` 中飾、`right` 右手、`left` 左手。`gender` ∈ `m / f`。
- **`doll_slots.replaces`**：坐騎的圖包含騎乘者的下半身，所以有坐騎時不畫褲子（`horse.replaces = 'foot'`）。
- **`item_doll.role`**（武器才會有多列）：
  - `main`：這件道具主要畫的那一層。
  - `pair`：跟 main 一起畫。雙手武器（拳套、拳刃、爪、拂塵）兩手都有圖。
  - `offhand`：單手武器（劍、刀、刺）拿在左手時改用這一列。沙龍頁要讓使用者選「左手 / 右手」。
- **外裝**：`equip_slot` 是 `EXTRA_*` 的道具是外裝欄，跟一般裝備畫在同一個部位；兩個都穿時應該由外裝蓋過去。
- 戒指（ORNAMENT_3）沒有外觀，不會出現在 `item_doll`。
- `dir` 只有 1、2、3、7、8 有圖（7 = 正面、3 = 背面）；`doll_slot_rules` 的 4、5、6 帶 `mirror_of`，要拿 `mirror_of` 那個方向的圖左右翻轉來畫。
- 查一件道具能不能試穿：`item_doll` 有列、`has_part = 1`，而且 `doll_frame_images` 有那個 `(gender, slot, sequence)` 的圖。約 4% 的部位客戶端本來就沒有圖，要顯示「此裝備無外觀資料」。
- 第一版只有站立動作（`action = 'wait'`），走路 / 攻擊之後再加。
- 規則的來源與改版流程：tthol_data 的 `configs/doll.config.js`、`scripts/paper_doll_investigation.md`。

---

## genbu 端要做的事

### 1. 查詢層

- 新增 `src/lib/queries/doll.ts`：
  - `getItemDoll(itemId)`：這件道具穿在哪個部位、男女各一組 `sequence`。
  - `getDollFrames(parts, dir)`：一次取出一套造型所有圖層的圖與錨點。
  - `getDollRules()`：拼裝規則，資料量小，可整份讀進記憶體。
- `src/lib/queries/__tests__/schema-smoke.test.ts` 加上新表，確保 schema 跟得上。
- 測試照慣例用真實 DB 與寫死的真實 id，例如 55376 鬼道陰陽衣、22082 熊貓背袱。

### 2. `<DollPreview>` 疊圖元件（client component）

- 每一層是一個絕對定位的 `<img>`：`left = 原點x − anchor_x + offset_x`、`top = 原點y − anchor_y + offset_y`，`z-index` 取自 `doll_slot_rules.z_order`。
- 鏡像方向用 CSS `transform: scaleX(-1)`，錨點 x 也要跟著換成 `width − anchor_x`。
- 加上 `image-rendering: pixelated`，放大時才不會糊。
- 定位方式參考 `src/components/maps/stage-map-viewer.tsx`，它也是在底圖上用 % / px 絕對定位標記。**不用 canvas**：純 DOM 就夠了，也符合 shadcn 優先、少手刻的慣例。
- 方向切換用現有 shadcn 元件（例如 ToggleGroup 或兩顆旋轉按鈕），不用 Unicode 箭頭。
- 缺圖時（道具沒有外裝圖）跳過那一層並顯示「此裝備無外觀資料」，不要整個壞掉。

### 3. 物品頁試穿

- `src/app/items/[id]/page.tsx` 已經在選封面（89–90 行），傳給 `src/components/items/item-detail.tsx`（24–38 行）的右側封面欄。
- 有外觀的裝備（`item_doll` 有 `has_part = 1` 的列）加一個「試穿」區塊：預設角色（預設頭型、無其他裝備）只穿上這件，可切男女、轉方向。
- 伺服器端先查好 `item_doll` 與圖層，client 只負責疊圖和轉方向。

### 4. 換裝沙龍 `/tools/salon`

- 導覽列加入口：`src/components/layout/navbar.tsx` 25–59 行的 tools 區塊。
- 左邊：性別、頭型、各部位的道具選擇器（沿用 `src/components/compare/item-picker.tsx`，依部位篩選）。右邊：大張的 `<DollPreview>` 與方向切換。
- **狀態放 URL**（例如 `?g=m&head=100001&body=55376&cap=55427`），方便分享，做法比照 `/compare`。常用造型可再用 `genbu.salon*` 前綴的 localStorage 存，寫法參考 `src/lib/hooks/use-compare-tray.ts`。

### 5. 跟現有圖片來源的關係

坐騎和背飾的圖目前是從 Google Sheet 同步的（`scripts/sync-equipment-images.mjs` → `src/lib/equipment-images.ts`）。外裝圖上線後，物品頁的封面可以考慮在沒有 Sheet 圖時改用外裝圖，但**這不在第一版範圍**，第一版只新增試穿區塊。

---

## 上線流程

照現有的 DB 發佈流程：

1. tthol_data 跑 `yarn rebuild`，產出含新表的 `tthol.sqlite`。
2. genbu：`npm run changelog -- <版本>` → `npm run db:publish` → commit `db.lock.json` 與 changelog JSON。
3. 到主機手動換 DB。
4. genbu 程式碼（查詢 + 元件 + 頁面）跟著一起上。

---

## 建議順序

1. **tthol_data**：素材進流程 → 外裝 parser → 圖片上傳 → 規則 config（下一步就做這個）。
2. **驗證**：拿遊戲截圖（同一套裝備的正面、背面）把偏移和圖層順序定準。
3. **genbu 第一版**：查詢層 + `<DollPreview>` + 物品頁試穿。範圍小，可以驗證整條資料流。
4. **genbu 第二版**：`/tools/salon` 換裝頁。
5. 之後：走路 / 攻擊動畫、武器強化發光、染髮。

---

## 還沒決定 / 待確認

- **空欄位的預設外觀**：只穿上衣、不穿褲子時腿會不見。遊戲的預設外觀規則還沒找到，第一版可以固定給一套預設衣褲（例如 青錦布甲 + 藍布鞋）。

- 方向 4、5、6 是否就是 2、1、8 的鏡像。
- 背對時武器該不該被身體蓋住。
- 頭型清單要不要對應遊戲裡的選角選項（`char.ini` 的 `Hairdo`），還是直接列出全部 11 種男 / 10 種女頭型。
