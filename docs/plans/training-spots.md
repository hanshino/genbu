---
title: 練功地圖／等級路線 implementation plan
created: 2026-08-15
status: proposed
---

# 練功地圖／等級路線

## 問題／目標

目前 `/maps` 以「瀏覽全部地圖」為核心，依區域列出地圖並提供名稱／ID 搜尋；資料流是 `getAllStageListItems()`、`getAllStageGroupStats()` → `MapList`，沒有以玩家等級反查地圖的能力（`src/app/maps/page.tsx:13-33`、`src/components/maps/map-list.tsx:17-43`）。

單張地圖頁已能依 `(stage.kind, stage.id)` 顯示刷怪清單、刷怪點數、怪物等級與 HP（`src/app/maps/[id]/page.tsx:175-185`、`src/app/maps/[id]/page.tsx:243-250`、`src/components/maps/stage-monster-spawns.tsx:8-30`），但玩家仍要逐張打開地圖，無法直接回答：

> 「我現在 X 等，哪些地圖有接近我等級的怪物？」

本功能新增一個 database-driven 反向查詢入口：玩家輸入等級，系統依 `monster_spawns` 與 `npc.level` 聚合每張地圖的怪物等級分布，列出符合固定、透明規則的候選地圖。

結果只能稱為「依資料庫怪物等級推導的候選地圖」，不得稱為官方推薦、最高效率、最佳練功點或保證可進入。資料庫呈現與實機規則必須分開；repository 的 editorial 原則明定 database 適合呈現欄位與關聯，但不可補猜未知語意，也不可把演算法通過測試當成遊戲規則已證實（`docs/plans/guide-content-platform-roadmap.md:41-52`、`docs/plans/guide-content-platform-roadmap.md:63-77`）。

## Settled scope

- 新增獨立 route：`/training-spots`，頁面任務固定為「輸入玩家等級 → 找出怪物等級相近的地圖」。
- 第一版接受玩家等級 `1–200` 的整數；此範圍沿用目前怪物 level 常數（`src/lib/constants/monster-level.ts:1-4`）。
- 「適合 X 等」定義為：地圖至少有一個有效刷怪點，其 `npc.level` 落在玩家等級 `X ± 5`，上下界 inclusive，並 clamp 到 `1–200`。
- `npc.level <= 0` 或超出 `1–200` 的刷怪 row 不參與適配、等級區間與排序；另以 `unknownLevelSpawnPoints` 保留數量，避免把未知值當成 Lv 0。
- **練功對象定義：** 候選怪物必須同時滿足 `JOIN monsters m ON m.id = n.id` 與 `m.drop_exp > 1`。`monsters` 是 entity 邊界；`drop_exp > 1` 是「打了有經驗」的判準，用來排除城鎮 NPC、木人樁、寶箱、水晶與採集物。理由與證據見「練功對象判準」一節。
- `npc.level` 沿用現有怪物列表與地圖刷怪顯示所採用的 level 欄位（`src/lib/queries/monsters.ts:118-125`、`src/lib/queries/monsters.ts:185-205`、`src/lib/queries/monster-spawns.ts:73-88`）。
- 同一 NPC 在同一 stage 的多筆 `monster_spawns` row 視為多個資料庫刷怪點；計算 `spawnPoints` 時保留，計算怪物種類數時以 `COUNT(DISTINCT npc_id)` 去重。現有單張地圖 query 也以 `COUNT(*)` 表示刷怪點、以 NPC ID 聚合怪物種類（`src/lib/queries/monster-spawns.ts:73-88`）。
- 第一版結果不載入每張地圖背景圖、不展開完整怪物清單；卡片連到既有 `/maps/[id]`，由既有詳情頁取得背景圖、NPC placement 與怪物清單（`src/app/maps/[id]/page.tsx:180-185`、`src/app/maps/[id]/page.tsx:217-245`）。
- 使用 Server Component 與 GET query string；不新增 API route，不做 client-side data fetching。
- 不新增 dependency、不修改 `tthol.sqlite`、不建立 CMS。
- 所有玩家可見文字使用繁體中文，技術名詞保留 English（`CLAUDE.md:46-50`）。

## Non-goals / Deferred

第一版明確不做：

- 不計算每小時經驗、每分鐘經驗、擊殺速度或實際升級效率。
- 不依 `monsters.drop_exp` 的**數值大小**產生「效率排名」。`drop_exp` 在本功能只作為 boolean 判準（`> 1` 代表是練功對象），不參與排序、不顯示 EXP 數值、不換算每小時經驗。現有怪物列表 query 也沒有讀取 `drop_exp`（`src/lib/queries/monsters.ts:185-205`）。
- 不計算重生時間、地圖面積、走位距離、同時在線人數、搶怪競爭或實際怪物密度。
- 不把 `monster_spawns` row 數稱為畫面上同時存在的怪物數；只稱「資料庫刷怪點數」。
- 不計算掉寶期望值、金錢期望值或掉落百分比；editorial checklist 禁止在沒有權威分母或公式時把數值誤寫成保證值（`docs/plans/guide-content-platform-roadmap.md:69-73`）。
- 不提供跨地圖路線規劃、傳送順序、最短路徑或「1–200 一條龍」路線。
- 不提供職業、裝備、技能、組隊、寵物或玩家 build 適性。
- 不推斷劇情地圖、副本、限時地圖或任務專用地圖一定可自由進入。
- 不推斷 `stages.min_level_require` 是目前版本實機強制門檻，也不以它覆蓋怪物等級適配結果。
- 不做收藏、帳號、歷史紀錄、分享、個人化或 telemetry。
- 不做 pagination、無限捲動或虛擬列表；第一版先以單一等級窗口的實際結果量驗證需求，沒有證據前不加入額外狀態與元件。
- 不為此功能建立通用 recommendation engine、ranking framework、repository layer 或額外資料快取。

## 已確認資料證據

### DB 證據

以下數字由 2026-08-15 的唯讀 audit（Python `sqlite3` `mode=ro`）取得，未修改 `tthol.sqlite`。這些是 audit 結果，不是 repository file 內容，因此無 file:line：

- `monster_spawns`：18,253 rows，欄位包含 `stage_kind`, `stage_id`, `npc_id`, `x`, `y`。
- `stages`：718 rows，欄位包含 `kind`, `id`, `name`, `group`, `min_level_require`。
- `npc`：5,143 rows，含 `level`、`is_monster`、`hp`、`damage_min/max` 等欄位。
- `monsters`：2,829 rows，含 `level`、`hp`、`drop_exp`、`drop_money_min/max`、`drop_item`。
- `monster_spawns.npc_id → npc.id` join 成立。
- `monster_spawns.(stage_kind, stage_id) → stages.(kind, id)` join 成立。
- 全部 2,829 隻 `monsters` 都可對到 `npc`；怪物 npc level 範圍 1–200。
- 466 個 stage 組合有 monster spawn，涵蓋 2,229 個不同 `npc_id`。

### Repository 能力與邊界

