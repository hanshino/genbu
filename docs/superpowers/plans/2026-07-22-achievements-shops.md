# 成就圖鑑 + NPC 商店 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 呈現 tthol.sqlite 新增的成就系統(1,266 筆)與 NPC 商店(89 家):`/achievements` 成就圖鑑、`/shops` 商店頁、道具詳細頁「商店販售」區塊、changelog 註冊。

**Architecture:** 沿用既有三層模式 — `src/lib/queries/*`(better-sqlite3 唯讀查詢,Server Components only)→ `src/app/*/page.tsx`(server 渲染,URL searchParams 驅動篩選)→ `src/components/*`(小型元件)。成就獎勵解碼為純函式(`src/lib/format/achievement.ts`),可單元測試。

**Tech Stack:** Next.js App Router、TypeScript、better-sqlite3、Tailwind + shadcn/ui(`Badge`/`Input`/`Table`)、vitest。

**Spec:** `docs/superpowers/specs/2026-07-22-achievements-shops-design.md`(獎勵解碼實證表在 §2.1,必讀)

## Global Constraints

- 所有使用者可見文字用**繁體中文(zh-tw)**。
- `tthol.sqlite` **唯讀**,禁止任何寫入;查詢一律經 `getDb()`(`src/lib/db.ts`)。
- 查詢只能在 Server Components / Route Handlers 使用,**不得** import 進 client component。
- UI 元件順序:shadcn(`src/components/ui/`)→ base-ui → lucide-react icon;**禁止** Unicode glyph/emoji 當 icon。
- 測試直接打真實 `tthol.sqlite`(專案既有慣例,見 `src/lib/queries/__tests__/status.test.ts`)。
- 單檔測試指令:`npm test -- src/lib/queries/__tests__/achievements.test.ts`(= `vitest run <path>`)。
- Commit 訊息用 conventional commits,結尾加 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。

## File Structure

```
Create:
  src/lib/types/achievement.ts                成就型別
  src/lib/constants/achievement.ts            貨幣名稱對照(佔位)
  src/lib/format/achievement.ts               formatReward 純函式
  src/lib/format/__tests__/achievement.test.ts
  src/lib/queries/achievements.ts             成就查詢
  src/lib/queries/__tests__/achievements.test.ts
  src/lib/types/shop.ts                       商店型別
  src/lib/constants/shop.ts                   武器店 ID/城池名/標籤
  src/lib/queries/shops.ts                    商店查詢
  src/lib/queries/__tests__/shops.test.ts
  src/app/achievements/page.tsx               成就圖鑑頁
  src/components/achievements/achievement-search.tsx   搜尋框(client)
  src/components/achievements/achievement-row.tsx      成就列(server)
  src/app/shops/page.tsx                      商店列表頁
  src/app/shops/[id]/page.tsx                 商店詳細頁
  src/components/items/shop-availability-section.tsx   道具頁商店區塊
Modify:
  src/app/items/[id]/page.tsx                 插入 ShopAvailabilitySection
  src/components/layout/navbar.tsx            資料庫群組 +2 連結
  src/app/page.tsx                            首頁 +2 張卡
  src/lib/changelog/config.ts                 PROFILES +6 表
```

---

### Task 1: 成就型別、貨幣常數與 formatReward

**Files:**
- Create: `src/lib/types/achievement.ts`
- Create: `src/lib/constants/achievement.ts`
- Create: `src/lib/format/achievement.ts`
- Test: `src/lib/format/__tests__/achievement.test.ts`

**Interfaces:**
- Consumes: 無(最底層)
- Produces:
  - `AchievementRow`、`AchievementCategory`、`AchievementSubCat`、`AchievementSearchRow`、`AchievementReward`(型別,Task 2/4 使用)
  - `formatReward(row): AchievementReward | null`(Task 4 使用)
  - `REWARD_CURRENCY_NAMES: Record<number, string>`

- [ ] **Step 1: 建立型別檔**

`src/lib/types/achievement.ts`:

```ts
export interface AchievementSubCat {
  id: number;
  name: string;
  count: number;
  totalPoints: number;
}

export interface AchievementCategory {
  id: number;
  name: string;
  subCats: AchievementSubCat[];
}

/** 解碼後的獎勵呈現;href 存在時渲染為連結。 */
export interface AchievementReward {
  label: string;
  href?: string;
}

export interface AchievementRow {
  id: number;
  subCatId: number;
  groupNo: number;
  name: string;
  description: string | null;
  points: number;
  resetType: number;
  rewardType: number;
  rewardId: number;
  rewardAmount: number;
  /** join items(type 2)/ magic(type 5)取得的獎勵名稱 */
  rewardName: string | null;
  /** 前置成就名(全表僅 8 筆非零) */
  prereqName: string | null;
}

/** 搜尋結果列:額外帶分類資訊 */
export interface AchievementSearchRow extends AchievementRow {
  subCatName: string;
  categoryName: string;
}
```

- [ ] **Step 2: 建立貨幣常數檔**

`src/lib/constants/achievement.ts`:

```ts
/**
 * reward_type=1 的貨幣 id → 名稱。
 * 遊戲內正名待考證(使用者後續提供),先以編號呈現;
 * 補上名稱時只改這裡,頁面自動生效。
 */
export const REWARD_CURRENCY_NAMES: Record<number, string> = {
  1: "貨幣 #1",
  2: "貨幣 #2",
  3: "貨幣 #3",
  7: "貨幣 #7",
};
```

- [ ] **Step 3: 寫 failing test**

