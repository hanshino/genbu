---
title: 屬性導向真元／魂石強化查詢 implementation plan
created: 2026-08-15
status: proposed
route: /tools/enhance
---

# 屬性導向強化查詢（`/tools/enhance`）

## 目標

玩家的問題是：**「我要加物攻，該用哪顆真元？大概要幾顆？」**

現況沒有從屬性出發的入口：

- 裝備詳情頁的「可用強化」是 `裝備槽位 → 配方`（`src/components/items/equipment-enhancements-section.tsx:53`）。
- `/compounds` 是 `配方群組 → 配方`（`src/app/compounds/page.tsx:20`）。

兩者都無法回答「這個屬性有哪些選擇」，也看不到「魂石完全給不了物攻」這種跨群組結論。

## 已核可的決策

1. 新開 `/tools/enhance`，navbar 放進工具入口。**不動** `/compounds`、`/compounds/[id]`、裝備詳情頁。
2. 期望值以**消耗材料顆數**為主指標，不是金錢。理由見下方「為何不是金錢」。
3. 家族採**四分類**：真元、魂珠、魂石、其他。
4. 實作前先由 designer 出 mockup 並經使用者核可。本文件只定義資訊架構與必須呈現的資料，**不規定視覺**。

---

## DB 事實（唯讀驗證，`compounds` 表 `type='ITEM_COMPOUND_EQUIPMENT'`，共 1,026 筆）

### 抽獎機制

- `mod_count_min` / `mod_count_max` 全 1,026 筆皆為 `1`／`1`。
- 1,026 筆**全部**含 `type="0"` 空轉分支，無例外。
- 全部 1,026 筆的 `mod_prob` 條目機率（含空轉）**恰好加總為 1,000,000**，0 筆例外。
- 因此 `prob` 是單次 roll 的實際機率，非「成功時的條件機率」。單位為百萬分之一。
- `material_items` 與 `mod_prob` JSON 解析 0 筆失敗。

### 級距合併（本功能最關鍵的實作要求）

同一條配方會把**同一個屬性**拆成多個級距條目。

`吉魂珠強化`（id 10742）的 `mod_prob` 實際內容：

```json
[{"type":"ITEM_BONUS_ATK","min":10,"max":15,"prob":250000},
 {"type":"ITEM_BONUS_ATK","min":15,"max":20,"prob":200000},
 {"type":"ITEM_BONUS_ATK","min":20,"max":25,"prob":150000},
 {"type":"ITEM_BONUS_ATK","min":25,"max":30,"prob":100000},
 {"type":"0","min":0,"max":0,"prob":300000}]
```

**不合併會顯示「+10~15，25%」— 這是錯的答案。** 正確是「+10~30，70%」。

分布：

| 形態 | 筆數 |
|---|---:|
| 單一屬性單一級距 | 880 |
| **同屬性多級距（需合併）** | **143** |
| 多種不同屬性 | 3 |

那 3 筆多屬性配方是 `愛珀/信珀/義珀魂珠強化`（id 10795–10797），皆為 `MDEF + DEF`。

合併安全性已驗證：**合併後機率超過 100% 的有 0 筆**（375 筆恰為 100%，654 筆低於 100%）。

合併前後的實際差異（ATK）：

| 配方 | 不合併（錯） | 合併（對） |
|---|---|---|
| 義劭魂珠強化 | +30~50 @15% → 6.7 顆 | **+30~140 @50% → 2.0 顆** |
| 和劭魂珠強化 | +25~50 @50% → 2.0 顆 | **+25~115 @90% → 1.1 顆** |

### 每個屬性的**配方數**（已去除級距重複計算）

先前一版盤點誤將 mod 條目數當配方數，全數偏高。以下為正確的 distinct recipe 數：