| 證據 | 可複用能力 | 邊界 |
|---|---|---|
| `src/lib/queries/monster-spawns.ts:5-28` | 已能按怪物反查 stage，並以 `(kind, id)` 分組計算 `spawnPoints` | 查詢方向是 monster → map，不是 level → map |
| `src/lib/queries/monster-spawns.ts:30-70` | 已有 batch query pattern，避免逐怪物 N+1 | 回傳仍按 NPC 分組，不提供地圖等級聚合 |
| `src/lib/queries/monster-spawns.ts:73-90` | `getMonstersAtStage()` 以單一 stage 查怪物 level、HP、刷怪點數 | 適合單張詳情，不應對候選地圖逐張呼叫造成 N+1 |
| `src/lib/queries/maps.ts:14-29` | `getStageMapImage(kind, id)` 已處理無圖並回傳 `null` | 是單張查詢；註解指出 718 張中僅 62 張有圖，不適合為列表逐張查詢 |
| `src/lib/queries/maps.ts:48-79` | 已有單張 stage 的 NPC placement query | placement 不等於怪物重生規則、移動路徑或戰鬥效率 |
| `src/lib/queries/monsters.ts:72-99` | 已有 level bounds 的 normalize/clamp pattern | 目前用於怪物列表的任意上下限，不是玩家等級適配規則 |
| `src/lib/queries/monsters.ts:118-221` | 現有怪物列表以 `npc` 為主、按 `npc.level` 過濾與排序 | 使用 `n.type > 0`，範圍比 `monsters` entity 更寬；練功地圖應用 `JOIN monsters` 收窄 |
| `src/lib/types/stage.ts:1-6` | `StageKind` 已定義為 `"stage" \| "sestage"` | 不能把兩種 kind 靜默合併 |
| `src/app/maps/page.tsx:13-38` | 現有 `/maps` 是完整地圖 hub，並已有 database source disclaimer | 核心資訊架構不是玩家等級反查 |
| `src/app/maps/[id]/page.tsx:175-185` | 地圖詳情已整合 stage、monster、map image 與 placement | 新列表只需連入，不必複製詳情能力 |
| `src/app/maps/[id]/page.tsx:247-250` | 現有頁面已標示怪物清單來自 `GENERATOR.OBD`，不含劇情／腳本生成怪物 | 練功候選同樣不能宣稱涵蓋所有實機生成怪物 |
| `src/components/maps/stage-monster-spawns.tsx:8-30` | 現有 UI 已將 row 聚合稱為「刷怪點」並顯示 Lv、HP | 新頁應沿用「資料庫刷怪點」用語 |
| `src/components/layout/navbar.tsx:15-37` | 已有單一 desktop/mobile 共用的 navigation data | 新入口只需加一個 nav item |
| `CLAUDE.md:52-70` | UI 必須 shadcn-first，並優先使用既有 primitive | 禁止為卡片、按鈕、輸入或 badge 重造 primitive |
| `src/components/ui/card.tsx:5-88` | 可複用 `Card` family | 地圖結果不需手刻 card container |
| `src/components/ui/input.tsx:6-17` | 可複用 `Input`，使用 native `type="number"` | 不需第三方 number picker |
| `src/components/ui/button.tsx:43-58` | 可複用 `Button` | GET form 用普通 submit |
| `package.json:18-31` | 已安裝 Next.js、React、better-sqlite3、Base UI、lucide、shadcn | 本功能不需新增 dependency |

## Scope 決策：新增 `/training-spots`

### 推薦

新增獨立 `/training-spots` route，不把 level-first flow 塞進既有 `/maps`。

### 理由

1. **玩家任務方向不同。** `/maps` 是 map-first：瀏覽區域、搜尋名稱／ID、進入單張詳情（`src/app/maps/page.tsx:13-33`、`src/components/maps/map-list.tsx:17-43`）。`/training-spots` 是 level-first：輸入等級後反查候選地圖。
2. **避免讓 `/maps` 同時承擔兩種 primary state。** 現有 `MapList` 已管理搜尋、區域分組、sticky controls 與 group anchors（`src/components/maps/map-list.tsx:17-55`、`src/components/maps/map-list.tsx:94-143`）。再加入玩家等級、適配規則、排序與來源說明，會增加相互干擾的 filter state。
3. **保留穩定 URL。** `/training-spots?level=80` 可直接分享、重新整理與 server render（`docs/plans/guide-content-platform-roadmap.md:9-17`）。
4. **仍複用既有地圖詳情。** 新 route 只負責候選搜尋，每張卡片連到 `/maps/[id]`（`src/app/maps/[id]/page.tsx:217-245`）。
5. **最小修改。** 不改寫 `MapList`，不建立共用 filter framework；只新增一頁、一個聚合 query、一個 type 與最小 navigation item。

### `/maps` 是否修改

第一版不修改 `src/app/maps/page.tsx` 或 `src/components/maps/map-list.tsx`。入口放在既有 navigation；若 mockup review 發現玩家仍找不到，可在 `/maps` header 加一個 CTA，但這是 conditional，不列為初始必要 diff。

## Query contract

### 新增 symbol

在 `src/lib/queries/monster-spawns.ts` 新增：

```ts
export const TRAINING_LEVEL_RADIUS = 5;

export function parseTrainingLevel(
  value: string | undefined,
): number | null;

export function getTrainingSpots(
  playerLevel: number,
): TrainingSpot[];
```

理由：

- `monster-spawns.ts` 已負責 stage ↔ monster spawn 的雙向查詢（`src/lib/queries/monster-spawns.ts:5-90`）。
- 新查詢本質仍是相同 relation 的第三個 read model：level → stage。
- 不建立新的 repository/service abstraction。
- `parseTrainingLevel()` 保持 trust-boundary validation 可獨立測試；只接受 `1–200` 整數，不默默把 `0`、`201`、小數或非數字改成其他玩家等級。

### Type

在 `src/lib/types/monster-spawn.ts` 新增：

```ts
export interface TrainingSpot {
  stageKind: StageKind;
  stageId: number;
  stageName: string;
  groupId: number | null;

  minLevelRequire: number | null;

  monsterLevelMin: number;
  monsterLevelMax: number;
  suitableLevelMin: number;
  suitableLevelMax: number;

  monsterCount: number;
  suitableMonsterCount: number;

  spawnPoints: number;
  suitableSpawnPoints: number;
  unknownLevelSpawnPoints: number;

  fitPercent: number;
  averageLevelDistance: number;

  /** 適配窗口內的怪物預覽，供卡片立繪帶使用；依 level 遞增、id 遞增排序。 */
  suitableMonsters: TrainingSpotMonster[];
}

export interface TrainingSpotMonster {
  npcId: number;
  name: string;
  level: number;
  /** 來自 npc_images；約 5% 怪物查無，UI 需有 fallback。 */
  image: EntityImage | null;
}
```

欄位語意：

- `monsterLevelMin` / `monsterLevelMax`：該 stage 所有有效練功對象 spawn rows 的 `MIN(n.level)` / `MAX(n.level)`。
- `suitableLevelMin` / `suitableLevelMax`：只看落在 `playerLevel ± 5` 內的 `MIN/MAX(n.level)`。
- `monsterCount`：有效等級練功對象的 distinct NPC 數。
- `suitableMonsterCount`：適配窗口內的 distinct NPC 數。
- `spawnPoints`：有效等級練功對象的 `monster_spawns` row 數。
- `suitableSpawnPoints`：適配窗口內的 `monster_spawns` row 數。
- `unknownLevelSpawnPoints`：通過練功對象判準但 `npc.level` 不在 `1–200` 的 row 數；包含 level 0。
- `fitPercent`：`suitableSpawnPoints / spawnPoints * 100`，只用於描述「刷怪點等級集中度」。
- `averageLevelDistance`：以有效 spawn row 為權重的 `AVG(ABS(n.level - playerLevel))`，只作穩定 tie-break 與透明補充，不稱效率。
- `minLevelRequire`：原樣回傳 `stages.min_level_require`，不參與適配與排序。
- `suitableMonsters`：適配窗口內的 distinct 怪物，含名稱、等級與立繪。長度等於 `suitableMonsterCount`；卡片只顯示前 5 隻，其餘以 `+N` 表示，`N` 由 UI 從 `suitableMonsterCount` 推導，不另外傳欄位。

### 立繪資料（設計核可後新增）

核可的 mockup 以怪物立繪為卡片主視覺，因此 query 需一併回傳適配怪物清單。

- 立繪來自既有 `npc_images`（4,940 rows）；已有可複用的 `getNpcImageMap(ids)` batch query（`src/lib/queries/images.ts:63-71`），回傳 `Map<number, EntityImage>`。
- 涵蓋率：全體刷怪怪物 1,868 / 1,964 有立繪（95%）；Lv 75–85 窗口 113 / 119（2026-08-15 audit）。約 5% 查無，`image` 為 `null`，UI 走 fallback，不得破圖。
- 原圖尺寸不一（48×65 至 177×187 皆有），UI 需統一容器並以 `object-fit: contain` 處理。
- 取得方式：aggregate query 回傳地圖列後，以第二個 batch query 取得所有候選 stage 的適配怪物，再用 `getNpcImageMap()` 一次補上立繪。**總計固定 3 個 query，不得逐 stage 或逐怪物查詢造成 N+1。**
- 立繪直接使用 `npc_images.url`（既有 CDN），不複製檔案進 repository。mockup 的 `assets/monsters/` 只是設計稿為避免熱連外站的作法，不進產品程式碼。