`src/lib/format/__tests__/achievement.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatReward } from "../achievement";

// reward_type 語意見 spec §2.1(已用真實資料實證)
describe("formatReward", () => {
  it("type 0 無獎勵 → null", () => {
    expect(
      formatReward({ rewardType: 0, rewardId: 0, rewardAmount: 0, rewardName: null }),
    ).toBeNull();
  });

  it("type 1 貨幣 → 佔位名稱 ×數量,無連結", () => {
    const r = formatReward({ rewardType: 1, rewardId: 7, rewardAmount: 10, rewardName: null });
    expect(r).toEqual({ label: "貨幣 #7 ×10" });
  });

  it("type 2 道具 → 名稱 ×數量 + /items 連結(實例:富可敵國 → 百萬官幣×50)", () => {
    const r = formatReward({
      rewardType: 2,
      rewardId: 24086,
      rewardAmount: 50,
      rewardName: "百萬官幣",
    });
    expect(r).toEqual({ label: "百萬官幣 ×50", href: "/items/24086" });
  });

  it("type 3 銀兩 → 千分位金額,無連結", () => {
    const r = formatReward({ rewardType: 3, rewardId: 1, rewardAmount: 500000, rewardName: null });
    expect(r).toEqual({ label: "銀兩 ×500,000" });
  });

  it("type 5 屬性加成 → magic 名稱 + /skills 連結(實例:初窺門徑 → 物攻增加)", () => {
    const r = formatReward({
      rewardType: 5,
      rewardId: 1183,
      rewardAmount: 1,
      rewardName: "物攻增加",
    });
    expect(r).toEqual({ label: "物攻增加", href: "/skills/1183" });
  });

  it("join 不到名稱時 fallback 顯示 #id,不擲錯", () => {
    const r = formatReward({ rewardType: 2, rewardId: 99999, rewardAmount: 1, rewardName: null });
    expect(r).toEqual({ label: "#99999 ×1", href: "/items/99999" });
  });

  it("未知 reward_type 保底顯示,不擲錯", () => {
    const r = formatReward({ rewardType: 4, rewardId: 123, rewardAmount: 2, rewardName: null });
    expect(r).toEqual({ label: "獎勵 #4（#123 ×2）" });
  });
});
```

- [ ] **Step 4: 跑測試確認 fail**

Run: `npm test -- src/lib/format/__tests__/achievement.test.ts`
Expected: FAIL — `Cannot find module '../achievement'`(或同義的解析錯誤)

- [ ] **Step 5: 實作 formatReward**

`src/lib/format/achievement.ts`:

```ts
import { REWARD_CURRENCY_NAMES } from "@/lib/constants/achievement";
import type { AchievementReward, AchievementRow } from "@/lib/types/achievement";

/**
 * 解碼成就獎勵欄位為可呈現的文字/連結。
 * reward_type:0=無獎勵、1=貨幣、2=道具、3=銀兩、5=永久屬性加成(magic)。
 * 未知 type 保底顯示原始編號,不擲錯。
 */
export function formatReward(
  row: Pick<AchievementRow, "rewardType" | "rewardId" | "rewardAmount" | "rewardName">,
): AchievementReward | null {
  const { rewardType, rewardId, rewardAmount, rewardName } = row;
  const amount = rewardAmount.toLocaleString("zh-TW");
  switch (rewardType) {
    case 0:
      return null;
    case 1:
      return { label: `${REWARD_CURRENCY_NAMES[rewardId] ?? `貨幣 #${rewardId}`} ×${amount}` };
    case 2:
      return { label: `${rewardName ?? `#${rewardId}`} ×${amount}`, href: `/items/${rewardId}` };
    case 3:
      return { label: `銀兩 ×${amount}` };
    case 5:
      return { label: rewardName ?? `#${rewardId}`, href: `/skills/${rewardId}` };
    default:
      return { label: `獎勵 #${rewardType}（#${rewardId} ×${rewardAmount}）` };
  }
}
```

- [ ] **Step 6: 跑測試確認 pass**

Run: `npm test -- src/lib/format/__tests__/achievement.test.ts`
Expected: PASS(7 tests)

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/achievement.ts src/lib/constants/achievement.ts src/lib/format/achievement.ts src/lib/format/__tests__/achievement.test.ts
git commit -m "feat(achievements): add types, currency constants, reward formatter

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: 成就查詢模組

**Files:**
- Create: `src/lib/queries/achievements.ts`
- Test: `src/lib/queries/__tests__/achievements.test.ts`

**Interfaces:**
- Consumes: `getDb()`(`@/lib/db`)、Task 1 型別
- Produces(Task 4 使用):
  - `getAchievementCategories(): AchievementCategory[]`
  - `getAchievementsByCategory(categoryId: number): AchievementRow[]`
  - `searchAchievements(keyword: string): AchievementSearchRow[]`
  - `ACHIEVEMENT_SEARCH_LIMIT = 100`

- [ ] **Step 1: 寫 failing test**

`src/lib/queries/__tests__/achievements.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  getAchievementCategories,
  getAchievementsByCategory,
  searchAchievements,
  ACHIEVEMENT_SEARCH_LIMIT,
} from "../achievements";

describe("getAchievementCategories", () => {
  it("回傳 9 個大分類,依 sort_order 排序,首位為功名錄", () => {
    const cats = getAchievementCategories();
    expect(cats).toHaveLength(9);
    expect(cats[0].id).toBe(1);
    expect(cats[0].name).toBe("功名錄");
  });

  it("功名錄含 3 個子分類;成就點數(101)有 7 筆、共 70 點", () => {
    const cats = getAchievementCategories();
    const sub = cats[0].subCats;
    expect(sub.map((s) => s.id)).toEqual([101, 102, 103]);
    const points = sub.find((s) => s.id === 101)!;
    expect(points.count).toBe(7);
    expect(points.totalPoints).toBe(70);
  });
});

