# 地圖圖片與 NPC 疊圖呈現 — 設計規格

- 日期：2026-07-24
- 狀態：已核准，準備進入實作計畫
- 範圍：把新加入資料庫的地圖圖片（`map_images`）與 NPC 座標（`map_placements`）呈現到地圖詳情頁 `/maps/[id]`
- 前情：延續 `2026-07-23-item-npc-images-design.md` 第 6 節留下的伏筆（「地圖頁 NPC 標記本次不納入，可日後追加」），本規格即為該追加。

## 1. 背景與資料現況

`tthol.sqlite` 新增了一批地圖相關資料表。地圖圖片為外部 URL（使用者自有 CDN `https://img.hanshino.dev/*.webp`），與既有圖片系統相同的 hotlink 慣例。

### `map_images`（本次主要使用）
```sql
CREATE TABLE `map_images` (
  `stage_kind` varchar(255) not null,   -- 'stage' | 'sestage'
  `stage_id` integer not null,
  `url` varchar(255) not null,          -- webp CDN
  `img_width` integer not null,         -- 像素寬（= map_w_tiles × tile_px）
  `img_height` integer not null,        -- 像素高（= map_h_tiles × tile_px）
  `map_w_tiles` integer not null,       -- 地圖寬（格）
  `map_h_tiles` integer not null,       -- 地圖高（格）
  `tile_px` integer not null default '40',
  primary key (`stage_kind`, `stage_id`)
);
```
- **62 筆**（涵蓋 62 / 718 個 stage，約 8.6%），其餘 656 張無圖，需優雅降級。
- 圖片很大（最大約 5600×7800），不可原尺寸硬塞，需響應式縮放。
- 已驗證像素與格子完美對齊：例如 stage 2 = 122 格 × 40 = 4880px（= `img_width`）。

### `map_placements`（座標來源）
```sql
CREATE TABLE `map_placements` (
  `id` integer primary key autoincrement,
  `stage_kind` varchar(8) not null,
  `stage_id` integer not null,
  `record_idx` integer not null,
  `category` varchar(255) not null,     -- 'spawn' | 'arrival' | 'trigger' | 'npc'
  `obj_seq` integer,
  `type_field` integer,
  `npc_id` integer,
  `tag_id` integer,
  `raw_x` integer, `raw_y` integer,
  `tile_x` integer, `tile_y` integer,   -- 本次定位依據
  `in_bounds` boolean
);
-- 索引：stage(kind,id)、category、npc_id
```
- 43,187 筆，其中 `category='npc'` 有 **2,902 筆**；`npc_id` 可 join `npc` 取名字。
- 座標換算：`left% = tile_x / map_w_tiles × 100`、`top% = tile_y / map_h_tiles × 100`（等價於 `raw_x/img_width`）。
- `in_bounds=0` 者不畫（避免跑出圖外）。

### 既有可重用資產（不重造）
- `src/lib/queries/images.ts` 的 **`getNpcImageMap(ids)`** — 直接拿來補 NPC 頭像。
- `src/components/common/entity-portrait.tsx`（`<EntityPortrait size="sm">`）— NPC 清單縮圖。
- `src/components/common/link-list.tsx`（`LinkListSection` / `LinkListRow`）— NPC 清單樣式。
- 全站 hotlink `<img>` 慣例（不走 next/image、不改 `next.config`）。

### 地圖詳情頁現況（`src/app/maps/[id]/page.tsx`）
目前有：屬性格（`PropertiesGrid`）、同區域地圖、指向此處的地圖（`InboundList`）、怪物出沒（`StageMonsterSpawns`）、相關任務（`MissionsList`）。**完全沒有地圖圖片，也沒有 NPC 清單**（NPC 是本批新資料才帶進來）。

## 2. 產品決策（已與使用者確認）