`StageKind` 必須保留（`src/lib/types/stage.ts:1-6`）。即使目前兩種 kind 的 ID 範圍互斥，也不可在 query contract 丟失 compound key。

### SQL 形狀

實作使用單一 aggregate SQL，不先載入 18,253 rows 到 TypeScript，也不對每張地圖呼叫 `getMonstersAtStage()`：

```sql
SELECT
  s.kind AS stageKind,
  s.id AS stageId,
  s.name AS stageName,
  s.[group] AS groupId,
  s.min_level_require AS minLevelRequire,

  MIN(CASE WHEN n.level BETWEEN 1 AND 200 THEN n.level END)
    AS monsterLevelMin,
  MAX(CASE WHEN n.level BETWEEN 1 AND 200 THEN n.level END)
    AS monsterLevelMax,

  MIN(CASE WHEN n.level BETWEEN :levelMin AND :levelMax THEN n.level END)
    AS suitableLevelMin,
  MAX(CASE WHEN n.level BETWEEN :levelMin AND :levelMax THEN n.level END)
    AS suitableLevelMax,

  COUNT(DISTINCT CASE
    WHEN n.level BETWEEN 1 AND 200 THEN n.id
  END) AS monsterCount,

  COUNT(DISTINCT CASE
    WHEN n.level BETWEEN :levelMin AND :levelMax THEN n.id
  END) AS suitableMonsterCount,

  SUM(CASE
    WHEN n.level BETWEEN 1 AND 200 THEN 1 ELSE 0
  END) AS spawnPoints,

  SUM(CASE
    WHEN n.level BETWEEN :levelMin AND :levelMax THEN 1 ELSE 0
  END) AS suitableSpawnPoints,

  SUM(CASE
    WHEN n.level < 1 OR n.level > 200 OR n.level IS NULL THEN 1 ELSE 0
  END) AS unknownLevelSpawnPoints,

  100.0 * SUM(CASE
    WHEN n.level BETWEEN :levelMin AND :levelMax THEN 1 ELSE 0
  END) / NULLIF(
    SUM(CASE WHEN n.level BETWEEN 1 AND 200 THEN 1 ELSE 0 END),
    0
  ) AS fitPercent,

  AVG(CASE
    WHEN n.level BETWEEN 1 AND 200 THEN ABS(n.level - :playerLevel)
  END) AS averageLevelDistance

FROM monster_spawns ms
JOIN stages s
  ON s.kind = ms.stage_kind
 AND s.id = ms.stage_id
JOIN npc n
  ON n.id = ms.npc_id
JOIN monsters m
  ON m.id = n.id

WHERE s.name IS NOT NULL
  AND m.drop_exp > 1

GROUP BY
  s.kind,
  s.id,
  s.name,
  s.[group],
  s.min_level_require

HAVING SUM(CASE
  WHEN n.level BETWEEN :levelMin AND :levelMax THEN 1 ELSE 0
END) > 0

ORDER BY
  fitPercent DESC,
  suitableSpawnPoints DESC,
  averageLevelDistance ASC,
  s.kind ASC,
  s.id ASC;
```

實際 SQL 可依 better-sqlite3 parameter syntax 調整，但不能改變上述語意。

### 練功對象判準：`drop_exp > 1`

候選怪物必須同時通過兩個條件：

```sql
JOIN monsters m ON m.id = n.id
WHERE m.drop_exp > 1
```

#### 為何需要這個判準

`monster_spawns` 不只收錄練功怪。2026-08-15 唯讀 audit 觀察到以下反例，若只用 `JOIN monsters` 會全部混入候選：

| stage | NPC | Lv | hp | drop_exp | money | drop_item |
|---|---|---|---|---|---|---|
| `sestage:1958` 檀泉別苑 | 獨孤漪 | 75 | 134,865 | 1 | 1–1 | `[]` |
| `sestage:1958` 檀泉別苑 | 端木嗣 | 75 | 134,355 | 1 | 1–1 | `[]` |
| `sestage:1958` 檀泉別苑 | 獨孤霜 | 75 | 181,380 | 1 | 1–1 | `[]` |
| `sestage:1958` 檀泉別苑 | 秦逸飛 | 75 | 143,760 | 1 | 1–1 | `[]` |

檀泉別苑是城鎮，這四個是 NPC 不是練功目標。對照同窗口的真練功點 `stage:39` 八門八窟一層：

| NPC | Lv | hp | spawn rows |
|---|---|---|---|
| ▲女刺客 | 77 | 10,718 | 9 |
| ●登徒浪子 | 78 | 10,318 | 14 |
| ▲刀斧手 | 80 | 9,262 | 12 |

`drop_exp = 1` + `money = 1-1` + `drop_item = []` 三個欄位一致指向「打了沒有收益」，語意直接對應本功能目的：練功地圖要找的是打了有經驗的怪。

同一判準也一併排除木人樁、寶箱、水晶與採集物（例如 `寶箱 Lv2 hp=1`、`▲少陰木人 Lv38 hp=1`、`靈珠草 Lv32 hp=10`）。

#### 為何不用 hp 或 type

- **hp 不可行。** 檀泉別苑 NPC 血量 134k–181k，遠高於真練功怪的約 10k。血量高低與是否為練功對象沒有單調關係，任何 hp 閾值都會同時誤殺與漏放。此路徑在 audit 中已被實測否定。
- **type 不可行。** 訓練樁多為 `type = 18`，但 `靈珠草` 是 `type = 16`；`type` 無法單獨切乾淨。

#### 對候選數的影響

| 玩家等級 | 僅 `JOIN monsters` | 加 `drop_exp > 1` | 剔除 |
|---|---|---|---|
| Lv 38 | 60 張 | 37 張 | 23 |
| Lv 48 | 83 張 | 38 張 | 45 |
| Lv 80 | 53 張 | 31 張 | 22 |
| Lv 150 | 29 張 | 9 張 | 20 |
| Lv 185 | 27 張 | 3 張 | 24 |
| Lv 200 | 18 張 | 4 張 | 14 |

高等窗口塌陷幅度大，但抽查顯示這是正確行為而非 bug。Lv 185 濾除後保留的是蝴蝶幽谷一／二／三層（`drop_exp` 38,615–45,473），即真正的練功區；被剔除的是王、副本與解謎機關：

```
[謎霧之森] 羅煞王       Lv185 hp=27,553,846 drop_exp=1
[謎霧之森] 禁咒羅煞王   Lv187 hp=71,136,000 drop_exp=1
[七星劍塔] 天師道童     Lv180 hp=198,681    drop_exp=1
[七星劍塔] 七星守陣人   Lv183 hp=574,308    drop_exp=1
```

#### 已知邊界與殘餘不確定性

- `drop_exp` 的完整語意（是否為基礎經驗、是否受等差或隊伍影響）**查無**；本功能只用它做 boolean 判準，不顯示數值、不換算效率。
- `drop_exp > 1` 的閾值取 `1` 而非 `0`，因為 audit 觀察到非練功對象一致使用 `1` 作為 placeholder，未見 `0`。實作前應以 targeted read-only query 重新確認是否存在 `drop_exp = 0` 的練功對象。
- 有 265 隻 spawn 的 NPC 不在 `monsters` 表（含 `sestage` 高等水生系列，血量 139 萬–222 萬），因此沒有 `drop_exp` 可判斷，會被 `JOIN monsters` 一併排除。這批是否為真練功目標**查無**；第一版接受此排除，不猜測補回。
- 高等窗口候選數偏少（Lv 185 僅 3 張、Lv 200 僅 4 張）是 database coverage 的事實，UI 不得為了「看起來豐富」而放寬判準。

### 為何使用 `npc.level`

- 現有怪物列表以 `n.level` 篩選與排序（`src/lib/queries/monsters.ts:158-165`、`src/lib/queries/monsters.ts:177-203`）。
- 現有地圖怪物清單也直接回傳 `n.level`（`src/lib/queries/monster-spawns.ts:73-88`）。
- 使用同一欄位可避免候選卡片與點入後的怪物清單顯示不同 level source。

