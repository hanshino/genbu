# Phase 2 — Equipment Comparison System

## Overview

打造裝備比較系統，包含裝備排行榜（自訂權重）和多件裝備並排比較工具。核心概念移植自 LINE Bot 的坐騎/背飾比較功能，但在網站上能做到更好的互動體驗。

---

## 1. Weighted Score System

### 1.1 Seven Preset Build Archetypes

從 LINE Bot `weighted.config.js` 移植，每種流派對不同屬性給予不同權重：

| 流派         | 權重公式                                                     |
| ------------ | ------------------------------------------------------------ |
| **純玄系列** | wis×7 + dex×3 + hit×1 + def×0.5 + mdef×0.25                  |
| **純外系列** | str×11 + atk×1 + dex×3 + hit×1 + def×0.5 + mdef×0.5          |
| **純內系列** | pow×9 + matk×1 + dex×3 + hit×1 + def×0.5 + mdef×0.5          |
| **玄內系列** | wis×7 + pow×5 + matk×1 + dex×3 + hit×1 + def×0.5 + mdef×0.25 |
| **玄外系列** | wis×7 + str×5 + atk×1 + dex×3 + hit×1 + def×0.5 + mdef×0.5   |
| **爆刀**     | agi×7 + str×7 + critical×5 + def×0.75 + mdef×0.75            |
| **手甲**     | dex×15 + hit×5 + atk×7                                       |

### 1.2 Custom Weight Support

除了預設 7 種流派，使用者可以自訂權重：

- 提供可選屬性清單（str, pow, vit, dex, agi, wis, atk, matk, def, mdef, dodge, critical, hit, speed 等）
- 每個屬性可設定權重倍率（數字輸入或滑桿）
- 自訂公式可儲存至 localStorage 以便下次使用

### 1.3 Score Calculation

```typescript
// 限定 key 為 Item 中的數值屬性欄位，確保 TypeScript 類型安全
type NumericItemKey =
  | "hp"
  | "mp"
  | "str"
  | "pow"
  | "vit"
  | "dex"
  | "agi"
  | "wis"
  | "atk"
  | "matk"
  | "def"
  | "mdef"
  | "dodge"
  | "uncanny_dodge"
  | "critical"
  | "hit"
  | "speed"
  | "fire"
  | "water"
  | "thunder"
  | "tree"
  | "freeze";

interface WeightParam {
  key: NumericItemKey;
  value: number; // 權重倍率
}

// Weighted score formula: score = Σ(attribute_value × weight)
function calculateScore(item: Item, params: WeightParam[]): number {
  return params.reduce((score, param) => {
    return score + (item[param.key] || 0) * param.value;
  }, 0);
}
```

---

## 2. Pages

### 2.1 Equipment Ranking Page (`/items/ranking`)

**功能描述**: 針對指定裝備類別，依加權分數排行。

**UI 配置**:

```
┌─────────────────────────────────────────────────┐
│ [類別選擇: 座騎 ▼]  [流派選擇: 純外系列 ▼]     │
│                                                   │
│ ── 或自訂權重 ──                                  │
│ [外功: 11 ] [物攻: 1 ] [技巧: 3 ] [命中: 1 ]    │
│ [防禦: 0.5] [護勁: 0.5] [+ 新增屬性]            │
│                                                   │
│ [計算排行]                                        │
├─────────────────────────────────────────────────┤
│ #  │ 名稱       │ 等級 │ 加權分數 │ 主要屬性     │
│ 1  │ XXX坐騎    │ 80  │ 285.5   │ 外30 技15... │
│ 2  │ YYY坐騎    │ 80  │ 272.0   │ 外28 技14... │
│ ...│            │     │         │              │
│ 30 │ ZZZ坐騎    │ 80  │ 180.5   │ 外20 技10... │
└─────────────────────────────────────────────────┘
```

**行為**:

- 預設顯示「座騎」+「純外系列」排行
- 切換流派時即時重新計算
- 自訂權重欄位可新增/移除屬性
- 排行結果預設顯示 Top 30
- 每列可點擊展開詳細屬性或跳至道具詳情頁
- URL 參數: `?type=座騎&preset=純外系列` 或 `?type=座騎&w=str:11,atk:1,dex:3`

**支援的裝備類別**:

- 座騎、背飾、左飾、中飾、右飾、帽、衣、鞋
- 武器類: 刀、劍、匕首、拳刃、盾、手套、法杖、扇、雙手刀、拂塵、手甲、棍、雙劍、暗器

### 2.2 Equipment Comparison Page (`/items/compare`)