| bonus_type | 配方數 | (條目數) | 加值範圍 | 槽位 |
|---|---:|---:|---|---|
| ITEM_BONUS_DEF | 91 | 142 | 4~150 | 帽,衣盾,飾 |
| ITEM_BONUS_HIT | 86 | 105 | 1~120 | 武,帽,飾 |
| ITEM_BONUS_MDEF | 67 | 108 | 5~100 | 帽,衣盾,飾 |
| ITEM_BONUS_POW | 65 | 82 | 1~20 | 武,衣盾,飾 |
| ITEM_BONUS_DEX | 65 | 77 | 1~18 | 武,帽,飾 |
| ITEM_BONUS_WIS | 65 | 78 | 1~20 | 武,帽,鞋,飾 |
| ITEM_BONUS_ATK | 60 | 94 | 4~800 | 武,飾 |
| ITEM_BONUS_VIT | 60 | 76 | 1~18 | 武,衣盾,鞋,飾 |
| ITEM_BONUS_DODGE | 59 | 87 | 1~120 | 鞋,飾 |
| ITEM_BONUS_MATK | 57 | 91 | 5~800 | 武,衣盾,飾 |
| ITEM_BONUS_MP | 57 | 115 | 15~800 | 帽,衣盾 |
| ITEM_BONUS_AGI | 56 | 62 | 1~18 | 武,鞋,飾 |
| ITEM_BONUS_UNCANNYDODGE | 53 | 53 | 1~14 | 鞋,飾 |
| ITEM_BONUS_CRITICAL | 51 | 60 | 1~18 | 武,飾 |
| ITEM_BONUS_STR | 45 | 56 | 1~20 | 武,衣盾,飾 |
| ITEM_BONUS_HP | 42 | 72 | 50~3500 | 衣盾,鞋 |
| ITEM_BONUS_EARTH_DEF | 16 | 16 | 5~20 | 衣盾 |
| ITEM_BONUS_FIRE_DEF | 12 | 12 | 5~30 | 衣盾 |
| ITEM_BONUS_LIGHTNING_DEF | 12 | 12 | 6~30 | 衣盾 |
| ITEM_BONUS_WATER_DEF | 10 | 10 | 3~18 | 衣盾 |

**表中「配方數」是驗收與測試的基準，「條目數」僅供對照，不得寫進斷言。**

### 家族四分類

依配方 `name` 關鍵字判定，**不可用 `group` range**：

| 家族 | 筆數 | 所在 group |
|---|---:|---|
| 真元 | 502 | 70–110 |
| 魂石 | 240 | 2–6 |
| 其他 | 180 | 70–110 |
| 魂珠 | 104 | **70–110（混在真元群組內）** |

「其他」是早期的「◯◯強化裝備」（如 `波波鼠強化裝備`、`綿羊強化裝備`），既非真元也非魂珠命名。

用 `group` 二分會把 104 筆魂珠與 180 筆「其他」全部誤標為真元。

### 魂石的能力缺口

| 屬性 | 真元 | 魂珠 | 其他 | 魂石 |
|---|---:|---:|---:|---:|
| ATK 物攻 | 37 | 8 | 15 | **0** |
| MATK 內勁 | — | — | — | **0** |
| MDEF 護勁 | — | — | — | **0** |

玩家問「加物攻用什麼」時，第一層答案就是**魂石辦不到**。此結論必須在 UI 明確呈現，不得因為結果為 0 就隱藏該區塊。

### 材料與金錢

- `material_core_id` 與配方 **1:1**（1,026 對 1,026，無 NULL）。「哪一顆真元」等同「哪一條配方」。
- `material_core_amount` **全 1,026 筆皆為 `1`**，無 NULL、無 0。
- `money` 有 **324 筆為 NULL**（31.6%），702 筆為正值。

### 毀裝

`equip_crash = 1`：魂石 218/240，真元系 104/786。此欄位只是 boolean，**不得由它推導毀裝機率、保護機制或損失價值**。

---

## 為何主指標是消耗顆數而非金錢

使用者明確指出：玩家的成本考量是「要花幾顆真元」，遊戲金錢是小事。

資料也支持這個選擇：