`monsters.level` 與 `npc.level` 是否永遠一致，**Lane A 實測後已查明**：全庫 38 隻 npc/monsters level 不同；收斂到「有 spawn 且 `drop_exp > 1`」後只剩 1 隻——`8778 ？？？樹妖`，`npc.level = 60` 而 `monsters.level = 150`，差 90 級。

**決策（使用者 2026-08-15 核可）：維持 `npc.level` 作為 canonical level，不特例排除、不改用 `monsters.level`。** 理由：與 `/monsters`、`/maps/[id]` 既有顯示一致，避免同一隻怪在不同頁面出現兩種等級；影響面僅 1 隻怪、僅 Lv 55–65 窗口。不得使用 `COALESCE` 靜默混用兩欄。此差異已記錄於此，若日後 audit 發現更多不一致或取得官方語意，再重新評估。

### `min_level_require` 的關係與可信度

`stages.min_level_require` 是 stage row 的獨立欄位；它不是怪物實際等級，也不能由名稱直接證明是目前版本實機強制入場門檻。現有 `StageRow` 甚至尚未暴露此欄位（`src/lib/types/stage.ts:8-31`），現有地圖詳情屬性區也沒有顯示它（`src/app/maps/[id]/page.tsx:58-119`）。

因此第一版：

- query 原樣回傳 `minLevelRequire`；
- **UI 不顯示此欄位**（2026-08-15 Lane A 決策，見下）；
- 不用它排除地圖；
- 不用它改變 `X ± 5` 適配判定；
- 不寫「你一定可以進入」或「未達 N 一定不能進入」。

#### Lane A 實測結果：此欄位零資訊量

實作階段實測 `SELECT DISTINCT min_level_require FROM stages`，全庫 718 筆**全部是 `1`**，無 null、無 0、無其他值。

原 mockup 設計的「資料庫最低進入等級：Lv N（未實測）」若照實顯示，會在每一張卡片重複同一句無資訊的話，與使用者提出的「文字太多」問題同根。

**決策（使用者 2026-08-15 核可）：UI 不顯示此欄位。** query 層仍原樣回傳 `minLevelRequire`，保留欄位以便日後 DB 若出現有意義的值時可直接啟用，不需改動 query contract。

## 等級適配定義

### 第一版規則

對有效玩家等級 `X`：

```ts
levelMin = Math.max(1, X - 5);
levelMax = Math.min(200, X + 5);
```

某 stage 符合候選的充要條件：

```text
至少一筆通過練功對象判準的 spawn，其 npc.level
位於 [levelMin, levelMax] inclusive
```

例如：

- 玩家 Lv 1：窗口為 Lv 1–6。
- 玩家 Lv 80：窗口為 Lv 75–85。
- 玩家 Lv 200：窗口為 Lv 195–200。
- `npc.level = 0`：不屬於任何窗口。

### 為何選 ±5

- 固定窗口最容易讓玩家理解與重現。
- 可由 `npc.level` 與玩家輸入直接驗證，不需要未證實的戰鬥公式。
- 不依賴職業、裝備、技能、組隊、HP、damage、EXP 或掉落。
- 第一版只有一個常數 `TRAINING_LEVEL_RADIUS = 5`，不做 UI 可調參數，避免把尚未經 field-test 的 heuristic 包裝成精密推薦模型。

### 文案限制

頁面必須在輸入區與結果區附近顯示：

> 候選地圖依資料庫中的怪物等級與刷怪點推導：怪物等級落在玩家等級 ±5。這不是官方練功推薦，也不代表實際經驗效率、進入條件或怪物重生狀況。

此規則屬於本專案的衍生方法，不是 official 或 field-test（`docs/plans/guide-content-platform-roadmap.md:54-61`）。

## 排序決策

### 推薦排序

1. `fitPercent DESC`：適配窗口內刷怪點占有效刷怪點的比例。
2. `suitableSpawnPoints DESC`：適配窗口內的資料庫刷怪點數。
3. `averageLevelDistance ASC`：全部有效刷怪點相對玩家等級的平均距離。
4. `stageKind ASC`。
5. `stageId ASC`。

### 理由

- **先看等級集中度。** 一張只有 1 個適配刷怪點、另有大量跨級怪物的地圖，不應只因總 row 數高排在前面。
- **再看適配刷怪點數。** 在集中度相同時，更多適配 spawn rows 是較直接的 database signal。
- **不用「怪物密度」一詞。** 沒有地圖可行走面積、重生時間、同時存在數量或 spawn schedule；`COUNT(*)` 只能稱資料庫刷怪點數。
- **不用經驗值大小排序。** `drop_exp` 只作為練功對象的 boolean 判準。實際效率仍需要擊殺速度、隊伍分配、等差懲罰與重生機制等證據；目前查無完整公式。
- **最後穩定排序。** `(kind, id)` tie-break 讓相同資料輸入得到可重現結果。

### 集中度區分力的驗證紀錄

2026-08-15 audit 曾出現一個誤導性中間結論：在**尚未套用 `drop_exp > 1`** 時查詢 Lv 80，前六名地圖的 `fitPercent` 全部是 100%，看似此指標沒有區分力，一度考慮改以 `suitableSpawnPoints` 為排序主軸。

套用練功對象判準後重查，同一 Lv 80 窗口的 31 張候選地圖集中度分布為：

| 集中度 | 地圖數 |
|---|---|
| 100% | 5 |
| 75–99% | 5 |
| 50–74% | 4 |
| 25–49% | 8 |
| 0–24% | 9 |

先前的「全 100%」是城鎮 NPC 與訓練樁混入候選所造成的假象；濾除後集中度恢復區分力，因此維持 `fitPercent DESC` 為排序主軸。

此紀錄保留在 plan 內，避免後續 reviewer 重複踩同一個推論陷阱。

UI 可把第一項標成「等級集中度」，但旁邊必須顯示：

```text
適配等級刷怪點 ÷ 有效等級刷怪點
```

不得簡寫成「適合度 95%」而不顯示方法。

## 每張地圖卡片

使用既有 shadcn `Card` family（`src/components/ui/card.tsx:5-88`）。

每張卡片顯示：

1. 地圖名稱。
2. 地圖 ID。
3. `stageKind`：`stage` 顯示一般地圖；`sestage` 使用既有 `Badge` 標示「SE 地圖」，沿用地圖詳情頁語意（`src/app/maps/[id]/page.tsx:193-203`）。
4. `groupId`，若為 null 則不顯示。
5. 全部有效怪物等級區間：`Lv monsterLevelMin–monsterLevelMax`。
6. 命中玩家窗口的怪物等級區間：`Lv suitableLevelMin–suitableLevelMax`。
7. 適配怪物種類：`suitableMonsterCount / monsterCount`。
8. 適配刷怪點：`suitableSpawnPoints / spawnPoints`。
9. 等級集中度 `fitPercent`，整頁固定同一格式。
10. `minLevelRequire` 若有值：顯示「資料庫最低進入等級（未實測）」。
11. `unknownLevelSpawnPoints > 0` 時顯示 warning：「另有 N 個刷怪點的怪物等級未知，未計入。」
12. 「查看地圖與怪物」link，導向 `/maps/{stageId}`。

不在卡片顯示：

- 背景圖 thumbnail；
- 完整怪物名稱列表；
- HP、damage、EXP、money、drop item；
- 「推薦」、「最佳」、「高效率」、「人少」、「怪密」等未被資料證明的形容詞。

## Page contract

### Route

Create `src/app/training-spots/page.tsx`。

```ts
interface PageProps {
  searchParams: Promise<{
    level?: string;
  }>;
}
```

頁面設為 dynamic server page，模式參考現有 query-string 驅動的怪物列表（`src/app/monsters/page.tsx:15-32`）。

資料流：

```text
GET /training-spots?level=80
  → await searchParams
  → parseTrainingLevel("80")
  → getTrainingSpots(80)
  → render server-side result cards
  → Link /maps/{stageId}
  → existing map detail queries
```

### Input behavior

