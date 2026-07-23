# 道具圖示與怪物/NPC 立繪呈現 — 設計規格

- 日期：2026-07-23
- 狀態：已核准，準備進入實作計畫
- 範圍：把新加入資料庫的 `item_images` / `npc_images` 呈現到全站

## 1. 背景與資料現況

`tthol.sqlite` 新增了兩張圖片表，圖片皆為外部 URL（使用者自有 CDN `https://img.hanshino.dev/*.png`），表內含 `width`/`height`。

### `item_images`
```sql
CREATE TABLE `item_images` (
  `item_id` integer not null,
  `kind` varchar(255) not null,      -- 'icon' | 'gicon'
  `shape_key` integer,
  `url` varchar(255) not null,
  `width` integer,
  `height` integer,
  primary key (`item_id`, `kind`)
);
CREATE INDEX `item_images_item_id_index` on `item_images` (`item_id`);
```
- 26,122 筆，涵蓋 **13,325 / 13,342** 個道具（≈99.9%）。
- `kind='icon'`：背包圖示（玩家熟悉的小圖，約 35×27）→ **本專案只用這個**。
- `kind='gicon'`：掉落在地上的外觀 → 本次不呈現（YAGNI）。
- 約 17 個道具無圖，需佔位處理。

### `npc_images`
```sql
CREATE TABLE `npc_images` (
  `npc_id` integer not null,
  `shape_key` integer,
  `url` varchar(255) not null,
  `width` integer,
  `height` integer,
  primary key (`npc_id`)
);
```
- 4,990 筆立繪（較大，74–187px）。
- `npc` 與 `monsters` 共用同一組 id：`monsters` 2,829 隻中 **2,758 隻**（≈97%）在 `npc_images` 有對應圖。
- 故此表同時服務 **NPC 場景**（商店店主、任務對話）與 **怪物立繪**。

### 既有圖片系統（與新資料互補，不衝突）
- `src/lib/generated/equipment-images.json`：412 筆手工整理的 imgur 大圖（`.jpg`，真實照片）。
- `src/lib/equipment-images.ts` → `imageOfItem(item)` 回傳 `{src, sourceUrl}`。
- `src/components/items/item-cover.tsx`（`ItemCover`）：道具詳情頁的主視覺大圖，用 `Dialog` 可點開放大，刻意使用原生 `<img>`（不走 next/image，避免 hotlink 被限流）。
- 道具**列表**與怪物/商店/任務頁目前**皆無圖**。

## 2. 產品決策（已與使用者確認）

1. **範圍**：全站鋪滿（分階段，但目標全覆蓋）。
2. **道具圖**：只用 `icon` 背包圖，不呈現 `gicon`。
3. **列表 / 詳情分工**：
   - 列表：官方小圖示縮圖。
   - 詳情大圖：**有 imgur 大圖（412 個）者優先顯示大圖**（維持現狀，可放大）；其餘只有官方小圖者，用 `image-rendering: pixelated` 放大 ~4 倍呈現復古像素風，一樣可點開放大。
4. **怪物/NPC**：使用 `npc_images` 立繪。

## 3. 架構

### 3.1 資料存取 — 集中批次解析器（選定方案 B）

新增 `src/lib/queries/images.ts`，避免動到既有大量查詢函式與 SQL：

```ts
export interface EntityImage {
  url: string;
  width: number | null;
  height: number | null;
}

// 一次查一批道具的 icon（kind='icon'）
export function getItemIconMap(ids: number[]): Map<number, EntityImage>;
export function getItemIcon(id: number): EntityImage | null;

// 一次查一批 npc/monster 立繪
export function getNpcImageMap(ids: number[]): Map<number, EntityImage>;
export function getNpcImage(id: number): EntityImage | null;
```