| | 期望顆數 | 期望金錢 |
|---|---|---|
| 公式 | `material_core_amount ÷ 合併機率` | `money ÷ 合併機率` |
| 可計算筆數 | **1,026 / 1,026（100%）** | 702 / 1,026（68.4%） |
| 缺漏處理 | 不需要 | 324 筆需顯示「查無」 |

因 `material_core_amount` 恆為 1，實際公式簡化為 **`1 ÷ 合併機率`**。實作仍應讀該欄位而非寫死 1，避免日後資料變動時默默算錯。

金錢降為次要欄位：有值就顯示單次金錢，NULL 顯示「查無」。**不計算期望金錢**，避免在三成資料缺漏的情況下產生誤導性推導值。

---

## 必讀的既有程式碼

| 路徑 | 關注點 |
|---|---|
| `src/lib/queries/compound.ts:211-223` | `ENRICHED_COMPOUND_SELECT` / `ENRICHED_COMPOUND_FROM`，直接複用 |
| `src/lib/queries/compound.ts:229-326` | `enrichCompoundRows()`，已批次查 item 名稱、已排除 `type="0"` 與零機率、`CompoundOutput.rawType` 保留原始 `ITEM_BONUS_*` |
| `src/lib/queries/compound.ts:486-511` | `getEquipmentEnhancementsForItemType()`，槽位 JSON 比對規則的來源 |
| `src/lib/queries/compound.ts:128-155` | `BONUS_TO_ATTR_KEY` 與 `bonusLabel()`，20 種屬性對照 |
| `src/lib/constants/i18n.ts:10-29` | `itemAttributeNames`，**已確認 20/20 全覆蓋，無缺漏** |
| `src/lib/constants/compound.ts:21-30` | `isCompoundPlayerLevel()`，等級顯示唯一判準（PR #32） |
| `src/app/training-spots/page.tsx` | Server Component + GET query string 的既有範式 |
| `src/lib/queries/__tests__/monster-spawns.test.ts:508-526` | N+1 guard 的既有寫法（直接 patch `db.prepare` 計數） |
| `src/components/layout/navbar.tsx:15-68,131-143` | `/tools` 目前是 standalone link，不是 navGroup |
| `src/app/tools/page.tsx:4-36` | hub 目前文案限定「副本解謎工具」 |

### 可複用 vs 不可複用

**複用：** `ENRICHED_COMPOUND_SELECT`、`ENRICHED_COMPOUND_FROM`、`enrichCompoundRows`、`CompoundUse`、`CompoundOutput.rawType`、`EquipmentSlotKind`、槽位 JSON 比對方式、`isCompoundPlayerLevel`。

**不可直接呼叫 `getEquipmentEnhancementsForItemType()`：** 它的方向是 `itemType → slot → 配方`，與本功能相反；逐槽呼叫會變成五次 query 還要去重。新增 sibling query，不修改該函式。

**不可複用 `bucketByBonus()` 與 `EnhancementsList`：** 兩者都假設 `outputs[0]` 是主屬性（`equipment-enhancements-section.tsx:18`、`enhancements-list.tsx:41-53,113-153`）。本功能必須依 `rawType` 精確取出使用者選定的屬性，且必須合併同屬性級距。第一版**不要**為了共用而抽象化既有元件——那會改動裝備詳情頁的既有行為，違反「不動既有頁面」的決策。

---

## Query 層設計

### 契約

在 `src/lib/queries/compound.ts` 新增：

```ts
export type EnhancementFamily = "all" | "yuan" | "pearl" | "stone" | "other";

export interface EnhancementSearch {
  bonusType: string;
  family: EnhancementFamily;
  slot: EquipmentSlotKind | null;
}

/** 合併後的目標屬性結果 */
export interface MergedBonus {
  rawType: string;
  label: string;
  min: number;        // 所有級距的最小值
  max: number;        // 所有級距的最大值
  prob: number;       // 各級距機率總和（百萬分制）
  segments: number;   // 級距數，供 UI 標示「分 N 段」
}

export interface EnhancementResult {
  use: CompoundUse;
  target: MergedBonus;
  family: Exclude<EnhancementFamily, "all">;
  expectedMaterials: number;  // material_core_amount ÷ (prob / 1e6)
}

export function getEnhancementsByBonus(search: EnhancementSearch): EnhancementResult[];
```