- 使用 native GET `<form>`，`action="/training-spots"`。
- 使用既有 `Input`，`type="number"`、`name="level"`、`min=1`、`max=200`、`step=1`、明確 `<label>`。
- 使用既有 `Button` submit。
- URL 沒有 `level` 時：顯示 prompt，不執行 query、不預設玩家是 Lv 1。
- 空值、非數字、小數、`0`、負數、`201+`：顯示繁體中文 validation message，不執行 query。
- valid level 但結果為空：顯示「資料庫中找不到怪物等級位於 Lv A–B 的地圖」，並保留方法與資料限制。
- 第一版不需 `"use client"`、`useEffect`、router mutation 或 debounced request。

### Source block

結果下方固定顯示：

- Source level：`database`。
- Tables/fields：`monster_spawns.stage_kind`、`monster_spawns.stage_id`、`monster_spawns.npc_id`、`stages.kind`、`stages.id`、`stages.name`、`stages.group`、`stages.min_level_require`、`npc.id`、`npc.level`、`monsters.id`。
- Method：玩家等級 ±5、spawn-row weighted concentration。
- Limitation：
  - 不含劇情觸發或腳本生成怪物（`src/app/maps/[id]/page.tsx:247-250`）。
  - 不代表官方推薦、進入保證、重生機制或實際經驗效率。
- `last verified`：implementation release review 時填入實際執行 query/test 的日期。
- 適用遊戲／DB 版本：目前查無可引用的版本 metadata，不得虛構；UI 應明示「資料庫版本未標記」。
- Review trigger：`tthol.sqlite` 更新、level 欄位語意 audit、官方／field-test 發現適配規則衝突時重新檢查。

## 邊界情形

### 1. `level = 0` 怪物

已知例：NPC 6291「謎樣的鬼」，由 2026-08-15 唯讀 audit 觀察到。

處理：

- `level = 0` 不視為真正的 Lv 0 練功怪。
- 不進入 `monsterLevelMin/Max`。
- 不進入適配窗口。
- 不進入 `spawnPoints` 分母。
- 計入 `unknownLevelSpawnPoints`。
- 地圖若只有 level 0／無效等級怪物，不出現在任何玩家等級結果。
- 不補猜其真正等級。

### 2. 劇情用地圖／腳本怪物

現有地圖頁已明示 `GENERATOR.OBD` 清單不含劇情觸發或關卡腳本生成怪物（`src/app/maps/[id]/page.tsx:247-250`）。

第一版：

- 不自動排除「看起來像劇情地圖」的 stage，因為目前查無可信的劇情地圖分類欄位。
- 只要 static `monster_spawns` 有適配怪物，仍可列出。
- 卡片與頁面 disclaimer 明示候選可能包含無法自由進入、只在特定流程出現或與實機不同的地圖。
- 不以 stage 名稱、ID range、group 或 `sestage` 身分猜測可進入性。

### 3. 重複 spawn rows

同一 NPC 在同一 stage 多筆 row：

- `monsterCount`：distinct NPC，只算一種。
- `spawnPoints`：每筆 row 都算一個資料庫刷怪點。
- `fitPercent` 與 `averageLevelDistance`：spawn-row weighted。
- UI 明示「刷怪點」，不寫「怪物數量」。
- 單張地圖既有 query 已採相同 `GROUP BY n.id` + `COUNT(*)` pattern（`src/lib/queries/monster-spawns.ts:77-86`）。

### 4. 無背景圖 stage

`getStageMapImage()` 對無圖 stage 回 `null`（`src/lib/queries/maps.ts:14-29`）。`StageMapViewer` 在沒有 image 與 placement 時直接不渲染（`src/components/maps/stage-map-viewer.tsx:22-35`）。

第一版結果卡不依賴圖片：

- 無圖 stage 仍正常列出。
- 不顯示破圖 placeholder。
- 點入 `/maps/[id]` 後沿用既有 null handling。
- 不為此功能新增 image fallback system。

### 5. `stage` 與 `sestage`

- Query、type、React key 都使用 `(stageKind, stageId)`。
- 卡片明示 SE 地圖。
- 排序最後以 kind、ID 穩定 tie-break。
- Link 可沿用 `/maps/{id}`，因現有型別註解記錄兩種 kind 的 ID 範圍互斥（`src/lib/types/stage.ts:1-6`）。
- 若未來 DB 出現跨 kind 重複 ID，現有 `/maps/[id]` contract 必須先調整；本功能不自行發明第二套 detail route。

### 6. 無名稱 stage

現有 map detail 對無名稱 stage 會 `notFound()`（`src/app/maps/[id]/page.tsx:175-181`）。因此 aggregate SQL 使用 `WHERE s.name IS NOT NULL`，避免產生會導向 404 的候選卡片。

### 7. `min_level_require` 與玩家等級衝突

可能出現：怪物等級適配但 `min_level_require > playerLevel`；怪物等級高於玩家但 `min_level_require` 為 null／0；欄位值與實機不一致。

處理：不排除候選、顯示 raw 欄位與「未實測」標記、不寫「可進入」。若後續有 official 或 field-test 證據再修改。

## 可複用 vs 新寫

| 項目 | 決策 | 證據／說明 |
|---|---|---|
| SQLite connection | **複用** | 繼續使用 `getDb()`（`src/lib/queries/monster-spawns.ts:1-7`） |
| `StageKind` | **複用** | `src/lib/types/stage.ts:1-6` |
| `getMonstersAtStage()` | **複用既有 detail flow，不用於列表聚合** | `src/lib/queries/monster-spawns.ts:73-90`；逐卡呼叫會形成 N+1 |
| `getStageMapImage()` | **複用既有 detail flow，不在列表呼叫** | `src/lib/queries/maps.ts:14-29` |
| `/maps/[id]` | **複用** | `src/app/maps/[id]/page.tsx:175-185` |
| `Card` | **複用** | `src/components/ui/card.tsx:5-88` |
| `Input` | **複用** | `src/components/ui/input.tsx:6-17` |
| `Button` | **複用** | `src/components/ui/button.tsx:43-58` |
| `Badge` | **複用** | `src/app/maps/[id]/page.tsx:193-203` |
| `TRAINING_LEVEL_RADIUS` | **新寫** | 單一透明 heuristic constant，不做設定系統 |
| `parseTrainingLevel()` | **新寫** | GET boundary validation；不默默 clamp 無效玩家輸入 |
| `TrainingSpot` | **新寫** | 現有 spawn types 只描述 monster → stage 與 stage → monster（`src/lib/types/monster-spawn.ts:1-17`） |
| `getTrainingSpots()` | **新寫** | 現有 queries 不支援 level → stage |
| `/training-spots` page | **新寫** | 獨立玩家任務 |
| API route | **不寫** | Server Component 可直接 query DB |
| Client filter component | **不寫** | native GET form 已足夠 |
| CMS／recommendation framework | **不寫** | 超出需求且無必要 |
| 新 dependency | **不寫** | 現有 stack 足夠（`package.json:18-31`） |

## Implementation units

### 1. Data contract and aggregate query

Modify `src/lib/types/monster-spawn.ts`：新增 `TrainingSpot`，複用 `StageKind`，不修改既有 `MonsterStageSpawn`、`StageMonsterSpawn` contract。

Modify `src/lib/queries/monster-spawns.ts`：

- 新增 `TRAINING_LEVEL_RADIUS = 5`、`parseTrainingLevel(value)`、`getTrainingSpots(playerLevel)`。
- 使用單一 aggregate SQL。
- 使用 `JOIN monsters` + `m.drop_exp > 1` 限定練功對象。
- 使用 `npc.level` 與既有頁面保持一致。
- 保留 level 0／無效 level 的 unknown count。
- 明確、穩定排序。
- 不呼叫 `getMonstersAtStage()`，避免 N+1。
- `drop_exp` 只作 boolean 判準；不讀 map image、drop item、money，也不回傳或顯示 EXP 數值。

### 2. Query and rule tests

Create `src/lib/queries/__tests__/monster-spawns.test.ts`，覆蓋 `parseTrainingLevel()`、窗口上下界、query row invariants、duplicate spawn aggregation、level 0 exclusion、deterministic ordering，並保留既有三個 query 的 regression checks。