- 以 `WHERE item_id IN (?, ?, ...) AND kind = 'icon'` 單發查詢，無 N+1。
- `better-sqlite3` 為 in-process 同步查詢，每頁多一支 `IN` 查詢成本可忽略。
- 空陣列時直接回傳空 Map，不打 DB。
- 為避免超長 `IN` 清單，內部以固定批次大小（如 900）切分後合併（SQLite 變數上限保護）。

**頁面使用模式**：Server Component 先取列表 rows，再呼叫解析器補圖。提供小工具集中「補圖」動作，讓表格元件只讀 `row.icon`：

```ts
// 於頁面（Server Component）內：
const items = getItems(...).items;
const iconMap = getItemIconMap(items.map((i) => i.id));
// 傳 iconMap 給表格，或就地 enrich 成 items.map(i => ({...i, icon: iconMap.get(i.id) ?? null}))
```

未來若 profiling 顯示需要，再局部改成查詢層 JOIN；此為單向可演進決策，不影響元件介面。

### 3.2 共用元件

**`src/components/common/item-icon.tsx` — `<ItemIcon>`**
- Props：`image: EntityImage | null`、`alt: string`、`size?`（預設列表用小尺寸，如 28–32px 方框）。
- 樣式對齊 shadcn 視覺語彙：`rounded-md border border-border/60 bg-muted/30`，內部 `object-contain`。
- 原生 `<img>`（`loading="lazy"`、`decoding="async"`），帶 DB `width/height` 屬性以保留版位、避免 CLS。
- 缺圖（約 17 個道具）→ lucide 佔位圖（如 `Package` / `ImageOff`）置中，維持相同框尺寸不跳版。
- 純展示元件；不自行查 DB。

**`src/components/common/entity-portrait.tsx` — `<EntityPortrait>`**
- 給怪物/NPC 立繪用，較大方框，`object-contain`。
- 同樣原生 `<img>` + 佔位處理；缺圖時顯示中性佔位（怪物用 lucide `Ghost` 之類）。
- 立繪較有份量，怪物詳情頁可包在 `Card` 內；是否可放大沿用 `Dialog`（見 3.3）。

**擴充 `src/components/items/item-cover.tsx`**
- 保留現有 imgur 大圖行為。
- 新增：當無 imgur 大圖但有官方 icon 時，於同款可放大框內顯示官方圖，套 `image-rendering: pixelated` 放大（Tailwind 任意值 `[image-rendering:pixelated]`），呈現銳利像素風。
- 兩種情形都走 `Dialog` 可點開放大。

**渲染策略**：全站沿用既有刻意做法 — 原生 `<img>` 直連 `img.hanshino.dev`，**不改 `next.config`**、不引入 next/image。

### 3.3 詳情頁大圖決策流程

道具詳情頁（`src/app/items/[id]/page.tsx`）：
```
cover = imageOfItem(item)            // 既有 imgur 大圖（412）
icon  = getItemIcon(item.id)         // 官方小圖
→ 傳給 ItemDetail / ItemCover：
   有 cover      → 顯示 imgur 大圖（可放大）
   否則有 icon   → 官方圖 pixelated 放大（可放大）
   都沒有        → 佔位
```

怪物詳情頁（`src/app/monsters/[id]/page.tsx`）：`getNpcImage(monster.id)` → `<EntityPortrait>`（可放大）。

## 4. 鋪設地圖（分三階段）

### Phase A — 基礎建設 + 最高曝光
- `src/lib/queries/images.ts`（解析器）
- `src/components/common/item-icon.tsx`（`<ItemIcon>`）
- 擴充 `src/components/items/item-cover.tsx`（官方圖 pixelated 後備）
- **道具列表**：`src/components/items/item-table.tsx` 名稱前加縮圖；頁面 `src/app/items/page.tsx` 補圖。
- **道具詳情**：`src/app/items/[id]/page.tsx` + `src/components/items/item-detail.tsx` 套用 3.3 大圖流程。

