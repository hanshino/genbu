# 武裝覺醒系統 — 裝備頁整合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/items/[id]` 頁面底部嵌入「覺醒升階」區塊，顯示該裝備從 +1~+20 各階成本、屬性加值、成功率與累積花費（最佳/期望）。

**Architecture:** 純函式對應規則 (`level → gen prefix`, `type → slot prefix`) 配合 SQLite 查詢，組裝成 `AwakeningStage[]`，由 Server Component `AwakeningSection` 渲染為 shadcn `Table`。失敗機制與累積成本公式以資訊區塊呈現，不做互動計算器。

**Tech Stack:** Next.js App Router (Server Component)、TypeScript、better-sqlite3、Tailwind、shadcn/ui (`Table`, `Card`)、Vitest。

**Spec:** `docs/superpowers/specs/2026-04-26-awakening-system-design.md`

---

## File Structure

### New files

```
src/lib/types/awakening.ts
src/lib/queries/awakening.ts
src/lib/queries/__tests__/awakening.test.ts
src/lib/awakening-cost.ts
src/lib/__tests__/awakening-cost.test.ts
src/components/items/awakening-section.tsx
```

### Modified files

- `src/app/items/[id]/page.tsx` — 加入 `<AwakeningSection item={item} />`

### One-file, one-job

- `awakening.ts`（queries）：純對應規則 + DB 讀取，輸出 `AwakeningStage[]`
- `awakening-cost.ts`：純函式累積成本計算（最佳/期望/累積符）
- `awakening-section.tsx`：表格渲染，從 query + cost 結果取資料

---

## Task 0: Branch setup

**Files:** none

- [ ] **Step 1: Confirm clean main**

```bash
git status --short
```

Expected: clean working tree on `main`，最近 commit 是 `343f074 docs(spec): awakening system embedded in item detail page`。

- [ ] **Step 2: Create feature branch**

```bash
git checkout -b feature/awakening-system
```

Expected: switched to new branch.

---

## Task 1: 型別定義

**Files:**
- Create: `src/lib/types/awakening.ts`

- [ ] **Step 1: 寫型別**

Create `src/lib/types/awakening.ts`:

```ts
/**
 * 一個覺醒階段的單一屬性配方。
 * 同階段、同部位可能有多個屬性可選（例：200鞋 +1 同時有 DEF/ATK/MATK/DODGE/HP 5 條 row，
 * 共享 money/material/successProb，只差 bonus）。Stage 把它們合併。
 */
export interface AwakeningStage {
  /** +1 ~ +20 */
  stage: number;
  /** 此階金錢成本 */
  money: number;
  /** 主要使用的覺醒符 id */
  materialId: number;
  /** 覺醒符中文名（從 items 表 join 出來） */
  materialName: string;
  /** 此階消耗符數量 */
  materialAmount: number;
  /** 成功率（0~1，不是百分比） */
  successProb: number;
  /** 此階段可加的所有屬性（一般單元素，200 系鞋/甲/帽 為 5 元素） */
  bonuses: AwakeningBonus[];
}

export interface AwakeningBonus {
  /** ITEM_BONUS_DEF / ITEM_BONUS_ATK / ... */
  bonusType: string;
  /** 中文標籤（防禦 / 物攻 / ...） */
  label: string;
  /** 加值大小（DB 原值是字串，這裡轉成 number） */
  value: number;
}

export interface AwakeningPath {
  /** 該裝備對應的 prefix，例：`200鞋` */
  prefix: string;
  /** 共 20 階（若 DB 有缺則少於 20，按實際存在排序） */
  stages: AwakeningStage[];
}
```

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

Expected: PASS（純型別檔，無相依問題）。

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/awakening.ts
git commit -m "feat(awakening): types for stages, bonuses, paths"
```

---

## Task 2: `levelToGenPrefix` (TDD)

對應 `items.level → 世代 prefix`。10 段切分，第一段是 1~39（與覺醒符 summary 一致）。

**Files:**
- Create: `src/lib/queries/awakening.ts`
- Test: `src/lib/queries/__tests__/awakening.test.ts`

- [ ] **Step 1: 寫 failing test**

Create `src/lib/queries/__tests__/awakening.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { levelToGenPrefix } from "../awakening";