### 家族判定

```ts
function enhancementFamily(name: string): Exclude<EnhancementFamily, "all"> {
  if (name.includes("魂石")) return "stone";
  if (name.includes("魂珠")) return "pearl";
  if (name.includes("真元")) return "yuan";
  return "other";
}
```

判定順序不可調換：魂石與魂珠都含「魂」，必須先比完整詞。此函式須 export 供測試直接驗證。

因家族來自 `name` 而非 `group`，family filter **無法下推到 SQL**，於 TypeScript 端過濾。1,026 筆的規模下可接受。

### SQL

```sql
SELECT ${ENRICHED_COMPOUND_SELECT}
FROM ${ENRICHED_COMPOUND_FROM}
WHERE c.type = 'ITEM_COMPOUND_EQUIPMENT'
  AND c.mod_prob LIKE ?
  -- slot 非 null 時追加：
  AND c.material_items = ?
ORDER BY c.id
```

LIKE pattern：`%"type":"${bonusType}",%`，與既有 `getCompoundSourcesForItem()`（`compound.ts:521-538`）的預過濾策略一致。

**LIKE 只是預過濾，不是 JSON parser。** 取回後必須以解析結果二次驗證，只保留確實含該 `rawType` 且合併機率 > 0 的配方。

### 合併實作

```ts
function mergeBonus(outputs: CompoundOutput[], rawType: string): MergedBonus | null {
  const segs = outputs.filter(o => o.kind === "bonus" && o.rawType === rawType && o.prob > 0);
  if (segs.length === 0) return null;
  return {
    rawType,
    label: segs[0].label,
    min: Math.min(...segs.map(s => s.min)),
    max: Math.max(...segs.map(s => s.max)),
    prob: segs.reduce((sum, s) => sum + s.prob, 0),
    segments: segs.length,
  };
}
```

合併機率理論上限為 1,000,000。已驗證現行資料 0 筆超出，但仍應 clamp 並在超出時視為資料異常（不 throw，取 1,000,000），避免期望顆數小於 1。

### JSON 欄位無索引的取捨

`mod_prob` 是 JSON 字串，無反向索引。採 **LIKE 預過濾 + TypeScript 精確驗證**：

- 資料量固定 1,026 筆，屬小資料。
- LIKE 可減少送進 `JSON.parse()` 的 row 數。
- 不依賴 SQLite JSON1 extension，不動唯讀 DB。

**明確不做：** 建立衍生索引表、generated column、cache layer、`json_each()` 改寫。資料規模不構成理由。

### Query 數量

| 步驟 | query 數 |
|---|---|
| 配方查詢 | 1 |
| `enrichCompoundRows()` 批次補 item 名稱 | 0–1（EQUIPMENT 類的副材料是槽位、outputs 是 bonus，主材料與失敗回收已由 JOIN 取得，正常為 0） |
| `getItemIconMap()` | 1（零結果時 0） |

**結果頁固定 2 queries，零結果 1 query，且不隨結果筆數成長。** 最大結果集為 DEF 的 91 筆，遠低於 `images.ts:9-15` 的 900 IDs chunk 上限。

禁止：逐配方查詢、逐材料呼叫 `getItemIcon()`、逐槽位呼叫既有 query、為 summary 另外呼叫 `getAllCompoundGroupsWithStats()`。summary 一律由已取得結果聚合。

---

## 型別放置

**不新增 `src/lib/types/enhancement.ts`。** 上述型別放在 `compound.ts`，與既有 `CompoundUse`、`CompoundOutput` 同檔。