既有 query tests 直接使用真實 read-only SQLite（`src/lib/queries/__tests__/maps.test.ts:4-42`、`src/lib/queries/__tests__/monsters.test.ts:43-80`）。新測試沿用相同 style，但不依賴不必要的全庫精確總數。

### 3. Server page and UI

Create `src/app/training-spots/page.tsx`：

- metadata title：「練功地圖 · 玄武」。
- description 明示「依資料庫怪物等級尋找候選地圖」。
- native GET form、server-side validation、valid level 才呼叫 query。
- 以 `Card` 呈現結果，每張卡片連到既有 `/maps/[id]`。
- 顯示 method、database source、unknown 與 non-official disclaimer。
- mobile-first 單欄；較寬螢幕可兩欄，卡片本身不得依賴橫向捲動。
- 不新增 client component，除非 mockup 證明 native GET form 無法滿足需求。

### 4. Discoverability

Modify `src/components/layout/navbar.tsx`：在既有「資料庫」群組加入 `{ href: "/training-spots", label: "練功地圖" }`。不新增 nav group；既有 `isActive()` 已支援 exact 與 nested route（`src/components/layout/navbar.tsx:39-45`），同一 `navGroups` 同時供 desktop 與 mobile 使用（`src/components/layout/navbar.tsx:60-67`、`src/components/layout/navbar.tsx:111-127`），只需修改一處。

Optional、僅在 mockup review 確認需要時：在 `src/app/maps/page.tsx` 加入指向 `/training-spots` 的 CTA，不修改 `MapList` filter state。

## Mockup approval gate

依本專案既有工作偏好，implementation 前先提供 desktop/mobile mockup；使用者明確回覆「OK」後才開始修改 implementation files。

Mockup 至少展示：

- 首次進入、尚未輸入等級的狀態；
- valid level 與多張結果卡；
- invalid level validation；
- valid level 但沒有結果；
- 含 `sestage` badge 的卡片；
- 含 `minLevelRequire` warning 的卡片；
- 含 `unknownLevelSpawnPoints` 的卡片；
- 卡片沒有背景圖也能完整使用；
- 「資料庫推導、不是官方推薦」文案在 input 與結果附近可見；
- 手機不需橫向捲動；
- label、focus、submit、result heading 與 links 可由 keyboard／screen reader 使用。

## 測試計畫

### `parseTrainingLevel()`

證明：`"1"` → `1`；`"200"` → `200`；`"80"` → `80`；`undefined`／`""`／空白 → `null`；`"0"`／`"-1"`／`"201"` → `null`；`"80.5"`／`"abc"`／`"NaN"` → `null`；不默默 clamp 無效玩家輸入。

### 適配窗口

證明：Lv 1 使用 `1–6`；Lv 80 使用 `75–85`；Lv 200 使用 `195–200`；bounds inclusive；`TRAINING_LEVEL_RADIUS` 是唯一窗口來源。

若 bounds 計算留在 `getTrainingSpots()` 內，透過 query 結果與獨立 SQL assertion 驗證；不為兩行 arithmetic 建立額外 class 或 framework。

### 每張地圖等級聚合

對至少一個有結果的 player level，證明每個 row：`stageName` 非空；`stageKind` 只能是 `stage` 或 `sestage`；`monsterLevelMin >= 1`；`monsterLevelMax <= 200`；`monsterLevelMin <= monsterLevelMax`；`suitableLevelMin`／`suitableLevelMax` 落在玩家窗口；`suitableMonsterCount <= monsterCount`；`suitableSpawnPoints <= spawnPoints`；`fitPercent` 與 `suitableSpawnPoints / spawnPoints` 一致；`averageLevelDistance >= 0`；至少一個 suitable spawn point。

### 重複 spawn rows

選一個可由 test setup 唯讀找出的 `(stage_kind, stage_id, npc_id)` 重複案例，證明：同 NPC 多筆 row 只增加一次 distinct monster count；每筆 row 都增加 spawn point count；suitable spawn point 分子保留重複 row。

不把當下查到的偶然全庫總數寫成產品 contract；測試只鎖定聚合規則。

### level 0／未知 level

以 NPC 6291 作代表案例前，implementation owner 應先用 read-only targeted query 確認該 row 仍存在。

測試需證明：level 0 不進入 min/max、不進入適配 count、不進入有效 spawn point 分母；level 0 進入 `unknownLevelSpawnPoints`；僅有未知 level 的地圖不會成為候選。

若 NPC 6291 在實作時已不存在，改用 test setup 動態找出 `level <= 0` 且通過練功對象判準的怪物；若全庫查無，保留 pure aggregate fixture test，不偽造 live DB 證據。

### 練功對象判準

證明 `drop_exp > 1` 確實生效：

- `sestage:1958` 檀泉別苑不出現在 Lv 80 候選中（該 stage 全部 4 隻 `drop_exp = 1`）。
- `stage:39` 八門八窟一層仍出現在 Lv 80 候選中。
- 對至少一個有結果的 player level，抽驗回傳 row 所屬 stage 至少有一隻 `drop_exp > 1` 的怪物落在窗口內。
- 訓練樁不進入候選：以 test setup 找出 `drop_exp <= 1` 且 `hp <= 10` 的 spawn 怪物（例如寶箱、少陰木人），證明其所在 stage 不會僅因這些怪而成為候選。
- 判準不得改用 hp 閾值：加入一個 regression assertion，證明存在 `drop_exp = 1` 且 `hp > 100000` 的 spawn 怪物（檀泉別苑案例），確保未來有人改回 hp 判準時測試會失敗。

### 排序

建立縮減 fixture 或以獨立排序 oracle 比對，證明四層排序依序生效：`fitPercent DESC` → `suitableSpawnPoints DESC` → `averageLevelDistance ASC` → `(stageKind, stageId)`。

### Regression

證明 `getStagesForMonster()` 仍按 stage 聚合；`getStagesForMonsters([])` 仍回空 Map；`getMonstersAtStage()` 仍回傳 distinct monster 與 spawn point count。

### Component/page checks

第一版沒有獨立 client component，不為 static Server Component markup 強行建立大型 component test harness。最小可行驗證為 query/rule tests、`typecheck`、production `build`、orchestrator 執行 browser/mobile manual smoke。

若 mockup 核可後抽出 `TrainingSpotCard` 或 client component，才新增對應 component test，覆蓋 accessible link name、SE badge、unknown level warning、`minLevelRequire` 未實測文案，以及不出現「官方推薦／最佳／效率保證」字樣。

## Independently executable work lanes

### Lane A — Data contract and tests

Affected files：`src/lib/types/monster-spawn.ts`、`src/lib/queries/monster-spawns.ts`、`src/lib/queries/__tests__/monster-spawns.test.ts`

可獨立完成 type、validation、aggregate SQL、sorting、level 0／duplicate handling 與 query regression tests。不依賴 UI；是其他 lanes 的 contract dependency。

### Lane B — Page/UI

Affected files：`src/app/training-spots/page.tsx`

依賴 Lane A 的 `TrainingSpot` 與 query signature。若平行開工，可先用 matching local fixture shape render，但 merge 前必須移除 fixture 並接上真實 server query。

### Lane C — Discoverability and editorial review

Affected files：`src/components/layout/navbar.tsx`；conditional：`src/app/maps/page.tsx`

可與 Lane A 平行。Editorial review 可獨立檢查 database source label、method、uncertainty、`last verified`、禁用誤導用語與 mobile empty/error states。

### Dependency order

1. 核可本 plan 的 scope、±5 規則與排序。
2. 完成並核可 desktop/mobile mockup。
3. Lane A：先固定 type、SQL contract 與 tests。
4. Lane B：接上已固定 query contract。
5. Lane C：加入 navigation 並執行 editorial checklist。
6. 執行 targeted tests、typecheck、build。
7. 執行 browser/mobile/a11y manual smoke。
8. 核對 SQLite unchanged、dependency unchanged 與 acceptance checklist。

## 驗收條件

### Route 與輸入