describe("getAchievementsByCategory", () => {
  it("功名錄(cat 1)共 51 筆,依子分類排序", () => {
    const rows = getAchievementsByCategory(1);
    expect(rows).toHaveLength(51);
    expect(rows[0].subCatId).toBe(101);
  });

  it("解碼欄位齊全:id 1 初有所成 = 5 點、貨幣獎勵(type 1, id 7, ×1)", () => {
    const rows = getAchievementsByCategory(1);
    const a = rows.find((r) => r.id === 1)!;
    expect(a.name).toBe("初有所成");
    expect(a.points).toBe(5);
    expect(a.rewardType).toBe(1);
    expect(a.rewardId).toBe(7);
    expect(a.rewardAmount).toBe(1);
  });

  it("type 5 獎勵 join magic 取得名稱(初窺門徑 → 物攻增加)", () => {
    // 初窺門徑在功名錄 > 奇功(sub_cat 102)
    const rows = getAchievementsByCategory(1);
    const a = rows.find((r) => r.name === "初窺門徑")!;
    expect(a.rewardType).toBe(5);
    expect(a.rewardName).toBe("物攻增加");
  });

  it("前置成就 self-join 取得名稱(嶄露頭角 → 前置:初有所成)", () => {
    const rows = getAchievementsByCategory(1);
    const a = rows.find((r) => r.name === "嶄露頭角")!;
    expect(a.prereqName).toBe("初有所成");
  });

  it("不存在的分類回傳空陣列", () => {
    expect(getAchievementsByCategory(99999)).toEqual([]);
  });
});