理由：主體資料已由 `CompoundUse` 表示；`MergedBonus` 與 `EnhancementResult` 是本 query 的產物，只有一個實作，沒有跨模組重用需求。建立平行 DTO 或 repository interface 屬於推測性架構。

---

## URL 與狀態

沿用 `/training-spots` 的 Server Component + GET form 範式（可分享、可重新整理，無 client fetch，不新增 API route）。

| 參數 | 合法值 | 預設 |
|---|---|---|
| `attribute` | 20 種 `ITEM_BONUS_*` | `ITEM_BONUS_ATK` |
| `family` | `all` / `yuan` / `pearl` / `stone` / `other` | `all` |
| `slot` | `all` / `1`~`5` | `all` |
| `sort` | `bonus` / `probability` / `materials` | `bonus` |

範例：`/tools/enhance?attribute=ITEM_BONUS_ATK&family=all&slot=all&sort=bonus`

預設 ATK 讓首次開啟即回答目標問題，並立即呈現「魂石 0 筆」。

### Validation

新增 `parseEnhancementSearchParams()`（放 `compound.ts` 以便單元測試）：

- 缺值或空字串 → 預設值。
- 不接受重複參數形成的 array。
- `attribute` 必須命中 20 種清單；`family`、`sort` 必須是 union 值；`slot` 只接受 `all` 或 `1`–`5`（不接受 `01`、小數、`0`、`6`）。
- 不做大小寫修正、模糊比對或未知值靜默 fallback。
- 任一值無效 → 顯示繁體中文錯誤、保留原始輸入供辨識、**不執行任何 DB query**、回傳正常頁面（非 `notFound()`，這是表單輸入錯誤不是路由不存在）。

---

## 期望消耗顆數

### 定義

```ts
probability = target.prob / 1_000_000;              // 合併後
expectedMaterials = use.coreMaterial.amount / probability;
```

因 `material_core_amount` 恆為 1，實際等於 `1 / probability`。**仍須讀欄位，不得寫死 1。**

### 顯示與排序

- 顯示：四捨五入到小數一位（`Math.round(x * 10) / 10`）。
- 排序：使用未格式化的原始值，避免顯示同值時排序反轉。

### 邊界

| 情況 | 處理 |
|---|---|
| `prob = 1,000,000`（100%） | `expectedMaterials = amount`，即 1 顆。不做特殊加成 |
| `prob <= 0` | query 已排除；防禦性計算回傳 `null`，不得除以零或顯示 `Infinity` |
| `amount` 為 null 或非有限值 | 回傳 `null`，顯示「查無」，**不得當成 0** |
| 同屬性多級距 | 先合併再計算，不得用單一級距機率 |
| 多種不同屬性（3 筆） | 只用與 selected attribute 相符的合併結果，不加總其他屬性機率 |

### 必須傳達的語意（文案由 designer 與 orchestrator 決定，不在此寫死）

1. 期望顆數是本站依單次機率推導的估算，非遊戲原始欄位。
2. 是統計期望值，不代表該顆數內必定成功。
3. 未計入毀裝造成的裝備損失。
4. 未計入材料本身的取得難度或市場價值。
5. 機率是單次嘗試出現該屬性的實際機率，**不是**排除空轉後的條件機率。

第 5 點特別重要：`/compounds/[id]` 目前寫「產出機率為單次嘗試成功時的條件機率」（`page.tsx:94`），與已驗證的機制不符。因決策鎖定不動該頁，新頁**不得複用該句**，並列為 deferred follow-up。

---

## 資訊架構

視覺由 designer 決定。功能上需包含：

### 1. 查詢控制
屬性（20 種，顯示中文、submit 值為 `ITEM_BONUS_*`）、家族（全部／真元／魂珠／魂石／其他）、槽位（全部／武器／帽子／衣盾／鞋子／飾品）、排序（加值／機率／期望顆數）、submit。

優先用既有 `Select`、`Button`；若 mockup 需要其他 control，遵守 CLAUDE.md 的 shadcn → base-ui → hand-roll 順序。