1. **呈現深度：中等** — 貼圖 + NPC 標記；**不做**平移/縮放。
2. **標記樣式：圓點 + hover 彈卡** — 預設只顯示小圓點，桌機 hover（手機點擊）彈出「頭像 + 名字」。
3. **NPC 清單：常駐 + 有圖就疊圖** — 每張地圖都顯示 NPC 清單（含頭像）；有圖的 62 張額外在圖上疊圓點，hover 時清單項 ↔ 圓點互相高亮。涵蓋全 718 張、手機/無障礙皆可用。
4. **版面：上下堆疊** — 地圖圖在上、NPC 清單在下（桌機、手機一致）。

> **實作前發現的修正（2026-07-24）：** 地圖上的 NPC 皆為城鎮 NPC（店主、任務 NPC），**不在 `monsters` 表**，且本專案**沒有 NPC 詳情頁**（路由無 `/npc`）。故 NPC 標記與清單為**純展示（頭像＋名字），不設連結**，避免壞連結。`shops` 表無 `npc_id`、`npc→mission` 對應成本高，皆為 YAGNI，不做。NPC 皆有 `npc_images` 頭像（已驗證）。

## 3. 架構

### 3.1 資料存取 — 新增 `src/lib/queries/maps.ts`

沿用 `images.ts` 的集中批次風格，避免動到既有 `stages.ts` / `monster-spawns.ts`。

```ts
export interface StageMapImage {
  url: string;
  imgWidth: number;
  imgHeight: number;
  tilesW: number;
  tilesH: number;
  tilePx: number;
}

// 單張地圖背景圖；無圖回 null（656 張）
export function getStageMapImage(kind: StageKind, id: number): StageMapImage | null;

export interface NpcPlacement {
  npcId: number;
  name: string | null;
  tileX: number;
  tileY: number;
  image: EntityImage | null;   // 來自 getNpcImageMap
}

// 該 stage 全部 NPC placement（category='npc' 且 in_bounds=1），每個座標一筆
export function getNpcPlacementsForStage(kind: StageKind, id: number): NpcPlacement[];
```

- `getNpcPlacementsForStage`：`SELECT ... FROM map_placements p LEFT JOIN npc n ON n.id = p.npc_id WHERE p.stage_kind = ? AND p.stage_id = ? AND p.category = 'npc' AND p.in_bounds = 1`，回來後用**現成的** `getNpcImageMap(distinct npcIds)` 一次補頭像（無 N+1）。
- `EntityImage` 沿用 `images.ts` 既有型別。
- `StageKind` 沿用 `src/lib/types/stage.ts`。

### 3.2 元件

**`src/components/maps/stage-map-viewer.tsx` — `<StageMapViewer>`（client）**

需要 hover 共享狀態（圓點 ↔ 清單互相高亮），故為 client component；資料由 page（server）查好後以 props 傳入。

- Props：`image: StageMapImage | null`、`placements: NpcPlacement[]`。
- 若 `image` 存在：
  - 外層 `relative` 容器，寬度為版面容器寬（`w-full`）。`<img src={image.url} className="block w-full h-auto" loading="lazy" decoding="async" />`，帶 `width/height`（用 `imgWidth/imgHeight`）避免 CLS。
  - 每筆 placement 一個 `absolute` 圓點，定位 `left: tileX/tilesW*100%`、`top: tileY/tilesH*100%`，`-translate-x-1/2 -translate-y-1/2` 置中。
  - 圓點為可聚焦按鈕（`aria-label={name}`）；桌機 hover / 手機點擊彈出額卡：`<EntityPortrait size="sm">` + 名字（純展示，無連結）。
  - 超高的地圖直接讓容器自然變高、頁面可捲動（不裁切、不 letterbox，確保百分比定位永遠對齊圖片）。
- 常駐 **NPC 清單**（無論有無圖都渲染）：以 `npcId` 去重，用一個非連結的清單列（沿用 `LinkListSection` 的外框樣式，但列改為 `<li>` 純展示，不用 `LinkListRow`，因為無連結目的地）+ `<EntityPortrait size="sm">` + 名字。
- **互相高亮**：以 `hoveredNpcId` state 串連；hover 清單列 → 該 NPC 的所有圓點高亮（放大/加環），反之亦然。同一 NPC 多個 placement 一起亮。