describe("searchAchievements", () => {
  it("跨分類搜尋名稱+描述並附分類名(關鍵字:銀兩 → 5 筆)", () => {
    const rows = searchAchievements("銀兩");
    expect(rows).toHaveLength(5);
    for (const r of rows) {
      expect(r.categoryName.length).toBeGreaterThan(0);
      expect(r.subCatName.length).toBeGreaterThan(0);
    }
  });

  it("結果 cap 在 ACHIEVEMENT_SEARCH_LIMIT(關鍵字:成)", () => {
    const rows = searchAchievements("成");
    expect(rows).toHaveLength(ACHIEVEMENT_SEARCH_LIMIT);
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npm test -- src/lib/queries/__tests__/achievements.test.ts`
Expected: FAIL — `Cannot find module '../achievements'`

- [ ] **Step 3: 實作查詢模組**

`src/lib/queries/achievements.ts`:

```ts
import { getDb } from "@/lib/db";
import type {
  AchievementCategory,
  AchievementRow,
  AchievementSearchRow,
} from "@/lib/types/achievement";

export const ACHIEVEMENT_SEARCH_LIMIT = 100;

/**
 * 共用的成就列 SELECT。
 * - reward_type=2 join items、reward_type=5 join magic 取獎勵名稱;
 *   magic 同 id 每等級一列(名稱一致),取 MIN(level) 那列避免重複。
 * - prereq 以 self-join 子查詢取名稱。
 */
const ROW_SELECT = `
  SELECT a.id,
         a.sub_cat_id    AS subCatId,
         a.group_no      AS groupNo,
         a.name,
         a.description,
         a.points,
         a.reset_type    AS resetType,
         a.reward_type   AS rewardType,
         a.reward_id     AS rewardId,
         a.reward_amount AS rewardAmount,
         CASE a.reward_type
           WHEN 2 THEN (SELECT i.name FROM items i WHERE i.id = a.reward_id)
           WHEN 5 THEN (SELECT m.name FROM magic m WHERE m.id = a.reward_id
                        ORDER BY m.level LIMIT 1)
         END AS rewardName,
         (SELECT p.name FROM achievements p WHERE p.id = a.prereq_achievement_id) AS prereqName
`;

/** 大分類 + 子分類(含筆數、點數加總),供 Tabs 與分節標題一次取回。 */
export function getAchievementCategories(): AchievementCategory[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.id           AS categoryId,
              c.name         AS categoryName,
              sc.id          AS subCatId,
              sc.name        AS subCatName,
              COUNT(a.id)    AS count,
              COALESCE(SUM(a.points), 0) AS totalPoints
       FROM achievement_categories c
       JOIN achievement_sub_cats sc ON sc.category_id = c.id
       LEFT JOIN achievements a ON a.sub_cat_id = sc.id
       GROUP BY sc.id
       ORDER BY c.sort_order, sc.sort_order, sc.id`,
    )
    .all() as Array<{
    categoryId: number;
    categoryName: string;
    subCatId: number;
    subCatName: string;
    count: number;
    totalPoints: number;
  }>;

  const cats: AchievementCategory[] = [];
  for (const r of rows) {
    let cat = cats.at(-1);
    if (!cat || cat.id !== r.categoryId) {
      cat = { id: r.categoryId, name: r.categoryName, subCats: [] };
      cats.push(cat);
    }
    cat.subCats.push({
      id: r.subCatId,
      name: r.subCatName,
      count: r.count,
      totalPoints: r.totalPoints,
    });
  }
  return cats;
}

/** 某大分類的全部成就,依子分類 → group_no → id 排序。 */
export function getAchievementsByCategory(categoryId: number): AchievementRow[] {
  const db = getDb();
  return db
    .prepare(
      `${ROW_SELECT}
       FROM achievements a
       JOIN achievement_sub_cats sc ON sc.id = a.sub_cat_id
       WHERE sc.category_id = ?
       ORDER BY sc.sort_order, sc.id, a.group_no, a.id`,
    )
    .all(categoryId) as AchievementRow[];
}

/** 跨全分類搜尋名稱+描述,附分類名,上限 ACHIEVEMENT_SEARCH_LIMIT。 */
export function searchAchievements(keyword: string): AchievementSearchRow[] {
  const kw = keyword.trim();
  if (!kw) return [];
  const db = getDb();
  const like = `%${kw}%`;
  return db
    .prepare(
      `${ROW_SELECT},
         sc.name AS subCatName,
         c.name  AS categoryName
       FROM achievements a
       JOIN achievement_sub_cats sc ON sc.id = a.sub_cat_id
       JOIN achievement_categories c ON c.id = sc.category_id
       WHERE a.name LIKE ? OR a.description LIKE ?
       ORDER BY c.sort_order, sc.sort_order, a.id
       LIMIT ${ACHIEVEMENT_SEARCH_LIMIT}`,
    )
    .all(like, like) as AchievementSearchRow[];
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npm test -- src/lib/queries/__tests__/achievements.test.ts`
Expected: PASS(9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/achievements.ts src/lib/queries/__tests__/achievements.test.ts
git commit -m "feat(achievements): add achievement query module

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 商店型別、常數與查詢模組

**Files:**
- Create: `src/lib/types/shop.ts`
- Create: `src/lib/constants/shop.ts`
- Create: `src/lib/queries/shops.ts`
- Test: `src/lib/queries/__tests__/shops.test.ts`

**Interfaces:**
- Consumes: `getDb()`
- Produces(Task 4/5/6 使用):
  - 型別 `ShopKind`、`ShopSummary`、`ShopDetail`、`ShopSellEntry`、`ShopBuyEntry`、`ItemShopSale`、`ItemShopBuy`
  - `WEAPON_SHOP_IDS: Set<number>`、`shopKindOf(id): ShopKind`、`SHOP_KIND_LABELS`、`castleLabel(id): string`、`shopTitle(id): string`
  - `getShops(): ShopSummary[]`、`getShopDetail(id): ShopDetail | null`
  - `getShopsSellingItem(itemId): ItemShopSale[]`、`getShopsBuyingItem(itemId): ItemShopBuy[]`

- [ ] **Step 1: 建立型別檔**

`src/lib/types/shop.ts`:

```ts
export type ShopKind = "weapon" | "item";

export interface ShopSummary {
  id: number;
  kind: ShopKind;
  castleId: number | null;
  sellCount: number;
  buyCount: number;
}

export interface ShopSellEntry {
  itemId: number;
  itemName: string | null;
  itemType: string | null;
  price: number;
}

export interface ShopBuyEntry {
  itemId: number;
  itemName: string | null;
  rate: number;
}

export interface ShopDetail {
  id: number;
  kind: ShopKind;
  castleId: number | null;
  sells: ShopSellEntry[];
  buys: ShopBuyEntry[];
}

/** 道具頁「商店販售」列 */
export interface ItemShopSale {
  shopId: number;
  kind: ShopKind;
  castleId: number | null;
  price: number;
}

/** 道具頁「商店收購」列 */
export interface ItemShopBuy {
  shopId: number;
  kind: ShopKind;
  castleId: number | null;
  rate: number;
}
```

- [ ] **Step 2: 建立常數檔**

`src/lib/constants/shop.ts`:

```ts
import type { ShopKind } from "@/lib/types/shop";

/**
 * SHOP.INI 僅有的兩行區段註解:「// 武器店」與「// 道具店」。
 * 武器店區段的商店 id 如下(依 INI 出現順序),其餘 77 家為道具店。
 */
export const WEAPON_SHOP_IDS = new Set([9, 1, 2, 6, 3, 4, 5, 11, 41, 43, 48, 50]);

export function shopKindOf(id: number): ShopKind {
  return WEAPON_SHOP_IDS.has(id) ? "weapon" : "item";
}

export const SHOP_KIND_LABELS: Record<ShopKind, string> = {
  weapon: "武器店",
  item: "道具店",
};

/** castle_id → 城池名。正名待考證(使用者後續提供),先以編號呈現。 */
export const CASTLE_NAMES: Record<number, string> = {
  1: "城池 #1",
  2: "城池 #2",
  3: "城池 #3",
  4: "城池 #4",
};

export function castleLabel(castleId: number): string {
  return CASTLE_NAMES[castleId] ?? `城池 #${castleId}`;
}

/** 商店暫無名稱資料(SHOP.INI 無 name 欄),統一以編號呈現。 */
export function shopTitle(id: number): string {
  return `商店 #${id}`;
}
```

- [ ] **Step 3: 寫 failing test**

`src/lib/queries/__tests__/shops.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getShops, getShopDetail, getShopsSellingItem, getShopsBuyingItem } from "../shops";

describe("getShops", () => {
  it("回傳 89 家商店:武器店 12 家、道具店 77 家", () => {
    const shops = getShops();
    expect(shops).toHaveLength(89);
    expect(shops.filter((s) => s.kind === "weapon")).toHaveLength(12);
    expect(shops.filter((s) => s.kind === "item")).toHaveLength(77);
  });

  it("商店 9(SHOP.INI 首家武器店)賣 13 種、收 1 種", () => {
    const s = getShops().find((x) => x.id === 9)!;
    expect(s.kind).toBe("weapon");
    expect(s.sellCount).toBe(13);
    expect(s.buyCount).toBe(1);
  });
});

describe("getShopDetail", () => {
  it("商店 9:販售含青銅刀(20001)150 銀,收購青銅刀 20%", () => {
    const d = getShopDetail(9)!;
    expect(d.sells).toHaveLength(13);
    const sword = d.sells.find((e) => e.itemId === 20001)!;
    expect(sword.itemName).toBe("青銅刀");
    expect(sword.price).toBe(150);
    expect(d.buys).toHaveLength(1);
    expect(d.buys[0]).toMatchObject({ itemId: 20001, rate: 20 });
  });

  it("不存在的商店回傳 null", () => {
    expect(getShopDetail(99999)).toBeNull();
  });
});

describe("getShopsSellingItem", () => {
  it("青銅刀(20001)由 2 家販售,依價格排序(130 → 150)", () => {
    const rows = getShopsSellingItem(20001);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ shopId: 2, price: 130 });
    expect(rows[1]).toMatchObject({ shopId: 9, price: 150 });
  });

  it("無人販售的道具回傳空陣列", () => {
    expect(getShopsSellingItem(999999)).toEqual([]);
  });
});

describe("getShopsBuyingItem", () => {
  it("青銅刀(20001)由 4 家收購,rate 皆 20", () => {
    const rows = getShopsBuyingItem(20001);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.shopId).sort((a, b) => a - b)).toEqual([1, 2, 6, 9]);
    for (const r of rows) expect(r.rate).toBe(20);
  });
});
```

- [ ] **Step 4: 跑測試確認 fail**

Run: `npm test -- src/lib/queries/__tests__/shops.test.ts`
Expected: FAIL — `Cannot find module '../shops'`

- [ ] **Step 5: 實作查詢模組**

`src/lib/queries/shops.ts`:

```ts
import { getDb } from "@/lib/db";
import { shopKindOf } from "@/lib/constants/shop";
import type {
  ItemShopBuy,
  ItemShopSale,
  ShopDetail,
  ShopSummary,
} from "@/lib/types/shop";