### 2. 屬性摘要
選定屬性中文名、總配方數、**四個家族各自的配方數（為 0 也必須顯示 0，不得隱藏）**、可用槽位、加值範圍、機率範圍。

選 ATK/MATK/MDEF 時，玩家應能一眼看到魂石為 0。

### 3. 結果分組
按家族分組，順序：真元 → 魂珠 → 其他 → 魂石。`family=all` 時四組都保留，空組顯示明確零狀態。

### 4. 每條配方必須呈現

配方名稱、核心材料名稱與 `/items/{id}` 連結、家族、來源群組名、適用槽位、**合併後**的加值範圍與機率、**期望消耗顆數**、級距數（`segments > 1` 時標示「分 N 段」）、單次金錢（NULL 顯示「查無」）、毀裝標記、失敗回收物、玩家等級（僅 `isCompoundPlayerLevel()` 為 true 時顯示）。

那 3 筆多屬性配方（10795–10797）需呈現另一個屬性，避免玩家誤以為單次可同時取得。

圖示一律用 `lucide-react`，不得用 Unicode 字元或 emoji。

### 5. 方法與限制
機率定義、期望顆數公式、推估免責、資料來源與非官方界線。

---

## 排序決策

三種模式，皆在家族分組內排序，且**只讀合併後的目標屬性**。

**`bonus`（預設）：** `max DESC` → `min DESC` → `prob DESC` → `expectedMaterials ASC`（null 最後）→ `id ASC`

理由：玩家先問「哪顆加最多」。`max` 相同時比保底 `min`，避免大範圍配方被誤認為穩定高值。再以機率與期望顆數打破同分，`id` 作穩定 tie-break 確保可重現。

**`probability`：** `prob DESC` → `max DESC` → `min DESC` → `expectedMaterials ASC` → `id ASC`

**`materials`：** `expectedMaterials ASC`（null 最後）→ `prob DESC` → `max DESC` → `min DESC` → `id ASC`

---

## 影響範圍

### 修改

| 檔案 | 內容 |
|---|---|
| `src/lib/queries/compound.ts` | 新增 `EnhancementFamily`、`MergedBonus`、`EnhancementResult`、`enhancementFamily()`、`mergeBonus()`、`getEnhancementsByBonus()`、`parseEnhancementSearchParams()`；export 既有 bonus 清單與 label resolver |
| `src/app/tools/enhance/page.tsx` | 新增。Metadata、`searchParams` 驗證、單一 query、icon batch、summary、分組、排序、四種狀態渲染 |
| `src/components/layout/navbar.tsx` | 加入 `/tools/enhance` 入口；處理 `/tools` 與子路由的 active state 衝突（`isActive()` 目前用 prefix 比對，`:40-43`） |
| `src/app/tools/page.tsx` | metadata 與標題從「副本解謎工具」改為一般工具總覽；新增強化查詢卡片；保留既有 160/175/180 三個工具 |
| `src/lib/queries/__tests__/compound.test.ts` | 新增測試 |

### 明確不動

`src/app/compounds/page.tsx`、`src/app/compounds/[id]/page.tsx`、`src/components/compounds/compound-recipe-table.tsx`、`src/components/items/equipment-enhancements-section.tsx`、`src/components/items/enhancements-list.tsx`、`tthol.sqlite`、`package.json`、lockfile。

### 是否拆元件

待 mockup 核可後決定。頁面夠小就留在 page 內，不預先建立 presentation-only 元件。

---

## 工作分段

**Gate 0：** designer 依本文件資訊架構出 mockup（使用真實資料），使用者核可後才實作 UI。

**Lane A（query 層）：** 可即刻進行，不依賴 mockup 視覺。家族判定、級距合併、query、期望顆數、參數驗證、全部測試。

**Lane B（navbar 與 tools hub）：** 可與 A 平行，寫入範圍不重疊。

**Lane C（route 與呈現）：** 依賴 A 的契約與 Gate 0 核可。