**功能描述**: 選擇 2~4 件裝備，side-by-side 並排比較屬性差異 (diff highlighting) 和各流派加權分數。

**UI 配置**:

```
┌──────────────────────────────────────────────────┐
│ 搜尋裝備: [____________] [+ 加入比較]             │
│                                                    │
│ 已選: [坐騎A ✕] [坐騎B ✕] [坐騎C ✕]             │
├──────────────────────────────────────────────────┤
│ 屬性      │ 坐騎A    │ 坐騎B    │ 坐騎C         │
│ ──────────┼──────────┼──────────┼───────────     │
│ 外功      │ 30       │ 28 (-2)  │ 32 (+2)       │
│ 內力      │ 0        │ 5 (+5)   │ 0             │
│ 技巧      │ 15       │ 14 (-1)  │ 16 (+1)       │
│ ...       │          │          │                │
├──────────────────────────────────────────────────┤
│ 流派加權   │ 坐騎A    │ 坐騎B    │ 坐騎C         │
│ ──────────┼──────────┼──────────┼───────────     │
│ 純外系列   │ 285.5    │ 272.0 ❌ │ 298.0 ✅      │
│ 純玄系列   │ 105.0    │ 135.5 ✅ │ 112.0         │
│ 純內系列   │ 45.0     │ 90.0 ✅  │ 48.0          │
│ ...       │          │          │                │
└──────────────────────────────────────────────────┘
```

**行為**:

- 搜尋框輸入名稱，autocomplete 下拉選擇
- 最多同時比較 4 件裝備
- 屬性差異以第一件為基準，正值綠色、負值紅色
- 下方顯示 7 種流派的加權分數比較
- 最高分的流派欄位標記 ✅，最低分標記 ❌
- URL 參數: `?ids=1234,5678,9012` 利於分享
- 可直接從道具詳情頁點「加入比較」跳轉至此頁

---

## 3. Components

### 3.1 New Components

```
src/components/
├── compare/
│   ├── weight-preset-selector.tsx   # 流派預設選擇器
│   ├── custom-weight-editor.tsx     # 自訂權重編輯器
│   ├── ranking-table.tsx            # 排行榜結果表格
│   ├── comparison-table.tsx         # 並排比較表格
│   ├── comparison-search.tsx        # 比較頁搜尋/選擇裝備
│   └── score-badge.tsx              # 加權分數 badge (with ✅/❌)
```

### 3.2 Shared / Modified

- `item-table.tsx` — 增加「加入比較」按鈕欄位
- `item-detail.tsx` — 增加「加入比較」和「查看排行」快捷按鈕

---

## 4. Data Layer

### 4.1 New Query Functions (`src/lib/queries/items.ts`)

```typescript
// 依加權分數排行
function getItemsRankedByWeight(params: {
  type: string;
  weights: WeightParam[];
  limit?: number;
}): RankedItem[];

// 批次取得多件道具 (for comparison)
function getItemsByIds(ids: number[]): Item[];
```

### 4.2 Config (`src/lib/constants/weighted.ts`)

移植 LINE Bot 的 7 種預設流派配置。

---

## 5. Data Access — Server/Client Boundary

Client Component 無法直接使用 `getDb()`（better-sqlite3 是 server-only）。需透過 Route Handlers 提供資料：

### 5.1 API Routes

```typescript
// GET /api/items?type=座騎 → 回傳該類別所有道具（供排行頁 client-side 計算）
// GET /api/items/search?q=xxx → 回傳搜尋結果（供比較頁 autocomplete）
// GET /api/items/batch?ids=1,2,3 → 批次取得多件道具（供比較頁）
```

### 5.2 State Management

- **排行頁**: 選擇類別時呼叫 API 取得該類別所有道具（一次性），之後切換流派/權重時在 client side 即時重新計算分數和排序，不需再次 server round-trip
- **比較頁**: Client Component 管理選中裝備 state，分數計算在 client side 完成（資料已載入）
- **自訂權重**: 儲存至 localStorage（key: `genbu_custom_weights`, 格式: `WeightParam[]` JSON）。存取時需以 `typeof window !== 'undefined'` 防護 SSR 環境

---

## 6. Implementation Order

1. `src/lib/constants/weighted.ts` — 移植 7 種流派配置
2. `src/lib/queries/items.ts` — 新增排行和批次查詢
3. Weight preset selector + custom weight editor components
4. Ranking page (`/items/ranking`)
5. Comparison search + comparison table components
6. Comparison page (`/items/compare`)
7. 道具詳情頁/列表頁增加快捷按鈕