- [ ] `/training-spots` 可直接開啟。
- [ ] desktop 與 mobile navigation 都有「練功地圖」入口，且由同一 `navGroups` item 產生。
- [ ] 頁面使用 GET query string；`/training-spots?level=80` 可重新整理與分享。
- [ ] 等級輸入有可見 label，使用 native number input，範圍 `1–200`、step `1`。
- [ ] 未輸入等級時不擅自預設 Lv 1。
- [ ] `0`、負數、`201+`、小數與非數字不執行 query，顯示清楚的繁體中文錯誤。

### Query contract

- [ ] 新增 `getTrainingSpots(playerLevel)`，位於 `src/lib/queries/monster-spawns.ts`。
- [ ] 新增 `TrainingSpot`，位於 `src/lib/types/monster-spawn.ts`。
- [ ] query 使用 `(stage_kind, stage_id)` join `stages.(kind, id)`。
- [ ] query 使用 `JOIN monsters` + `m.drop_exp > 1` 限定練功對象。
- [ ] `sestage:1958` 檀泉別苑（城鎮 NPC，`drop_exp = 1`）不出現在 Lv 80 候選中。
- [ ] 判準不使用 hp 或 type 閾值；`drop_exp` 只作 boolean 判準，不顯示 EXP 數值。
- [ ] level 使用 `npc.level`，與現有怪物列表／地圖怪物顯示一致。
- [ ] 怪物等級區間由有效 spawn rows 的 `MIN/MAX(npc.level)` 聚合。
- [ ] 地圖符合條件的規則固定為玩家等級 ±5、inclusive、clamp 到 `1–200`。
- [ ] 同 NPC 重複 spawn rows 只算一種怪物，但每筆保留為刷怪點。
- [ ] level 0／無效 level 不參與適配、區間與有效分母，另計入 unknown count。
- [ ] 無名稱 stage 不出現在結果。
- [ ] query 是單一 aggregate query；沒有逐 stage 的 `getMonstersAtStage()` N+1。

### 排序與卡片

- [ ] 先按等級集中度 descending。
- [ ] 再按適配刷怪點數 descending。
- [ ] 再按平均 level distance ascending。
- [ ] 最後以 kind、ID 穩定 tie-break。
- [ ] 卡片顯示地圖名稱、ID、kind、group、整體等級區間、命中區間、怪物種類數、刷怪點數與等級集中度。
- [ ] `sestage` 清楚標示「SE 地圖」。
- [ ] `unknownLevelSpawnPoints > 0` 時顯示 warning。
- [ ] `minLevelRequire` 顯示為 database raw field 並標示「未實測」，不作適配或排除依據。
- [ ] 每張卡片可前往既有 `/maps/[id]`。
- [ ] 無背景圖的 stage 仍可完整使用卡片，不出現破圖。

### Editorial

- [ ] 頁面明示 source level 是 `database`。
- [ ] 頁面列出使用的 tables/fields 與 ±5 方法。
- [ ] 頁面明示結果不是官方推薦、進入保證或經驗效率排名。
- [ ] 頁面不把 spawn row 數稱為實際怪物數或怪物密度。
- [ ] 頁面不顯示無公式支持的 EXP/hour、掉寶期望值或百分比。
- [ ] 頁面明示 static spawn data 不含劇情／腳本生成怪物。
- [ ] database／遊戲版本查無時明示未知，不虛構版本。
- [ ] release review 填入真實 `last verified` 日期與 review trigger。
- [ ] user-facing text 使用繁體中文。

### UI／Architecture

- [ ] 使用既有 `Card`、`Input`、`Button`、`Badge`，不重造對應 primitive。
- [ ] 第一版沒有 API route。
- [ ] 第一版沒有 client-side fetch。
- [ ] 第一版沒有新 dependency。
- [ ] 第一版沒有 CMS、recommendation framework、pagination 或 route planner。
- [ ] `tthol.sqlite` 內容與 schema unchanged。
- [ ] mobile 不需橫向捲動即可輸入等級、閱讀主要指標與前往地圖。
- [ ] keyboard focus、form label、validation message、result heading 與 links 可辨識。

### Validation truthfulness

- [ ] Query tests、typecheck、build 與 manual smoke 各自記錄實際執行結果。
- [ ] 未執行的 browser/mobile/field-test 不得寫成已通過。
- [ ] Unit test 通過不得改寫成「±5 已被實機證明是最佳練功範圍」。
- [ ] Reviewer 至少抽查一個一般正例、一個 level 0／unknown edge case、一個 `sestage` 或疑似劇情地圖案例；未執行就標記尚未執行。

## 風險與處理

| 風險／不確定處 | 可能誤導 | 最小處理 |
|---|---|---|
| `npc.level` 與 `monsters.level` 可能不一致 | 同一怪物可能有兩個 level 值 | 第一版沿用現有 UI 的 `npc.level`；實作前後以 read-only audit 列差異，未查證前不混用 |
| ±5 沒有 official／field-test 證據 | 玩家把 heuristic 當官方推薦 | 將規則直接顯示，標示 database-driven 推導；不用「最佳」 |
| `min_level_require` 語意未驗證 | 玩家誤以為一定能／不能進入 | 不參與 filter/rank；raw value 標「未實測」 |
| spawn row 不等於實機同時存在怪物 | 玩家把 row 數當怪物數或密度 | 只稱「資料庫刷怪點」，顯示資料來源 |
| 缺少 respawn、map area、kill speed | 集中度被誤解成經驗效率 | 不顯示 EXP/hour，不稱效率排名 |
| level 0 可能是 placeholder、腳本怪或特殊 entity | 被錯誤推薦給低等玩家 | 排除適配與區間，計入 unknown warning |
| 劇情／副本 stage 沒有可信分類 | 候選地圖可能無法自由進入 | 不猜測排除；顯示進入條件未知 disclaimer |
| `sestage` 可能有不同生命週期／進入方式 | 與一般地圖混淆 | 保留 kind、顯示 SE badge，不宣稱可自由進入 |
| static `monster_spawns` 不含腳本生成 | 結果遺漏實機怪物 | 明示 coverage 邊界，不能稱完整 |
| 無名稱 stage 會導向 404 | 不可操作結果 | SQL 排除 `s.name IS NULL` |
| 無背景圖 stage 很多 | 卡片出現大量破圖或 N+1 | 第一版不載縮圖；detail 沿用既有 null handling |
| `fitPercent` 看似官方分數 | 玩家過度信任數字 | 標為「等級集中度」，緊鄰顯示分子／分母與公式 |
| DB 更新改變排序 | 分享的結果日後不同 | 顯示 database source、last verified、review trigger；不承諾永久排序 |
| 一次回傳結果過多 | mobile page 過長 | 先觀察單一 ±5 窗口實際量；沒有證據前不加 pagination |
| UI 文案與 data source 混層 | database row 被誤稱官方保證 | 依 source ladder 與 editorial checklist review（`docs/plans/guide-content-platform-roadmap.md:41-52`、`docs/plans/guide-content-platform-roadmap.md:63-77`） |

## Compatibility concerns

- `MonsterStageSpawn` 與 `StageMonsterSpawn` 是既有 public types；新增 `TrainingSpot`，不修改其欄位（`src/lib/types/monster-spawn.ts:3-17`）。
- `getStagesForMonster()`、`getStagesForMonsters()`、`getMonstersAtStage()` signature 不變（`src/lib/queries/monster-spawns.ts:5-90`）。
- `/maps` 與 `/maps/[id]` route 不變。
- `/maps/[id]` 目前只接受 numeric ID 並以 `getStageDetail(id)` 查詢（`src/app/maps/[id]/page.tsx:175-181`）；本功能依現有 stage/sestage ID 互斥假設產生 link。
- Navigation 增加 item 會同時影響 desktop dropdown 與 mobile drawer，但不改 active-route algorithm（`src/components/layout/navbar.tsx:39-45`）。
- 新頁 query-string contract 只有 `level`；未知 params 忽略，不建立複雜 serializer。
- 不新增 DB index。18,253-row aggregate 對第一版規模應先以實際 timing 驗證；未量測前不能宣稱 performance 已足夠，也不先修改 schema 或建立 cache。

## 實作順序