**Lane D（整合驗證）：** 依賴 A、B、C。

---

## 測試計畫

沿用既有慣例：真實唯讀 `tthol.sqlite`、不引入 fixture 或 mock、放進既有 `src/lib/queries/__tests__/compound.test.ts`。

### 級距合併（本功能最高風險）

- `吉魂珠強化`(10742) 對 ATK 合併後為 `min=10, max=30, prob=700000, segments=4`。
- **反向 regression：** 斷言該配方合併後 `prob` 嚴格大於任一單一級距機率。若有人移除合併邏輯，此測試失敗。
- 全 1,026 筆掃描：任一屬性合併後 `prob <= 1_000_000`，0 筆例外。
- 同屬性多級距的配方數為 143；多種不同屬性者為 3。

### 家族分類

- 四家族總數：真元 502、魂石 240、其他 180、魂珠 104，合計 1,026。
- `enhancementFamily()` 對 `義劭魂珠強化` 回傳 `pearl` 而非 `yuan`（判定順序 regression）。
- `波波鼠強化裝備` 回傳 `other`。
- **反向 regression：** 斷言存在 `group` 在 70–110 但家族為 `pearl` 的配方。若有人改回 group range 二分法，此測試失敗。

### Query 正確性

- ATK 全部結果為 **60** 筆（非 94）。
- DEF 為 **91** 筆（最大結果集）。
- ATK 家族分布：真元 37、魂珠 8、其他 15、**魂石 0**。
- 每筆結果的 `target.rawType` 等於 selected attribute，`prob > 0`。
- 結果不含 `type="0"`。

### 魂石缺口 regression

```ts
expect(getEnhancementsByBonus({ bonusType: "ITEM_BONUS_ATK", family: "stone", slot: null })).toHaveLength(0);
```

同樣斷言 MATK、MDEF 的 stone 為 0，且 STR 的 stone 大於 0（確保不是 filter 壞掉導致全 0）。

### 屬性覆蓋

20 種 bonus type 全部有非空繁體中文 label。抽驗既有翻譯：ATK→物攻、MATK→內勁、MDEF→護勁、MP→真氣、EARTH_DEF→木抗、LIGHTNING_DEF→雷抗、UNCANNYDODGE→拆招。

### 槽位

ATK 只出現於武器與飾品；ATK + 帽子/衣盾/鞋子為 0。filtered 結果的 `sideMaterials[0].id` 等於 requested slot。

### 期望顆數

- `prob=1_000_000` → 1 顆。
- `prob=500_000` → 2 顆。
- `prob=700_000` → 1.4 顆（10742 的實際值）。
- `prob<=0` 或 amount 非有限 → `null`。
- 全 1,026 筆皆可計算（`material_core_amount` 無 NULL），**斷言無任何一筆為 null**。

### 排序

以真實結果建立獨立 oracle comparator，驗證三種模式的完整 tie-break 鏈、null 置尾、重複執行順序一致，且 comparator 讀合併結果而非 `outputs[0]`。

### 參數驗證

缺值取預設；20 種合法屬性通過；未知 attribute/family/sort 失敗；slot 的 `0`、`6`、`01`、小數、非數字失敗；array 失敗；invalid 時 0 次 DB query。

### N+1 guard

沿用 `monster-spawns.test.ts:508-526` 的 `db.prepare` 計數方式，不引入新 mock framework。

- `getEnhancementsByBonus(DEF/all/all)` 預期 1 query，上限 2。
- 模擬頁面資料流（query + `collectCompoundItemIds` + `getItemIconMap`）預期 2 queries。
- ATK + stone 零結果預期 1 query。
- query 數不隨結果筆數成長。

---

## 驗收條件