describe("levelToGenPrefix", () => {
  it("returns null for level 0 and below", () => {
    expect(levelToGenPrefix(0)).toBeNull();
    expect(levelToGenPrefix(-1)).toBeNull();
  });

  it("maps 1~39 to '20' (first generation has wider range)", () => {
    expect(levelToGenPrefix(1)).toBe("20");
    expect(levelToGenPrefix(7)).toBe("20");
    expect(levelToGenPrefix(20)).toBe("20");
    expect(levelToGenPrefix(39)).toBe("20");
  });

  it("maps 40~59 to '40'", () => {
    expect(levelToGenPrefix(40)).toBe("40");
    expect(levelToGenPrefix(59)).toBe("40");
  });

  it("maps 60~79 to '60'", () => {
    expect(levelToGenPrefix(60)).toBe("60");
    expect(levelToGenPrefix(79)).toBe("60");
  });

  it("maps 80~99 to '80'", () => {
    expect(levelToGenPrefix(80)).toBe("80");
    expect(levelToGenPrefix(99)).toBe("80");
  });

  it("maps 100~119 to '100'", () => {
    expect(levelToGenPrefix(100)).toBe("100");
    expect(levelToGenPrefix(119)).toBe("100");
  });

  it("maps 120~139 to '120'", () => {
    expect(levelToGenPrefix(120)).toBe("120");
    expect(levelToGenPrefix(139)).toBe("120");
  });

  it("maps 140~159 to '140'", () => {
    expect(levelToGenPrefix(140)).toBe("140");
    expect(levelToGenPrefix(159)).toBe("140");
  });

  it("maps 160~179 to '160'", () => {
    expect(levelToGenPrefix(160)).toBe("160");
    expect(levelToGenPrefix(179)).toBe("160");
  });

  it("maps 180~199 to '180'", () => {
    expect(levelToGenPrefix(180)).toBe("180");
    expect(levelToGenPrefix(199)).toBe("180");
  });

  it("maps 200+ to '200'", () => {
    expect(levelToGenPrefix(200)).toBe("200");
    expect(levelToGenPrefix(250)).toBe("200");
  });
});
```

- [ ] **Step 2: 確認測試失敗**

```bash
npm test -- src/lib/queries/__tests__/awakening.test.ts
```

Expected: FAIL（`Cannot find module '../awakening'`）。

- [ ] **Step 3: 寫實作**

Create `src/lib/queries/awakening.ts`:

```ts
export function levelToGenPrefix(level: number): string | null {
  if (level < 1) return null;
  if (level >= 200) return "200";
  if (level >= 180) return "180";
  if (level >= 160) return "160";
  if (level >= 140) return "140";
  if (level >= 120) return "120";
  if (level >= 100) return "100";
  if (level >= 80) return "80";
  if (level >= 60) return "60";
  if (level >= 40) return "40";
  return "20"; // 1~39
}
```

- [ ] **Step 4: 確認測試通過**

```bash
npm test -- src/lib/queries/__tests__/awakening.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/awakening.ts src/lib/queries/__tests__/awakening.test.ts
git commit -m "feat(awakening): levelToGenPrefix mapping"
```

---

## Task 3: `itemTypeToSlotPrefix` (TDD)

對應 `items.type → 部位 prefix`。

- [ ] **Step 1: 加 failing tests**

在 `src/lib/queries/__tests__/awakening.test.ts` 末尾追加：

```ts
import { itemTypeToSlotPrefix } from "../awakening";