/** 全部商店 + 販售/收購種數彙總,依 id 排序。 */
export function getShops(): ShopSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.id,
              s.castle_id AS castleId,
              (SELECT COUNT(*) FROM shop_sells ss WHERE ss.shop_id = s.id) AS sellCount,
              (SELECT COUNT(*) FROM shop_buys sb WHERE sb.shop_id = s.id)  AS buyCount
       FROM shops s
       ORDER BY s.id`,
    )
    .all() as Array<{ id: number; castleId: number | null; sellCount: number; buyCount: number }>;
  return rows.map((r) => ({ ...r, kind: shopKindOf(r.id) }));
}

/** 單一商店 + 販售(依價格)與收購清單;不存在回傳 null。 */
export function getShopDetail(id: number): ShopDetail | null {
  const db = getDb();
  const shop = db
    .prepare(`SELECT id, castle_id AS castleId FROM shops WHERE id = ?`)
    .get(id) as { id: number; castleId: number | null } | undefined;
  if (!shop) return null;

  const sells = db
    .prepare(
      `SELECT ss.item_id  AS itemId,
              i.name      AS itemName,
              i.type_name AS itemType,
              ss.price
       FROM shop_sells ss
       LEFT JOIN items i ON i.id = ss.item_id
       WHERE ss.shop_id = ?
       ORDER BY ss.price, ss.item_id`,
    )
    .all(id) as ShopDetail["sells"];

  const buys = db
    .prepare(
      `SELECT sb.item_id AS itemId,
              i.name     AS itemName,
              sb.rate
       FROM shop_buys sb
       LEFT JOIN items i ON i.id = sb.item_id
       WHERE sb.shop_id = ?
       ORDER BY sb.item_id`,
    )
    .all(id) as ShopDetail["buys"];

  return { id: shop.id, castleId: shop.castleId, kind: shopKindOf(shop.id), sells, buys };
}

/** 販售此道具的商店(道具頁用),依價格排序。 */
export function getShopsSellingItem(itemId: number): ItemShopSale[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT ss.shop_id  AS shopId,
              s.castle_id AS castleId,
              ss.price
       FROM shop_sells ss
       JOIN shops s ON s.id = ss.shop_id
       WHERE ss.item_id = ?
       ORDER BY ss.price, ss.shop_id`,
    )
    .all(itemId) as Array<{ shopId: number; castleId: number | null; price: number }>;
  return rows.map((r) => ({ ...r, kind: shopKindOf(r.shopId) }));
}

/** 收購此道具的商店(道具頁用),依 rate 高→低排序。 */
export function getShopsBuyingItem(itemId: number): ItemShopBuy[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT sb.shop_id  AS shopId,
              s.castle_id AS castleId,
              sb.rate
       FROM shop_buys sb
       JOIN shops s ON s.id = sb.shop_id
       WHERE sb.item_id = ?
       ORDER BY sb.rate DESC, sb.shop_id`,
    )
    .all(itemId) as Array<{ shopId: number; castleId: number | null; rate: number }>;
  return rows.map((r) => ({ ...r, kind: shopKindOf(r.shopId) }));
}
```

- [ ] **Step 6: 跑測試確認 pass**

Run: `npm test -- src/lib/queries/__tests__/shops.test.ts`
Expected: PASS(7 tests)

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/shop.ts src/lib/constants/shop.ts src/lib/queries/shops.ts src/lib/queries/__tests__/shops.test.ts
git commit -m "feat(shops): add shop types, constants, query module

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `/achievements` 成就圖鑑頁

**Files:**
- Create: `src/components/achievements/achievement-search.tsx`
- Create: `src/components/achievements/achievement-row.tsx`
- Create: `src/app/achievements/page.tsx`

**Interfaces:**
- Consumes: Task 1 `formatReward` / 型別、Task 2 查詢函式
- Produces: `/achievements` 頁面(`?cat=<大分類id>&search=<關鍵字>`)

- [ ] **Step 1: 建立搜尋框(client component)**

`src/components/achievements/achievement-search.tsx`(仿 `skill-filters.tsx` 的 debounce+URL 模式):

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { track } from "@/lib/analytics/track";

export function AchievementSearch({ initialSearch }: { initialSearch: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const next = search.trim();
      if (next) params.set("search", next);
      else params.delete("search");
      if (params.toString() === searchParams.toString()) return;
      const qs = params.toString();
      startTransition(() => {
        router.push(`/achievements${qs ? `?${qs}` : ""}`);
      });
      if (next.length > 0) {
        track("search_submit", { scope: "achievements", query_len: next.length, has_filter: false });
      }
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <Input
      placeholder="搜尋成就名稱或描述..."
      aria-label="搜尋成就名稱或描述"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      inputMode="search"
      className="sm:max-w-xs"
    />
  );
}
```

- [ ] **Step 2: 建立成就列(server component)**

`src/components/achievements/achievement-row.tsx`(成就無詳細頁,列為純 `<li>`,視覺對齊 `LinkListSection`):

```tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatReward } from "@/lib/format/achievement";
import type { AchievementRow as Row } from "@/lib/types/achievement";

export function AchievementRow({
  achievement,
  categoryLabel,
}: {
  achievement: Row;
  /** 搜尋結果列顯示「大分類 · 子分類」,分類瀏覽時省略 */
  categoryLabel?: string;
}) {
  const a = achievement;
  const reward = formatReward(a);
  return (
    <li className="space-y-1 px-4 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-medium">{a.name}</span>
        {a.points > 0 && (
          <Badge variant="secondary" className="font-normal">
            {a.points} 點
          </Badge>
        )}
        {a.resetType > 0 && (
          <Badge variant="outline" className="font-normal">
            週期重置
          </Badge>
        )}
        {categoryLabel && (
          <span className="ml-auto text-xs text-muted-foreground">{categoryLabel}</span>
        )}
      </div>
      {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
      {reward && (
        <p className="text-xs">
          <span className="text-muted-foreground">獎勵:</span>
          {reward.href ? (
            <Link
              href={reward.href}
              className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
            >
              {reward.label}
            </Link>
          ) : (
            reward.label
          )}
        </p>
      )}
      {a.prereqName && (
        <p className="text-xs text-muted-foreground">前置:{a.prereqName}</p>
      )}
    </li>
  );
}
```

- [ ] **Step 3: 建立頁面**

`src/app/achievements/page.tsx`:

```tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import {
  getAchievementCategories,
  getAchievementsByCategory,
  searchAchievements,
  ACHIEVEMENT_SEARCH_LIMIT,
} from "@/lib/queries/achievements";
import { AchievementSearch } from "@/components/achievements/achievement-search";
import { AchievementRow } from "@/components/achievements/achievement-row";
import type { AchievementRow as Row } from "@/lib/types/achievement";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "成就 · 玄武",
  description: "武林同萌傳全部成就分類瀏覽:點數、描述、獎勵一覽",
};