- [ ] `/tools/enhance` build 成功，預設查詢 ATK
- [ ] URL query string 可分享、重新整理後狀態一致
- [ ] 20 種屬性都在選項中且都有非空繁體中文 label
- [ ] ATK 結果恰為 60 筆，DEF 恰為 91 筆
- [ ] ATK 的魂石結果顯示為 0 且該區塊不被隱藏
- [ ] MATK、MDEF 的魂石結果為 0
- [ ] 家族四分類總數為 真元 502／魂珠 104／魂石 240／其他 180
- [ ] `義劭魂珠強化` 歸類為魂珠而非真元
- [ ] `吉魂珠強化` 的 ATK 顯示為 +10~30、70%、期望 1.4 顆
- [ ] 級距數 > 1 的配方在 UI 標示分段
- [ ] 全部結果的期望顆數皆可計算，無 null
- [ ] 期望顆數使用 `material_core_amount ÷ 合併機率`，非寫死 1
- [ ] 100% 機率時期望顆數為 1
- [ ] `money` 為 NULL 時顯示「查無」而非 0
- [ ] 頁面標示期望顆數為推估、未計入毀裝損失
- [ ] 頁面不使用「條件機率」描述
- [ ] 玩家等級僅在 `isCompoundPlayerLevel()` 為 true 時顯示
- [ ] 結果頁 query 數固定 2，零結果 1，不隨筆數成長
- [ ] navbar desktop 與 mobile 皆可進入，且 `/tools` 與 `/tools/enhance` 不同時 active
- [ ] `/tools` hub 包含強化查詢卡片與既有三個副本工具
- [ ] `/compounds`、`/compounds/[id]`、裝備詳情頁未被修改
- [ ] `tthol.sqlite` md5 仍為 `e53e15d3c84a4509abbd70b65c90aa01`
- [ ] `package.json` 與 lockfile 未修改
- [ ] targeted vitest、全套 vitest、typecheck、build 全數通過

驗證指令（**不執行 `npm run lint`**，repo 既有 blocker：ESLint 10.2.1 與 `eslint-config-next` 內 `eslint-plugin-react` 不相容，crash 於 `eslint.config.mjs` 本身）：

```bash
npx vitest run src/lib/queries/__tests__/compound.test.ts
npx vitest run
npm run typecheck
npm run build
```

基準：43 files / 562 passed。

---

## 風險與未知

### 1. 級距合併是最高風險（已有對策）
既有元件全部讀 `outputs[0]`。若新程式碼沿用該模式，143 筆配方的加值、機率、期望顆數與排序全部錯誤。對策是 `mergeBonus()` 加上針對 10742 的具體斷言與反向 regression。

### 2. 家族依賴名稱字串
`enhancementFamily()` 用關鍵字比對，若日後 DB 出現新命名慣例會落到「其他」。這是刻意取捨——group range 已證實會誤標 284 筆。測試以總數斷言，DB 更新導致失敗時應重新 audit 而非放寬。

### 3. `/compounds/[id]` 的既有文案與機制衝突
該頁寫「條件機率」，與驗證結果不符。本次不動（決策鎖定），列為 deferred。

### 4. 查無的資料
以下無 DB 支撐，**不得推導或臆測**：真元／魂珠取得難度與市場價值、裝備替換成本、毀裝的獨立機率或保護機制、`money` 的正式幣別名稱、玩家有限次嘗試的支出分布、324 筆 `money` 為 NULL 的原因（是免費或資料缺漏無法判定）。

### 5. `equip_crash` 僅為 boolean
可顯示有無毀裝風險，不得擴寫成完整遊戲規則。

### 6. mockup 尚未產出
資訊架構已定，但結果用 table、card 或其他結構待 designer 決定。實作者不得在 Gate 0 前鎖定版面。

---

## Deferred

不修改 `/compounds` 系列與裝備詳情頁；不抽象化 `bucketByBonus()`；不建立通用搜尋／篩選／排序框架；不做 pagination、虛擬捲動、cache layer、衍生索引表；不估算材料市價與毀裝替換成本；不計算「N 次內至少一次」機率或信賴區間；不做多屬性聯合查詢與裝備 build optimizer；不新增 dependency；不修正 `/compounds/[id]` 的條件機率文案（另開 follow-up）。