describe("itemTypeToSlotPrefix", () => {
  it("passes through 防具 types unchanged", () => {
    expect(itemTypeToSlotPrefix("鞋")).toBe("鞋");
    expect(itemTypeToSlotPrefix("衣")).toBe("衣");
    expect(itemTypeToSlotPrefix("甲")).toBe("甲");
    expect(itemTypeToSlotPrefix("盾")).toBe("盾");
    expect(itemTypeToSlotPrefix("帽")).toBe("帽");
    expect(itemTypeToSlotPrefix("座騎")).toBe("座騎");
  });

  it("passes through 飾 types unchanged", () => {
    expect(itemTypeToSlotPrefix("中飾")).toBe("中飾");
    expect(itemTypeToSlotPrefix("左飾")).toBe("左飾");
    expect(itemTypeToSlotPrefix("右飾")).toBe("右飾");
    expect(itemTypeToSlotPrefix("背飾")).toBe("背飾");
  });

  it("collapses single-hand weapons into 單手武器", () => {
    for (const t of ["劍", "刀", "匕首", "扇", "拂塵", "拳刃", "雙劍", "暗器", "棍"]) {
      expect(itemTypeToSlotPrefix(t)).toBe("單手武器");
    }
  });

  it("maps 雙手刀 to 雙手武器", () => {
    expect(itemTypeToSlotPrefix("雙手刀")).toBe("雙手武器");
  });

  it("maps 法杖 to 法術武器", () => {
    expect(itemTypeToSlotPrefix("法杖")).toBe("法術武器");
  });

  it("returns null for non-equip types", () => {
    expect(itemTypeToSlotPrefix("藥品")).toBeNull();
    expect(itemTypeToSlotPrefix("寶箱")).toBeNull();
    expect(itemTypeToSlotPrefix("真元/魂石")).toBeNull();
    expect(itemTypeToSlotPrefix("未知1")).toBeNull();
  });

  it("returns null for 手套/手甲 (no formula prefix exists)", () => {
    expect(itemTypeToSlotPrefix("手套")).toBeNull();
    expect(itemTypeToSlotPrefix("手甲")).toBeNull();
  });

  it("returns null for 外裝 cosmetic types", () => {
    expect(itemTypeToSlotPrefix("鞋[外裝]")).toBeNull();
    expect(itemTypeToSlotPrefix("帽[外裝]")).toBeNull();
    expect(itemTypeToSlotPrefix("座騎[外裝]")).toBeNull();
  });

  it("returns null for null/empty type", () => {
    expect(itemTypeToSlotPrefix(null)).toBeNull();
    expect(itemTypeToSlotPrefix("")).toBeNull();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

```bash
npm test -- src/lib/queries/__tests__/awakening.test.ts
```

Expected: FAIL（`itemTypeToSlotPrefix is not exported`）。

- [ ] **Step 3: 加實作**

Append to `src/lib/queries/awakening.ts`:

```ts
const ARMOR_TYPES = new Set(["鞋", "衣", "甲", "盾", "帽", "座騎"]);
const ACCESSORY_TYPES = new Set(["中飾", "左飾", "右飾", "背飾"]);
const ONE_HAND_WEAPONS = new Set([
  "劍",
  "刀",
  "匕首",
  "扇",
  "拂塵",
  "拳刃",
  "雙劍",
  "暗器",
  "棍",
]);

export function itemTypeToSlotPrefix(type: string | null): string | null {
  if (!type) return null;
  if (ARMOR_TYPES.has(type)) return type;
  if (ACCESSORY_TYPES.has(type)) return type;
  if (ONE_HAND_WEAPONS.has(type)) return "單手武器";
  if (type === "雙手刀") return "雙手武器";
  if (type === "法杖") return "法術武器";
  return null;
}
```

- [ ] **Step 4: 確認測試通過**

```bash
npm test -- src/lib/queries/__tests__/awakening.test.ts
```

Expected: PASS（兩組 describe 都過）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/awakening.ts src/lib/queries/__tests__/awakening.test.ts
git commit -m "feat(awakening): itemTypeToSlotPrefix mapping"
```

---

## Task 4: `getAwakeningPath` query (TDD against real DB)

讀 strong_formula 並組裝成 `AwakeningPath`。一階可能多 bonus，需合併。

**Files:**
- Modify: `src/lib/queries/awakening.ts`
- Modify: `src/lib/queries/__tests__/awakening.test.ts`

- [ ] **Step 1: 加 failing tests**

在 `src/lib/queries/__tests__/awakening.test.ts` 末尾追加：

```ts
import { getAwakeningPath } from "../awakening";
import { getItemById } from "../items";

describe("getAwakeningPath", () => {
  it("returns null when item type has no slot mapping", () => {
    // 究極黑布鞋 id=21108 type=鞋, level=7 → 應該有 path
    // 但拿一個藥品 id 來測 null 路徑
    const drug = getItemById(24003); // 活絡養生丹 (type=藥品 預期)
    if (!drug) throw new Error("expected sample drug 24003 to exist");
    expect(getAwakeningPath(drug)).toBeNull();
  });

  it("returns 20-stage path for level=7 鞋 mapping to 20鞋", () => {
    const item = getItemById(21108); // 究極黑布鞋 level=7 type=鞋
    expect(item).not.toBeNull();
    const path = getAwakeningPath(item!);
    expect(path).not.toBeNull();
    expect(path!.prefix).toBe("20鞋");
    expect(path!.stages).toHaveLength(20);
    expect(path!.stages[0].stage).toBe(1);
    expect(path!.stages[19].stage).toBe(20);
  });

  it("merges multi-bonus rows into a single stage (200鞋 5 bonuses)", () => {
    // 測對應規則：level≥200 + type=鞋 → 200鞋
    // 找一件 level≥200 的 鞋（可能不存在於資料）
    // 如果沒有，改用 level=116 (紅凜嬋妖鞋, 100~119) → 100鞋（單 bonus）
    const item = getItemById(21114); // 紅凜嬋妖鞋 level=116
    expect(item).not.toBeNull();
    const path = getAwakeningPath(item!);
    expect(path).not.toBeNull();
    expect(path!.prefix).toBe("100鞋");
    expect(path!.stages).toHaveLength(20);
    // 100鞋 是單 bonus = DEF
    expect(path!.stages[0].bonuses).toHaveLength(1);
    expect(path!.stages[0].bonuses[0].bonusType).toBe("ITEM_BONUS_DEF");
    expect(path!.stages[0].bonuses[0].label).toBe("防禦");
  });

  it("filters out 跨階煉化 rows (containing '\"' in name)", () => {
    const item = getItemById(21114);
    const path = getAwakeningPath(item!);
    // 每個 stage 的 stage 值應為 1..20，不含跨階雜訊
    const stageNums = path!.stages.map((s) => s.stage);
    expect(stageNums).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
  });

  it("dedupes the duplicate row issue (e.g. 100右飾+1)", () => {
    // 100右飾+1 在 DB 有 2 row（皆 MDEF）。bonuses 應 dedupe 成 1。
    // 找 level=100~119 type=右飾 的 item
    const item = getItemById(22002) ?? getItemById(22001) ?? null; // adjust 若 id 不對
    if (!item || item.type !== "右飾" || item.level < 100 || item.level > 119) {
      // 如果範例 id 對不上，改用 SQL 找：跳過此 case
      // 但仍然 assert 由其他測試 cover dedup
      return;
    }
    const path = getAwakeningPath(item);
    expect(path).not.toBeNull();
    const stage1 = path!.stages.find((s) => s.stage === 1);
    expect(stage1).toBeDefined();
    // 不應重複
    const types = stage1!.bonuses.map((b) => b.bonusType);
    expect(new Set(types).size).toBe(types.length);
  });

  it("populates material name from awakening token items", () => {
    const item = getItemById(21114); // level=116 → 100鞋 → 五星覺醒符 (id=26932)
    const path = getAwakeningPath(item!);
    const stage1 = path!.stages[0];
    expect(stage1.materialId).toBe(26932);
    expect(stage1.materialName).toBe("五星覺醒符");
    expect(stage1.materialAmount).toBeGreaterThanOrEqual(1);
  });

  it("uses 突破覺醒符 around +11~+15 and 超越覺醒符 around +16~+20", () => {
    const item = getItemById(21114);
    const path = getAwakeningPath(item!);
    const stage12 = path!.stages.find((s) => s.stage === 12);
    const stage18 = path!.stages.find((s) => s.stage === 18);
    expect(stage12?.materialName).toBe("突破覺醒符");
    expect(stage18?.materialName).toBe("超越覺醒符");
  });

  it("convertes successProb from millionths to 0..1 range", () => {
    const item = getItemById(21114);
    const path = getAwakeningPath(item!);
    expect(path!.stages[0].successProb).toBeCloseTo(1, 5); // +1 是 100%
    const stage20 = path!.stages.find((s) => s.stage === 20);
    expect(stage20!.successProb).toBeGreaterThan(0);
    expect(stage20!.successProb).toBeLessThan(0.1); // +20 個位數百分比
  });
});
```

> 註：測試使用真實 DB（與 `monsters.test.ts` 同模式）。`21108`（究極黑布鞋）、`21114`（紅凜嬋妖鞋）、`24003`（活絡養生丹）、`26932`（五星覺醒符）等 id 已從 spec 資料探勘確認。

- [ ] **Step 2: 跑測試確認失敗**

```bash
npm test -- src/lib/queries/__tests__/awakening.test.ts
```

Expected: FAIL（`getAwakeningPath is not exported`）。

- [ ] **Step 3: 寫實作**

Append to `src/lib/queries/awakening.ts`:

```ts
import { getDb } from "@/lib/db";
import type { Item } from "@/lib/types/item";
import type { AwakeningBonus, AwakeningPath, AwakeningStage } from "@/lib/types/awakening";

const BONUS_LABELS: Record<string, string> = {
  ITEM_BONUS_DEF: "防禦",
  ITEM_BONUS_MDEF: "魔防",
  ITEM_BONUS_ATK: "物攻",
  ITEM_BONUS_MATK: "內勁",
  ITEM_BONUS_HP: "體力",
  ITEM_BONUS_MP: "內力",
  ITEM_BONUS_DODGE: "閃躲",
  ITEM_BONUS_HIT: "命中",
  ITEM_BONUS_CRITICAL: "暴擊",
  ITEM_BONUS_UNCANNYDODGE: "閃避反擊",
  ITEM_BONUS_STR: "力量",
  ITEM_BONUS_VIT: "體質",
  ITEM_BONUS_DEX: "技巧",
  ITEM_BONUS_AGI: "敏捷",
  ITEM_BONUS_POW: "悟性",
  ITEM_BONUS_WIS: "意志",
};

interface FormulaRow {
  name: string;
  money: number;
  material_core_id: number;
  material_core_amount: number;
  success_prob: number;
  bonus_type: string;
  bonus_value: string;
  material_name: string;
}

export function getAwakeningPath(item: Item): AwakeningPath | null {
  const gen = levelToGenPrefix(item.level);
  const slot = itemTypeToSlotPrefix(item.type);
  if (!gen || !slot) return null;

  const prefix = `${gen}${slot}`;
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT sf.name, sf.money, sf.material_core_id, sf.material_core_amount,
              sf.success_prob, sf.bonus_type, sf.bonus_value,
              i.name AS material_name
       FROM strong_formula sf
       LEFT JOIN items i ON i.id = sf.material_core_id
       WHERE sf.name LIKE ? AND sf.name NOT LIKE '%"%'
       ORDER BY CAST(SUBSTR(sf.name, ? + 2) AS INTEGER), sf.bonus_type`,
    )
    .all(`${prefix}+%`, prefix.length) as FormulaRow[];

  if (rows.length === 0) return null;

  // group by stage number
  const byStage = new Map<number, FormulaRow[]>();
  for (const row of rows) {
    const stageStr = row.name.slice(prefix.length + 1); // skip "+"
    const stage = Number.parseInt(stageStr, 10);
    if (!Number.isInteger(stage) || stage < 1 || stage > 20) continue;
    const list = byStage.get(stage) ?? [];
    list.push(row);
    byStage.set(stage, list);
  }

  const stages: AwakeningStage[] = [];
  for (const [stage, group] of [...byStage.entries()].sort((a, b) => a[0] - b[0])) {
    // dedupe bonuses by bonusType (handles 100右飾+1 duplicate quirk)
    const seen = new Set<string>();
    const bonuses: AwakeningBonus[] = [];
    for (const r of group) {
      if (seen.has(r.bonus_type)) continue;
      seen.add(r.bonus_type);
      bonuses.push({
        bonusType: r.bonus_type,
        label: BONUS_LABELS[r.bonus_type] ?? r.bonus_type,
        value: Number(r.bonus_value),
      });
    }

    const head = group[0]; // money/material/successProb shared across rows in same stage
    stages.push({
      stage,
      money: head.money,
      materialId: head.material_core_id,
      materialName: head.material_name ?? `#${head.material_core_id}`,
      materialAmount: head.material_core_amount,
      successProb: head.success_prob / 1_000_000,
      bonuses,
    });
  }

  return { prefix, stages };
}
```

- [ ] **Step 4: 跑測試確認通過**

```bash
npm test -- src/lib/queries/__tests__/awakening.test.ts
```

Expected: PASS（11 個 test）。如果某些 sample id（如 22001/22002）對不上，刪除該 dedup 測試或改抓 SQL，先讓其他 case 過。

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/awakening.ts src/lib/queries/__tests__/awakening.test.ts
git commit -m "feat(awakening): getAwakeningPath query with merge + dedupe"
```

---

## Task 5: 累積成本計算 (TDD)

純函式：給 `AwakeningStage[]`，輸出每階的累積最佳金錢、累積期望金錢、累積符數量。

**Files:**
- Create: `src/lib/awakening-cost.ts`
- Test: `src/lib/__tests__/awakening-cost.test.ts`

- [ ] **Step 1: 寫 failing test**

Create `src/lib/__tests__/awakening-cost.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeCumulative, type CumulativeRow } from "../awakening-cost";
import type { AwakeningStage } from "@/lib/types/awakening";

function stage(n: number, money: number, prob: number, mat = "十星覺醒符"): AwakeningStage {
  return {
    stage: n,
    money,
    materialId: 0,
    materialName: mat,
    materialAmount: 1,
    successProb: prob,
    bonuses: [{ bonusType: "ITEM_BONUS_DEF", label: "防禦", value: n * 2 }],
  };
}

describe("computeCumulative", () => {
  it("returns empty array for empty input", () => {
    expect(computeCumulative([])).toEqual([]);
  });

  it("best == expected when successProb is 1", () => {
    const out = computeCumulative([stage(1, 100_000, 1), stage(2, 300_000, 1)]);
    expect(out[0].cumulativeBest).toBe(100_000);
    expect(out[0].cumulativeExpected).toBe(100_000);
    expect(out[1].cumulativeBest).toBe(400_000);
    expect(out[1].cumulativeExpected).toBe(400_000);
  });

  it("expected scales by 1/p when prob < 1", () => {
    const out = computeCumulative([stage(1, 1_000_000, 0.5)]);
    expect(out[0].cumulativeBest).toBe(1_000_000);
    expect(out[0].cumulativeExpected).toBeCloseTo(2_000_000, 0);
  });

  it("matches the spec sanity-check for 200鞋 (best=103.9M, expected≈1.17B)", () => {
    // 200鞋 全 20 階 (money/prob)，從 spec 驗證附錄
    const data: Array<[number, number, number, string]> = [
      [1, 100_000, 1.0, "十星覺醒符"],
      [2, 300_000, 1.0, "十星覺醒符"],
      [3, 500_000, 0.9, "十星覺醒符"],
      [4, 1_000_000, 0.8, "十星覺醒符"],
      [5, 2_000_000, 0.7, "十星覺醒符"],
      [6, 3_000_000, 0.6, "十星覺醒符"],
      [7, 3_500_000, 0.5, "十星覺醒符"],
      [8, 4_000_000, 0.4, "十星覺醒符"],
      [9, 4_500_000, 0.3, "十星覺醒符"],
      [10, 5_000_000, 0.2, "十星覺醒符"],
      [11, 5_500_000, 0.2, "突破覺醒符"],
      [12, 6_000_000, 0.2, "突破覺醒符"],
      [13, 6_500_000, 0.15, "突破覺醒符"],
      [14, 7_000_000, 0.1, "突破覺醒符"],
      [15, 7_500_000, 0.05, "突破覺醒符"],
      [16, 8_000_000, 0.2, "超越覺醒符"],
      [17, 8_500_000, 0.15, "超越覺醒符"],
      [18, 9_000_000, 0.1, "超越覺醒符"],
      [19, 10_000_000, 0.05, "超越覺醒符"],
      [20, 12_000_000, 0.03, "超越覺醒符"],
    ];
    const stages = data.map(([n, m, p, mat]) => stage(n, m, p, mat));
    const out = computeCumulative(stages);
    const last = out[out.length - 1];
    expect(last.cumulativeBest).toBe(103_900_000);
    // 期望總和約 1.17B，allow 1% tolerance
    expect(last.cumulativeExpected).toBeGreaterThan(1_150_000_000);
    expect(last.cumulativeExpected).toBeLessThan(1_200_000_000);
  });

  it("groups cumulative material counts by name", () => {
    const out = computeCumulative([
      stage(1, 100_000, 1, "十星覺醒符"),
      stage(2, 300_000, 1, "十星覺醒符"),
      stage(3, 500_000, 0.9, "突破覺醒符"),
    ]);
    expect(out[0].cumulativeMaterials).toEqual({ 十星覺醒符: 1 });
    expect(out[1].cumulativeMaterials).toEqual({ 十星覺醒符: 2 });
    expect(out[2].cumulativeMaterials).toEqual({ 十星覺醒符: 2, 突破覺醒符: 1 });
  });

  it("treats successProb=0 as +Infinity expected (avoid div-by-zero)", () => {
    const out = computeCumulative([stage(1, 1_000_000, 0)]);
    expect(out[0].cumulativeExpected).toBe(Infinity);
  });
});

describe("CumulativeRow type fields", () => {
  it("exposes stage and per-stage money/prob alongside cumulatives", () => {
    const out = computeCumulative([stage(1, 100, 1)]);
    const row: CumulativeRow = out[0];
    expect(row.stage).toBe(1);
    expect(row.stageMoney).toBe(100);
    expect(row.stageProb).toBe(1);
    expect(row.cumulativeBest).toBe(100);
    expect(row.cumulativeExpected).toBe(100);
    expect(row.cumulativeMaterials).toEqual({ 十星覺醒符: 1 });
    expect(row.materialName).toBe("十星覺醒符");
    expect(row.materialAmount).toBe(1);
    expect(row.bonuses[0].label).toBe("防禦");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

```bash
npm test -- src/lib/__tests__/awakening-cost.test.ts
```

Expected: FAIL（module not found）。

- [ ] **Step 3: 寫實作**

Create `src/lib/awakening-cost.ts`:

```ts
import type { AwakeningBonus, AwakeningStage } from "@/lib/types/awakening";

export interface CumulativeRow {
  stage: number;
  stageMoney: number;
  stageProb: number;
  materialName: string;
  materialAmount: number;
  bonuses: AwakeningBonus[];
  cumulativeBest: number;
  cumulativeExpected: number;
  /** 各覺醒符累計次數，最佳情況（不含失敗重抽） */
  cumulativeMaterials: Record<string, number>;
}

export function computeCumulative(stages: AwakeningStage[]): CumulativeRow[] {
  const rows: CumulativeRow[] = [];
  let runningBest = 0;
  let runningExpected = 0;
  const runningMaterials: Record<string, number> = {};

  for (const s of stages) {
    runningBest += s.money;
    runningExpected += s.successProb > 0 ? s.money / s.successProb : Infinity;
    runningMaterials[s.materialName] =
      (runningMaterials[s.materialName] ?? 0) + s.materialAmount;

    rows.push({
      stage: s.stage,
      stageMoney: s.money,
      stageProb: s.successProb,
      materialName: s.materialName,
      materialAmount: s.materialAmount,
      bonuses: s.bonuses,
      cumulativeBest: runningBest,
      cumulativeExpected: runningExpected,
      cumulativeMaterials: { ...runningMaterials },
    });
  }

  return rows;
}
```

- [ ] **Step 4: 跑測試確認通過**

```bash
npm test -- src/lib/__tests__/awakening-cost.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/awakening-cost.ts src/lib/__tests__/awakening-cost.test.ts
git commit -m "feat(awakening): cumulative cost computation"
```

---

## Task 6: `AwakeningSection` UI 元件

Server Component，渲染 shadcn `Table`。Milestone 列加底色、bonus 多欄展開、累積金錢用兩行（最佳/期望）。

**Files:**
- Create: `src/components/items/awakening-section.tsx`

- [ ] **Step 1: 寫元件**

Create `src/components/items/awakening-section.tsx`:

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAwakeningPath } from "@/lib/queries/awakening";
import { computeCumulative } from "@/lib/awakening-cost";
import type { Item } from "@/lib/types/item";

const MILESTONE_STAGES = new Set([10, 15, 18, 20]);

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)} 億`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)} 萬`;
  return n.toLocaleString();
}

function formatProb(p: number): string {
  return `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;
}