### Phase B — 怪物/NPC 立繪
- `src/components/common/entity-portrait.tsx`（`<EntityPortrait>`）
- **怪物列表**：`src/components/monsters/monster-table.tsx` + `src/app/monsters/page.tsx`
- **怪物詳情**：`src/components/monsters/monster-detail.tsx` + `src/app/monsters/[id]/page.tsx`
- **任務 NPC 立繪**：任務相關 NPC 透過 `mission_refs.npc_id`（`ref_type='npc'`）解析立繪，呈現於 `src/components/missions/mission-dialogue.tsx` / 任務步驟 NPC 引用 + `src/app/missions/[id]/page.tsx`。

> 註：`shops` 表無 `npc_id` 欄位（僅 `castle_id`、`style0–3`），與 NPC 無直接綁定關係，故**不做商店店主立繪**；商店頁的道具買/賣清單小圖示仍於 Phase C 處理。

### Phase C — 其餘道具小圖示鋪滿
- **怪物掉落清單**：`src/components/monsters/monster-drop-table.tsx`
- **道具的怪物掉落來源**：`src/components/items/item-drop-list.tsx`
- **合成**：`src/components/compounds/compound-recipe-table.tsx`、`material-link.tsx`、`output-cell.tsx`；道具詳情的 `compound-sources-section.tsx`、`compound-uses-section.tsx`
- **商店買/賣清單**：`src/app/shops/[id]/page.tsx` 的道具清單
- **任務道具**：`src/components/items/mission-uses-section.tsx` 及任務頁道具引用
- **比較工具**：`src/components/compare/compare-matrix.tsx`、`item-picker.tsx`、`compare-bar.tsx`
- **排行榜**：`src/components/ranking/ranking-table.tsx`

各表格/清單皆以「頁面補圖 → 元件讀 `row.icon` 用 `<ItemIcon>`」模式套用，不重造輪子。

## 5. 型別調整

- 於 `src/lib/queries/images.ts` 定義 `EntityImage`。
- 表格 rows 的 icon 以「附加欄位」形式帶入（`row.icon?: EntityImage | null`），或由頁面另傳 `iconMap` prop；優先採用 enrich rows，元件介面最單純。避免大改 `src/lib/types/item.ts` / `monster.ts` 的核心型別，改以延伸型別（如 `ItemWithIcon = Item & { icon?: EntityImage | null }`）承接。

## 6. 非目標（YAGNI）

- 不呈現 `gicon`（掉落外觀）。
- 不引入 next/image、不改 `next.config`、不做圖片 CDN 代理。
- 不做圖片上傳/編輯後台；`*.sqlite` 為唯讀資料。
- 地圖頁（`/maps`）NPC 標記本次不納入（可日後追加，元件已可重用）。
- 不重建既有 imgur `equipment-images.json` 系統，維持互補。

## 7. 邊界與正確性

- **缺圖**：道具 ~17、怪物 ~71 無對應圖，一律佔位、維持框尺寸、不跳版。
- **CLS**：`<img>` 帶 `width/height`；顯示尺寸以 CSS `object-contain` 於固定框內約束。
- **效能**：列表頁單發批次查詢；`IN` 清單依批次大小切分。
- **無障礙**：`alt` 帶道具/怪物名稱；放大互動沿用既有 `Dialog`（含 `sr-only` 標題）。
- **一致性**：所有圖走原生 `<img>` hotlink，與現有 `ItemCover` 決策一致。

## 8. 驗證方式

- `npm run lint`、`npm run build` 通過。
- 既有測試（`src/lib/**/__tests__`、`src/components/**/__tests__`）維持綠燈；為 `images.ts` 解析器補最小單元測試（空輸入、批次切分、Map 對應）。
- 人工/截圖驗收：道具列表縮圖、道具詳情（imgur 大圖 vs 官方像素放大兩種情形）、怪物列表/詳情立繪、掉落與合成清單小圖。