interface PageProps {
  searchParams: Promise<{ cat?: string; search?: string }>;
}

export default async function AchievementsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = (params.search ?? "").trim();
  const categories = getAchievementCategories();
  const catParam = Number(params.cat);
  const activeCat = categories.find((c) => c.id === catParam) ?? categories[0];

  const total = categories.reduce(
    (sum, c) => sum + c.subCats.reduce((s, sc) => s + sc.count, 0),
    0,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">成就圖鑑</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          共 {total.toLocaleString("zh-TW")} 個成就,依遊戲內分類瀏覽
        </p>
      </header>

      <Suspense fallback={null}>
        <AchievementSearch initialSearch={search} />
      </Suspense>

      {search ? (
        <SearchResults keyword={search} />
      ) : (
        <>
          <nav aria-label="成就分類" className="flex flex-wrap gap-1.5">
            {categories.map((c) => {
              const active = c.id === activeCat.id;
              return (
                <Link
                  key={c.id}
                  href={c.id === categories[0].id ? "/achievements" : `/achievements?cat=${c.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-sm transition-colors",
                    active
                      ? "border-transparent bg-secondary font-medium text-secondary-foreground"
                      : "border-border/60 bg-card hover:bg-muted/50",
                  )}
                >
                  {c.name}
                </Link>
              );
            })}
          </nav>
          <CategorySections categoryId={activeCat.id} />
        </>
      )}

      <p className="text-xs text-muted-foreground">
        資料來自 ACHIEVEMENT.INI。部分獎勵貨幣的遊戲內名稱尚待考證,暫以編號顯示。
      </p>
    </div>
  );
}

function CategorySections({ categoryId }: { categoryId: number }) {
  const categories = getAchievementCategories();
  const cat = categories.find((c) => c.id === categoryId)!;
  const rows = getAchievementsByCategory(categoryId);
  const bySubCat = new Map<number, Row[]>();
  for (const r of rows) {
    const list = bySubCat.get(r.subCatId) ?? [];
    list.push(r);
    bySubCat.set(r.subCatId, list);
  }

  return (
    <div className="space-y-6">
      {cat.subCats.map((sc) => {
        const list = bySubCat.get(sc.id) ?? [];
        if (list.length === 0) return null;
        return (
          <section key={sc.id} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-medium">{sc.name}</h2>
              <span className="text-xs text-muted-foreground">
                {sc.count} 個成就 · 共 {sc.totalPoints} 點
              </span>
            </div>
            <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
              {list.map((a) => (
                <AchievementRow key={a.id} achievement={a} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SearchResults({ keyword }: { keyword: string }) {
  const rows = searchAchievements(keyword);
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">搜尋結果</h2>
        <span className="text-xs text-muted-foreground">
          {rows.length === ACHIEVEMENT_SEARCH_LIMIT
            ? `僅顯示前 ${ACHIEVEMENT_SEARCH_LIMIT} 筆,請縮小關鍵字`
            : `${rows.length} 筆`}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-border/60 bg-card px-4 py-6 text-sm text-muted-foreground">
          找不到符合「{keyword}」的成就。
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
          {rows.map((a) => (
            <AchievementRow
              key={a.id}
              achievement={a}
              categoryLabel={`${a.categoryName} · ${a.subCatName}`}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: typecheck**

Run: `npm run typecheck`
Expected: 無錯誤

- [ ] **Step 5: dev server 驗證**

若 dev server 未啟動:`npm run dev`(background)。然後:

```bash
curl -s "http://localhost:3000/achievements" | grep -o "功名錄" | head -1
curl -s "http://localhost:3000/achievements?cat=5" | grep -o "降魔誅妖" | head -1
curl -s "http://localhost:3000/achievements?search=%E9%8A%80%E5%85%A9" | grep -o "搜尋結果" | head -1
```

Expected: 依序輸出 `功名錄`、`降魔誅妖`、`搜尋結果`

- [ ] **Step 6: Commit**

```bash
git add src/app/achievements src/components/achievements
git commit -m "feat(achievements): add /achievements browse page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `/shops` 商店列表頁 + `/shops/[id]` 詳細頁

**Files:**
- Create: `src/app/shops/page.tsx`
- Create: `src/app/shops/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 3 查詢函式與常數、`LinkListSection`/`LinkListRow`(`@/components/common/link-list`)、`Badge`、`Table` 家族(`@/components/ui/table`)、`BackLink`(`@/components/common/back-link`)
- Produces: `/shops`、`/shops/[id]` 頁面

- [ ] **Step 1: 建立列表頁**

`src/app/shops/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { LinkListRow, LinkListSection } from "@/components/common/link-list";
import { getShops } from "@/lib/queries/shops";
import { SHOP_KIND_LABELS, castleLabel, shopTitle } from "@/lib/constants/shop";
import type { ShopKind, ShopSummary } from "@/lib/types/shop";

export const metadata: Metadata = {
  title: "商店 · 玄武",
  description: "武林同萌傳 NPC 商店販售與收購清單",
};

export default function ShopsPage() {
  const shops = getShops();
  const kinds: ShopKind[] = ["weapon", "item"];

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">NPC 商店</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          共 {shops.length} 家商店;商店暫無名稱與 NPC 對應資料,以編號呈現
        </p>
      </header>

      {kinds.map((kind) => (
        <ShopSection key={kind} kind={kind} shops={shops.filter((s) => s.kind === kind)} />
      ))}

      <p className="text-xs text-muted-foreground">
        資料來自 SHOP.INI;武器店/道具店分類依原始檔案的區段註解。
      </p>
    </div>
  );
}

function ShopSection({ kind, shops }: { kind: ShopKind; shops: ShopSummary[] }) {
  if (shops.length === 0) return null;
  return (
    <LinkListSection title={SHOP_KIND_LABELS[kind]} summary={`${shops.length} 家`}>
      {shops.map((s) => (
        <LinkListRow key={s.id} href={`/shops/${s.id}`}>
          <span className="font-medium">{shopTitle(s.id)}</span>
          {s.castleId != null && (
            <Badge variant="outline" className="font-normal">
              {castleLabel(s.castleId)}
            </Badge>
          )}
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            販售 {s.sellCount} 種{s.buyCount > 0 ? ` · 收購 ${s.buyCount} 種` : ""}
          </span>
        </LinkListRow>
      ))}
    </LinkListSection>
  );
}
```

- [ ] **Step 2: 建立詳細頁**

`src/app/shops/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { BackLink } from "@/components/common/back-link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getShopDetail } from "@/lib/queries/shops";
import { SHOP_KIND_LABELS, castleLabel, shopTitle } from "@/lib/constants/shop";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const shopId = Number(id);
  if (!Number.isInteger(shopId) || shopId <= 0) return { title: "商店 · 玄武" };
  const shop = getShopDetail(shopId);
  if (!shop) return { title: "商店不存在 · 玄武" };
  return {
    title: `${shopTitle(shop.id)} · 商店 · 玄武`,
    description: `${shopTitle(shop.id)}(${SHOP_KIND_LABELS[shop.kind]})的販售與收購清單`,
  };
}

export default async function ShopDetailPage({ params }: PageProps) {
  const { id } = await params;
  const shopId = Number(id);
  if (!Number.isInteger(shopId) || shopId <= 0) notFound();

  const shop = getShopDetail(shopId);
  if (!shop) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <BackLink href="/shops">返回商店列表</BackLink>
      </nav>

      <header className="flex flex-wrap items-baseline gap-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {shopTitle(shop.id)}
        </h1>
        <Badge variant="secondary" className="font-normal">
          {SHOP_KIND_LABELS[shop.kind]}
        </Badge>
        {shop.castleId != null && (
          <Badge variant="outline" className="font-normal">
            {castleLabel(shop.castleId)}
          </Badge>
        )}
      </header>

      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-medium">販售</h2>
          <span className="text-xs text-muted-foreground">{shop.sells.length} 種</span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>道具</TableHead>
                <TableHead>類型</TableHead>
                <TableHead className="text-right">單價</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shop.sells.map((e) => (
                <TableRow key={e.itemId}>
                  <TableCell>
                    <Link
                      href={`/items/${e.itemId}`}
                      className="font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid"
                    >
                      {e.itemName ?? `#${e.itemId}`}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.itemType ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {e.price.toLocaleString("zh-TW")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {shop.buys.length > 0 && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-medium">收購</h2>
            <span className="text-xs text-muted-foreground">{shop.buys.length} 種</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>道具</TableHead>
                  <TableHead className="text-right">收購率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shop.buys.map((e) => (
                  <TableRow key={e.itemId}>
                    <TableCell>
                      <Link
                        href={`/items/${e.itemId}`}
                        className="font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid"
                      >
                        {e.itemName ?? `#${e.itemId}`}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{e.rate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        資料來自 SHOP.INI。商店暫無名稱與 NPC / 地圖對應。收購率推定為道具售價的百分比,
        實際收購價以遊戲內為準。
      </p>
    </div>
  );
}
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`
Expected: 無錯誤

- [ ] **Step 4: dev server 驗證**

```bash
curl -s "http://localhost:3000/shops" | grep -o "武器店" | head -1
curl -s "http://localhost:3000/shops/9" | grep -o "青銅刀" | head -1
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/shops/99999"
```

Expected: `武器店`、`青銅刀`、`404`

- [ ] **Step 5: Commit**

```bash
git add src/app/shops
git commit -m "feat(shops): add /shops list and /shops/[id] detail pages

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 道具頁 ShopAvailabilitySection

**Files:**
- Create: `src/components/items/shop-availability-section.tsx`
- Modify: `src/app/items/[id]/page.tsx`(在 `<ItemDropList sources={sources} />` 之後插入)

**Interfaces:**
- Consumes: Task 3 `getShopsSellingItem` / `getShopsBuyingItem`、常數
- Produces: `ShopAvailabilitySection({ itemId }: { itemId: number })` server component;販售與收購皆無資料時回傳 `null`

- [ ] **Step 1: 建立 section(仿 `compound-sources-section.tsx` 的空回 null 慣例)**

`src/components/items/shop-availability-section.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { LinkListRow, LinkListSection } from "@/components/common/link-list";
import { getShopsBuyingItem, getShopsSellingItem } from "@/lib/queries/shops";
import { SHOP_KIND_LABELS, castleLabel, shopTitle } from "@/lib/constants/shop";

export function ShopAvailabilitySection({ itemId }: { itemId: number }) {
  const sales = getShopsSellingItem(itemId);
  const buys = getShopsBuyingItem(itemId);
  if (sales.length === 0 && buys.length === 0) return null;

  const buySummary =
    buys.length > 0
      ? `另有 ${buys.length} 家商店收購(${[...new Set(buys.map((b) => b.rate))]
          .sort((a, b) => b - a)
          .map((r) => `${r}%`)
          .join("、")})`
      : null;

  if (sales.length === 0) {
    return (
      <LinkListSection title="商店收購" footer="收購率推定為道具售價的百分比。">
        {buys.map((b) => (
          <LinkListRow key={b.shopId} href={`/shops/${b.shopId}`}>
            <span className="font-medium">{shopTitle(b.shopId)}</span>
            <Badge variant="outline" className="font-normal">
              {SHOP_KIND_LABELS[b.kind]}
            </Badge>
            <span className="ml-auto font-mono text-xs text-muted-foreground">{b.rate}%</span>
          </LinkListRow>
        ))}
      </LinkListSection>
    );
  }

  return (
    <LinkListSection
      title="商店販售"
      summary={`${sales.length} 家商店販售`}
      footer={buySummary}
    >
      {sales.map((s) => (
        <LinkListRow key={s.shopId} href={`/shops/${s.shopId}`}>
          <span className="font-medium">{shopTitle(s.shopId)}</span>
          <Badge variant="outline" className="font-normal">
            {SHOP_KIND_LABELS[s.kind]}
          </Badge>
          {s.castleId != null && (
            <Badge variant="outline" className="font-normal">
              {castleLabel(s.castleId)}
            </Badge>
          )}
          <span className="ml-auto font-mono text-sm">
            {s.price.toLocaleString("zh-TW")} 銀
          </span>
        </LinkListRow>
      ))}
    </LinkListSection>
  );
}
```

- [ ] **Step 2: 插入道具頁**

Modify `src/app/items/[id]/page.tsx`:

import 區新增(與其他 items section import 放一起):

```tsx
import { ShopAvailabilitySection } from "@/components/items/shop-availability-section";
```

在 `<ItemDropList sources={sources} />` 的下一行插入:

```tsx
      <ShopAvailabilitySection itemId={item.id} />
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`
Expected: 無錯誤

- [ ] **Step 4: dev server 驗證**

```bash
# 20001 青銅刀:2 家販售(130/150)、4 家收購
curl -s "http://localhost:3000/items/20001" | grep -o "商店販售" | head -1
# 20000 銀兩:已驗證無任何商店販售/收購資料,區塊應隱藏
curl -s "http://localhost:3000/items/20000" | grep -c "商店販售" || true
```

Expected: 第一行輸出 `商店販售`;第二行輸出 `0`

- [ ] **Step 5: Commit**

```bash
git add src/components/items/shop-availability-section.tsx "src/app/items/[id]/page.tsx"
git commit -m "feat(items): add shop availability section to item detail

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Navbar 與首頁入口

**Files:**
- Modify: `src/components/layout/navbar.tsx:15-34`(navGroups)
- Modify: `src/app/page.tsx:12-53`(features)

**Interfaces:**
- Consumes: Task 4/5 的路由存在
- Produces: 導覽入口

- [ ] **Step 1: navbar 資料庫群組加兩項**

Modify `src/components/layout/navbar.tsx` — `navGroups` 第一組 `items` 的 `煉化` 之後加:

```ts
      { href: "/achievements", label: "成就" },
      { href: "/shops", label: "商店" },
```

- [ ] **Step 2: 首頁 features 加兩張卡**

Modify `src/app/page.tsx` — `features` 陣列「任務瀏覽」之後、「副本解謎」之前插入:

```ts
  {
    title: "成就圖鑑",
    description: "1,200+ 成就分類瀏覽,點數、描述、獎勵一覽",
    href: "/achievements",
  },
  {
    title: "商店查詢",
    description: "NPC 商店販售與收購價,道具頁直查哪裡買",
    href: "/shops",
  },
```

- [ ] **Step 3: typecheck + dev server 驗證**

Run: `npm run typecheck`
Expected: 無錯誤

```bash
curl -s "http://localhost:3000/" | grep -o "成就圖鑑" | head -1
curl -s "http://localhost:3000/" | grep -o "商店查詢" | head -1
```

Expected: `成就圖鑑`、`商店查詢`

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/navbar.tsx src/app/page.tsx
git commit -m "feat(nav): add achievements and shops entries to navbar and homepage

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: changelog PROFILES 註冊

**Files:**
- Modify: `src/lib/changelog/config.ts:6-109`(PROFILES)

**Interfaces:**
- Consumes: `TableProfile` 型別(`../changelog/types`,已存在)
- Produces: 六張新表的 changelog 追蹤設定

- [ ] **Step 1: PROFILES 加六個 entry**

Modify `src/lib/changelog/config.ts` — 在 `message_options` entry 之後(計數層註解之前)加:

```ts
  achievements: {
    tier: "rich",
    label: "成就",
    identity: ["id"],
    displayName: "name",
    fields: { name: "名稱", description: "描述", points: "點數", reward_amount: "獎勵數量" },
    detailRoute: () => "/achievements",
  },
  shop_sells: {
    tier: "rich",
    label: "商店販售",
    identity: ["shop_id", "item_id"],
    fields: { price: "價格" },
    detailRoute: (idParts) => `/shops/${idParts[0]}`,
  },
```

計數層(`map_warps` 之後)加:

```ts
  shops: { tier: "count", label: "商店", identity: ["id"] },
  shop_buys: { tier: "count", label: "商店收購", identity: ["shop_id", "item_id"] },
  achievement_categories: { tier: "count", label: "成就分類", identity: ["id"] },
  achievement_sub_cats: { tier: "count", label: "成就子分類", identity: ["id"] },
```

- [ ] **Step 2: 跑 changelog 測試**

Run: `npm test -- src/lib/changelog`
Expected: PASS(config 測試對所有 profile 驗 identity/label/fields,新 entry 自動被涵蓋)

- [ ] **Step 3: Commit**

```bash
git add src/lib/changelog/config.ts
git commit -m "feat(changelog): register achievement and shop tables in PROFILES

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: 全量驗證

**Files:** 無新增

- [ ] **Step 1: 全部測試**

Run: `npm test`
Expected: 全數 PASS

- [ ] **Step 2: Lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: 無錯誤

- [ ] **Step 3: production build**

Run: `npm run build`
Expected: build 成功,`/achievements`、`/shops`、`/shops/[id]` 出現在 route 輸出

- [ ] **Step 4: 有問題就修,無問題結束**

若任一步 fail:修復後重跑該步;全部通過即完成,不需額外 commit(除非有修復)。