1. Orchestrator 核對本 plan 的 route、±5、SQL contract、排序與 disclaimer。
2. 產出 desktop/mobile mockup。
3. 等待使用者明確 OK；未 OK 前不修改 implementation files。
4. 新增 `TrainingSpot` type、validation 與 aggregate query。
5. 新增 targeted query/rule tests，先固定 level 0、duplicate rows 與排序語意。
6. 新增 `/training-spots` Server Component 與 GET form。
7. 加入 navbar item。
8. 依需要而非預留，決定是否在 `/maps` 增加 CTA。
9. 執行 targeted tests、typecheck、build。
10. 執行 browser/mobile/keyboard smoke 與 editorial checklist。
11. 核對 dependency、SQLite、route 與 source wording 未超出 scope。
12. 由 orchestrator 記錄實際 validation 結果；本 plan 不預先宣稱任何驗證通過。

## 驗證 commands

```bash
npm test -- src/lib/queries/__tests__/monster-spawns.test.ts
npm test -- src/lib/queries/__tests__/maps.test.ts src/lib/queries/__tests__/monsters.test.ts
npm run typecheck
npm run build
npm run lint
git diff --check
git diff --stat
```

`npm run lint` 若遇到 repository 既有工具相容性問題，必須如實記錄 blocked 原因，不可改寫成 code pass（`docs/plans/guide-content-platform-roadmap.md:226-243`）。

## Validation log

本節記錄實際執行結果。未執行的項目不得改寫成通過。

| 日期 | 驗證 | 結果 | Owner |
|---|---|---|---|
| 2026-08-15 | Lane A targeted tests（`monster-spawns.test.ts`） | **41 passed** | deep-fixer |
| 2026-08-15 | Lane A mutation check（`drop_exp>1`→`>0`、去重失效、`RADIUS`5→4、分母改 `COUNT(*)`） | **前三項各觸發 10/5/5 failures；第四項初版 0 failures，補 in-memory fixture 後 1 failure** | deep-fixer |
| 2026-08-15 | 全套 test suite（Lane A 後） | **43 files / 555 passed** | deep-fixer |
| 2026-08-15 | 全套 test suite（Lane B 後） | **43 files / 555 passed** | designer |
| 2026-08-15 | 全套 test suite（Lane C 後，orchestrator 複跑） | **43 files / 555 passed** | orchestrator |
| 2026-08-15 | `npm run typecheck`（三次，各 lane 後） | **passed，無輸出** | deep-fixer / designer / orchestrator |
| 2026-08-15 | `npm run build` | **passed；`/training-spots` 登記為 `ƒ (Dynamic)`** | designer / orchestrator |
| 2026-08-15 | `npm run lint` | **blocked：ESLint 10.2.1 載入 `react/display-name` 時 crash 於 `eslint.config.mjs`；repo 既有問題，非本功能 code failure，未修 package** | deep-fixer / designer |
| 2026-08-15 | Prettier check（本次異動檔） | **passed** | deep-fixer / designer |
| 2026-08-15 | Browser smoke 375×812（初始／80／10／250／200） | **五種狀態 `scrollWidth === clientWidth === 375`，超出視窗元素清單為空陣列** | designer |
| 2026-08-15 | 立繪尺寸統一（CDP 量測 226 張圖 box） | **全部為 `56x64` 單一值；原圖 40×77–214×226 皆未變形** | designer |
| 2026-08-15 | 立繪 fallback（八門八窟一層 ●幽靈刺客） | **虛線框 + ghost icon，與相鄰格齊平，等級 chip 與名稱照常顯示** | designer |
| 2026-08-15 | SE badge（`sestage:1861 湖岸`） | **已顯示** | designer |
| 2026-08-15 | Keyboard smoke | **tab 序達 input → submit；Enter 送出後 URL 變 `?level=80` 並渲染 31 張卡** | designer |
| 2026-08-15 | 文案硬規掃描（rendered HTML + source grep） | **「怪物數量／怪物密度／最佳／高效率／怪很密／人少／EXP／最低進入等級／未實測」0 筆；「推薦」僅 1 處為允許的否定句；無裸百分比** | designer / orchestrator |
| 2026-08-15 | `tthol.sqlite` 未變動 | **md5 `e53e15d3c84a4509abbd70b65c90aa01`，mtime 仍為 Jul 29** | deep-fixer |
| 2026-08-15 | Field-test（±5 是否為實機最佳範圍） | **尚未執行，且不在本功能 scope** | — |

### 目前資料下無法手動驗證的兩個狀態

以下兩項已依 plan 實作並通過 code review，但**在現行 `tthol.sqlite` 上無法於瀏覽器重現**。記錄於此以免後續 reviewer 誤判為未實作：

1. **`unknownLevelSpawnPoints` warning。** 實測通過 `drop_exp > 1` 且 `npc.level` 越界的 spawn row 數為 **0**（越界怪先被 `JOIN monsters` 擋掉）。Lane A 以 in-memory SQLite fixture 覆蓋此邏輯。
2. **「有效等級但無結果」空狀態。** 掃描 Lv 1–200 全部 200 個等級，**沒有任何等級回傳空陣列**（最少為 Lv 200 的 4 張）。原 mockup frame C 以 Lv 200 當無結果範例，與真實資料不符。

## Deferred（實作後取得的需求證據）

- **結果量上限／pagination：** plan 原訂「先以實際結果量驗證需求」。現有數字：最長為 **Lv 10 的 95 張卡、226 張立繪**，375 寬下 `scrollHeight` 約 40,000px。立繪已有 `loading="lazy"`，首屏不受影響。是否加上限或分頁待決。
- **集中度排序的直覺落差：** Lv 80 第 5 名木人巷 6 個刷怪點（100%）排在杭州渡口 77 個（81%）之前。符合已核可的排序決策，非 bug；若日後收到玩家困惑回饋，根因在排序權重而非文案。
- **卡片兩組 `N/M` 比值語意不同：** 「適配刷怪點 50/50」與「怪物種類 5/5」格式相同易誤讀，目前以字級與標籤區分。若需更保險可將種類數併入立繪帶 caption。

## 假設與殘餘不確定性

- 假設 2026-08-15 audit 的 row counts、columns 與 joins 在 implementation 時仍成立。
- 假設 `/maps/[id]` 的 stage/sestage ID 互斥仍成立；repository 目前只以型別註解記錄此事（`src/lib/types/stage.ts:1-6`）。
- `npc.level` 與 `monsters.level` 是否一致：查無。
- `stages.min_level_require` 的實機語意、0/null 語意與版本有效性：查無。
- 哪些 stage 是劇情、副本、限時或不可自由進入：查無可信分類。
- spawn row 是否代表固定同時生成數、生成點、生成群組或其他 generator record：除既有 UI 稱「刷怪點」外，完整 runtime 語意查無（`src/components/maps/stage-monster-spawns.tsx:14-18`）。
- 怪物 level 與玩家 EXP 懲罰／加成公式：查無。
- `drop_exp` 是否足以直接計算玩家實得 EXP：查無。本功能只用它做 boolean 判準。
- `drop_exp` 的完整語意（基礎經驗？是否受等差／隊伍影響？）：查無。
- 是否存在 `drop_exp = 0` 的真練功對象：audit 未見，但未窮舉；實作前應以 targeted read-only query 重新確認閾值取 `> 1` 是否仍正確。
- 265 隻 spawn 的 NPC 不在 `monsters` 表（含 `sestage` 高等水生系列，血量 139 萬–222 萬），無 `drop_exp` 可判斷而被一併排除；這批是否為真練功目標：查無。
- 高等窗口候選數偏少（Lv 185 僅 3 張、Lv 200 僅 4 張）為 database coverage 事實；是否代表遊戲實際情況：查無。
- DB 適用遊戲版本與擷取日期：查無。
- 本文件是唯讀 implementation plan；尚未執行 query、tests、build、browser smoke 或 field-test，任何項目均不得視為已驗證。

## Mockup approval record

- 尚未核可。Open Design mockup run `028675b0-9aed-4f20-b976-ffa34d431f98`（project `genbu-training-spots`）於 2026-08-15 啟動，待使用者 review。