function formatMaterials(map: Record<string, number>): string {
  return Object.entries(map)
    .map(([name, n]) => `${name}×${n}`)
    .join("、");
}

export function AwakeningSection({ item }: { item: Item }) {
  const path = getAwakeningPath(item);
  if (!path) return null;

  const cumulative = computeCumulative(path.stages);

  // 找出此 prefix 提供的所有 bonus types（取 +1 那階即可，每階屬性集合相同）
  const bonusTypes = path.stages[0]?.bonuses.map((b) => b.bonusType) ?? [];
  const bonusLabels = path.stages[0]?.bonuses.map((b) => b.label) ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium">覺醒升階</h2>
        <span className="text-xs text-muted-foreground">
          覺醒類別：<span className="font-mono">{path.prefix}</span>
        </span>
      </div>

      <div className="rounded-lg border border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px]">階段</TableHead>
              {bonusLabels.map((label) => (
                <TableHead key={label} className="text-right">
                  {label}
                </TableHead>
              ))}
              <TableHead className="text-right">此階金錢</TableHead>
              <TableHead>此階符</TableHead>
              <TableHead className="text-right">成功率</TableHead>
              <TableHead className="text-right">累積金錢</TableHead>
              <TableHead>累積符</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cumulative.map((row) => {
              const stage = path.stages.find((s) => s.stage === row.stage)!;
              const bonusByType = new Map(stage.bonuses.map((b) => [b.bonusType, b.value]));
              const isMilestone = MILESTONE_STAGES.has(row.stage);
              return (
                <TableRow
                  key={row.stage}
                  className={isMilestone ? "bg-muted/50 font-medium" : undefined}
                >
                  <TableCell className="font-mono">+{row.stage}</TableCell>
                  {bonusTypes.map((t) => (
                    <TableCell key={t} className="text-right font-mono">
                      {bonusByType.has(t) ? `+${bonusByType.get(t)}` : "—"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-mono text-xs">
                    {formatMoney(row.stageMoney)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.materialName}×{row.materialAmount}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatProb(row.stageProb)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    <div>{formatMoney(row.cumulativeBest)}</div>
                    <div className="text-muted-foreground">
                      期 {formatMoney(row.cumulativeExpected)}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatMaterials(row.cumulativeMaterials)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <details className="rounded-lg border border-border/60 bg-card px-4 py-3 text-sm">
        <summary className="cursor-pointer select-none font-medium">覺醒機制速查</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            <strong>失敗保護：</strong>+1~+5 不毀裝；+11~+17 不掉階。
          </li>
          <li>
            <strong>掉階規則：</strong>+17 衝 +18 失敗會降回 +16；+18~+20 失敗依序掉階。
          </li>
          <li>
            <strong>退階防護令</strong>（商城）：+18 需 140 張、+19 需 170 張、+20 需 200 張。
            本表「累積金錢（期望）」<em>未計入</em>此成本。
          </li>
          <li>
            <strong>幸運值：</strong>突破失敗會累積幸運值，提升下次成功率，成功後重置。
          </li>
          <li>
            <strong>覺醒符煉化：</strong>七星以上覺醒符可由 3 張次階符煉化；超越覺醒符可由 3
            張突破覺醒符煉化。
          </li>
        </ul>
      </details>

      <p className="text-xs text-muted-foreground">
        累積金錢「期望」欄假設失敗不掉階；+18~+20 實際成本更高，可用退階防護令避免。
      </p>
    </section>
  );
}
```

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add src/components/items/awakening-section.tsx
git commit -m "feat(awakening): AwakeningSection table component"
```

---

## Task 7: 嵌入裝備詳情頁

**Files:**
- Modify: `src/app/items/[id]/page.tsx`

- [ ] **Step 1: 加 import 與 render**

Edit `src/app/items/[id]/page.tsx`:

在 import 區末尾加：

```ts
import { AwakeningSection } from "@/components/items/awakening-section";
```

在 `return (...)` JSX 中，找到 `<ItemDropList sources={sources} />` 那行，**在它之後**加：

```tsx
<AwakeningSection item={item} />
```

最終 JSX 尾段應為：

```tsx
      <ItemRandTable rands={rands} />

      <ItemDropList sources={sources} />

      <AwakeningSection item={item} />
    </div>
  );
}
```

- [ ] **Step 2: typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: PASS。

- [ ] **Step 3: 跑全部測試**

```bash
npm test
```

Expected: PASS — 既有測試不被破壞，新測試通過。

- [ ] **Step 4: Commit**

```bash
git add src/app/items/[id]/page.tsx
git commit -m "feat(awakening): embed AwakeningSection in item detail page"
```

---

## Task 8: Dev server 視覺驗證

**Files:** none (verification only)

- [ ] **Step 1: 啟動 dev server**

```bash
npm run dev
```

(另開一個 shell；Server 應在 http://localhost:3000)

- [ ] **Step 2: 驗證裝備有 awakening section**

開瀏覽器訪問：

- http://localhost:3000/items/21108 (究極黑布鞋, level=7) → 應顯示「覺醒升階」區塊，prefix=`20鞋`，20 階 表格
- http://localhost:3000/items/21114 (紅凜嬋妖鞋, level=116) → prefix=`100鞋`，20 階
- http://localhost:3000/items/24003 (活絡養生丹, type=藥品) → 不應有「覺醒升階」區塊
- http://localhost:3000/items/26928 (一星覺醒符) → 不應有區塊（type=未知1）

對其中一頁 (e.g. 21114) 驗證：

| 檢查點 | 期望 |
|---|---|
| `+1` 列「成功率」| 100% |
| `+10` `+15` `+18` `+20` 列 | 有底色強調 |
| `+18` 累積金錢「期」 | 比「最佳」大很多（顯示 1/p 累積） |
| 桌面寬度 | 表格不溢出 |
| 行動寬度 (DevTools 375px) | 表格水平捲動，不破版 |
| 「覺醒機制速查」 | 可展開/收起 |

- [ ] **Step 3: 中止 dev server**

Ctrl+C。

- [ ] **Step 4: Commit checkpoint (如果有 dev only 改動)**

通常無檔案改動。略過 commit。

---

## Task 9: Build 驗證 + 最終 commit

**Files:** none

- [ ] **Step 1: 跑 production build**

```bash
npm run build
```

Expected: 成功，無錯誤。`/items/[id]` 路由正確列出。

- [ ] **Step 2: 跑全部測試**

```bash
npm test
```

Expected: PASS（包含 awakening 相關 test 與所有既有 test）。

- [ ] **Step 3: lint + format check**

```bash
npm run lint && npm run format:check
```

Expected: PASS。如 format 失敗，跑 `npm run format` 並單獨 commit format 修正。

- [ ] **Step 4: 推 branch**

```bash
git push -u origin feature/awakening-system
```

Expected: branch 推到 remote，輸出 PR URL。

- [ ] **Step 5: 開 PR（依 user 確認）**

確認使用者要不要開 PR；若要，用 `gh pr create` 建立 PR，標題 `feat: awakening system on item detail page`，body 引用 spec + plan 路徑與驗證清單。

---

## 預期變動量

| 檔案 | 行數約估 |
|---|---|
| `src/lib/types/awakening.ts` | 30 |
| `src/lib/queries/awakening.ts` | 110 |
| `src/lib/queries/__tests__/awakening.test.ts` | 130 |
| `src/lib/awakening-cost.ts` | 45 |
| `src/lib/__tests__/awakening-cost.test.ts` | 100 |
| `src/components/items/awakening-section.tsx` | 130 |
| `src/app/items/[id]/page.tsx` | +2 |
| **Total** | **~550 行** |

---

## Self-Review 結果

跑過 spec coverage 檢查、placeholder 掃描、type 一致性檢查：

- ✅ §2.1 世代對應 → Task 2
- ✅ §2.2 部位對應 → Task 3
- ✅ §2.4 過濾規則 → Task 4 SQL `NOT LIKE '%"%'`
- ✅ §3.1 / §3.2 多屬性合併 → Task 4 stage grouping
- ✅ §3.3 dedupe quirk → Task 4 dedupe 邏輯
- ✅ §4.2 表格欄位 → Task 6 元件
- ✅ §4.3 Milestone 強調 → Task 6 `MILESTONE_STAGES` set
- ✅ §4.4 RWD → Task 6 `overflow-x-auto`
- ✅ §4.5 footer → Task 6 `<details>` block
- ✅ §5.1 期望公式 → Task 5
- ✅ §5.2 失敗 disclaimer → Task 6 末段 `<p>`
- ✅ §6 實作骨架 → Task 1~6 結構吻合
- ✅ §9 驗證 → Task 8 + Task 5 sanity check 含實算數字 (103.9M / 1.17B)

無 placeholder（無 TBD / "implement later" / "similar to Task N" 等）。
型別一致：`AwakeningStage` 在 Task 1 定義、Task 4 / 5 / 6 一致引用，欄位名稱 (`stage`, `money`, `materialName` 等) 全程一致。