**彈卡元件 — `src/components/ui/popover.tsx`（已存在，直接重用）**

- 已有 shadcn 風格包裝（`Popover` / `PopoverTrigger` / `PopoverContent`），底層為 `@base-ui/react/popover`。
- 圓點作為 `PopoverTrigger`：`Popover` Root 設 `openOnHover`（桌機 hover 開）＋ trigger 點擊開（手機），`PopoverContent` 內為頭像 + 名字（純展示，無連結）。
- 常駐清單已是手機主要入口，故彈卡屬漸進增強。

**NPC 為純展示、不設連結**：地圖 NPC 為城鎮 NPC，不在 `monsters` 表、專案無 NPC 詳情頁，故標記與清單皆只顯示頭像＋名字，不連結（見第 2 節修正說明）。

### 3.3 版面整合（`src/app/maps/[id]/page.tsx`）

- 於 `MapDetailPage` 內新增：
  ```ts
  const mapImage = getStageMapImage(stage.kind, stage.id);
  const npcPlacements = getNpcPlacementsForStage(stage.kind, stage.id);
  ```
- 位置：放在 `<header>` 之後、`<PropertiesGrid>` 之前（地圖圖是本頁最直觀主視覺）。
- 呈現分支：
  - 有圖 + 有 NPC → 圖 + 疊點 + 清單。
  - 無圖 + 有 NPC → 只有清單。
  - 無 NPC（多為地城，只有怪物）→ `<StageMapViewer>` 有圖仍顯示純地圖圖、無圖則整段不顯示；NPC 清單不顯示。維持既有怪物出沒區塊不變。

## 4. 邊界與正確性

- **無圖（656 張）**：不顯示圖，只顯示 NPC 清單；兩者皆無則整段略過。
- **`in_bounds=0`**：查詢即過濾，不畫點。
- **同一 NPC 多 placement**：多個圓點、清單一列；高亮時該 NPC 全部圓點同時亮。
- **CLS**：`<img>` 帶 `width/height`（DB 像素值），CSS `w-full h-auto` 縮放。
- **無障礙**：圓點 `aria-label` 帶 NPC 名，可鍵盤 focus 開卡；清單為語意化連結，手機主要入口。
- **效能**：每頁一支 placement 查詢 + 一支 `getNpcImageMap` 批次查詢（`IN` 依既有批次切分），無 N+1。
- **無壞連結**：NPC 為純展示、不設連結（見第 2 節修正）。

## 5. 非目標（YAGNI）

- 不做平移 / 縮放 / 迷你地圖。
- 不疊出生點（spawn）、傳送門（arrival/warp）、觸發點（trigger）— 資料具備，留待日後（元件可擴充 category）。
- 不呈現 `map_objects` / `map_object_images` 裝飾物。
- 不引入 next/image、不改 `next.config`、不做 CDN 代理。
- 不動 `/maps` 列表頁（本次只做詳情頁）。
- `*.sqlite` 為唯讀資料，不做任何寫入。

## 6. 驗證方式

- `npm run lint`、`npm run build` 通過。
- 既有測試維持綠燈；為 `src/lib/queries/maps.ts` 補最小單元測試：
  - `getStageMapImage`：有圖 stage 回正確欄位、無圖 stage 回 `null`。
  - `getNpcPlacementsForStage`：只回 `category='npc'` 且 `in_bounds=1`、名字 join 正確、頭像對應正確、空 stage 回空陣列。
- 人工/截圖驗收：
  - 有圖地圖（如 stage 2 莫愁谷村莊，多 NPC）：圓點對齊、hover 彈卡、清單 ↔ 圓點互相高亮。
  - 無圖地圖：只有 NPC 清單。
  - 無 NPC 地城地圖：不出現空清單。
  - 手機：點圓點開卡、清單可用。
