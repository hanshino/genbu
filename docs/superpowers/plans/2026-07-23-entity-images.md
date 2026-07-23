# 道具圖示與怪物/NPC 立繪呈現 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把資料庫新增的 `item_images`（icon）與 `npc_images` 圖片鋪設到全站，列表顯示官方小圖示、詳情顯示大圖（imgur 大圖優先，否則官方圖像素放大）、怪物/NPC 顯示立繪。

**Architecture:** 新增集中批次解析器 `src/lib/queries/images.ts`；共用展示元件 `<ItemIcon>`（道具小圖）、`<EntityPortrait>`（怪物/NPC 立繪，sm/lg）；擴充既有 `<ItemCover>` 支援像素放大後備。**Server 元件/頁面**用解析器查圖；**Client 元件**（ranking、compare、monster-drop-table）由其 server 父層把 `iconMap`/`npcImageMap`（`Map<number, EntityImage>`，可跨 RSC 邊界序列化）當 prop 傳入。

**Tech Stack:** Next.js App Router、TypeScript、better-sqlite3（in-process 同步唯讀）、Tailwind、shadcn/ui、lucide-react、vitest。

## Global Constraints

- 使用者可見文字一律繁體中文（zh-tw）。
- 圖片一律用原生 `<img>` 直連 `img.hanshino.dev`（`loading="lazy"`、`decoding="async"`），**不引入 next/image、不改 `next.config`**；每個 `<img>` 上方加既有樣式的 eslint-disable 註解（見既有 `item-cover.tsx`）。
- 只用道具 `kind='icon'`，不使用 `gicon`。
- `Item.icon` 已是既有 `number` 欄位（shape-key），**不可**用它承接圖片；圖片一律走獨立 `iconMap`/prop，型別為 `EntityImage`。
- DB 存取只在 query 層與 server 元件；client 元件（`"use client"`）不得呼叫 `getDb()`/解析器，需由父層傳 prop。
- 缺圖時渲染佔位框，**不得改變版位尺寸**（避免 CLS）。
- UI 元件沿用 shadcn 視覺語彙：`rounded-md border border-border/60 bg-muted/30 object-contain`。
- 每個 UI task 的驗證：`npm run lint` 與 `npm run build` 皆通過；query task 另跑 `npx vitest run`。
- 提交訊息結尾附：`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- 分支：`feat/entity-images`（已建立）。

## 檔案結構

**新增**
- `src/lib/queries/images.ts` — 圖片批次解析器（`EntityImage`、`getItemIconMap`/`getItemIcon`/`getNpcImageMap`/`getNpcImage`）
- `src/lib/queries/__tests__/images.test.ts` — 解析器單元測試
- `src/components/common/item-icon.tsx` — `<ItemIcon>` 道具小圖框
- `src/components/common/entity-portrait.tsx` — `<EntityPortrait>` 怪物/NPC 立繪（sm/lg）

**修改**（依 task 逐一列出精確路徑）

---

## Task 1: 圖片批次解析器 `images.ts`（TDD）

**Files:**
- Create: `src/lib/queries/images.ts`
- Create/Test: `src/lib/queries/__tests__/images.test.ts`
- Modify: `src/lib/queries/__tests__/schema-smoke.test.ts`（追加 import + 4 個 not.toThrow）

**Interfaces:**
- Produces:
  - `interface EntityImage { url: string; width: number | null; height: number | null }`
  - `getItemIconMap(ids: number[]): Map<number, EntityImage>`
  - `getItemIcon(id: number): EntityImage | null`
  - `getNpcImageMap(ids: number[]): Map<number, EntityImage>`
  - `getNpcImage(id: number): EntityImage | null`

- [ ] **Step 1: 寫失敗測試** `src/lib/queries/__tests__/images.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  getItemIconMap,
  getItemIcon,
  getNpcImageMap,
  getNpcImage,
} from "../images";

// 真實 id（存在於 tthol.sqlite）
const ITEM_WITH_ICON = 20001; // item_images kind='icon' 有此列
const NPC_WITH_IMAGE = 5011; // npc_images 有此列（同時是 monster）

describe("images.ts 解析器", () => {
  it("空陣列不打 DB、回傳空 Map", () => {
    expect(getItemIconMap([]).size).toBe(0);
    expect(getNpcImageMap([]).size).toBe(0);
  });

  it("getItemIcon 回傳單一道具 icon", () => {
    const img = getItemIcon(ITEM_WITH_ICON);
    expect(img).not.toBeNull();
    expect(typeof img!.url).toBe("string");
    expect(img!.url.length).toBeGreaterThan(0);
  });

  it("getItemIconMap 以 item_id 為 key 對應", () => {
    const map = getItemIconMap([ITEM_WITH_ICON, 999999999]);
    expect(map.get(ITEM_WITH_ICON)?.url).toBe(getItemIcon(ITEM_WITH_ICON)!.url);
    expect(map.has(999999999)).toBe(false); // 不存在的 id 不入 Map
  });

  it("getItemIconMap 去重且支援超過分塊大小的輸入", () => {
    const many = Array.from({ length: 950 }, (_, i) => ITEM_WITH_ICON); // 全同 → 去重成 1
    const map = getItemIconMap(many);
    expect(map.get(ITEM_WITH_ICON)).toBeDefined();
  });

  it("getNpcImage / getNpcImageMap 對應 npc_id", () => {
    const img = getNpcImage(NPC_WITH_IMAGE);
    expect(img).not.toBeNull();
    const map = getNpcImageMap([NPC_WITH_IMAGE]);
    expect(map.get(NPC_WITH_IMAGE)?.url).toBe(img!.url);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/queries/__tests__/images.test.ts`
Expected: FAIL（`../images` 不存在 / 找不到 export）

- [ ] **Step 3: 實作 `src/lib/queries/images.ts`**

```ts
import { getDb } from "@/lib/db";

export interface EntityImage {
  url: string;
  width: number | null;
  height: number | null;
}

// SQLite 預設變數上限 999，留餘裕分塊避免超長 IN (...)。
const CHUNK_SIZE = 900;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

interface ImageRow {
  key: number;
  url: string;
  width: number | null;
  height: number | null;
}

function buildMap(
  ids: number[],
  sql: (placeholders: string) => string,
): Map<number, EntityImage> {
  const map = new Map<number, EntityImage>();
  if (ids.length === 0) return map;
  const db = getDb();
  const unique = [...new Set(ids)];
  for (const part of chunk(unique, CHUNK_SIZE)) {
    const placeholders = part.map(() => "?").join(",");
    const rows = db.prepare(sql(placeholders)).all(...part) as ImageRow[];
    for (const r of rows) {
      map.set(r.key, { url: r.url, width: r.width, height: r.height });
    }
  }
  return map;
}

export function getItemIconMap(ids: number[]): Map<number, EntityImage> {
  return buildMap(
    ids,
    (ph) =>
      `SELECT item_id AS key, url, width, height
       FROM item_images
       WHERE kind = 'icon' AND item_id IN (${ph})`,
  );
}

export function getItemIcon(id: number): EntityImage | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT url, width, height FROM item_images WHERE kind = 'icon' AND item_id = ?`,
    )
    .get(id) as { url: string; width: number | null; height: number | null } | undefined;
  return row ? { url: row.url, width: row.width, height: row.height } : null;
}

export function getNpcImageMap(ids: number[]): Map<number, EntityImage> {
  return buildMap(
    ids,
    (ph) =>
      `SELECT npc_id AS key, url, width, height
       FROM npc_images
       WHERE npc_id IN (${ph})`,
  );
}

export function getNpcImage(id: number): EntityImage | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT url, width, height FROM npc_images WHERE npc_id = ?`)
    .get(id) as { url: string; width: number | null; height: number | null } | undefined;
  return row ? { url: row.url, width: row.width, height: row.height } : null;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/queries/__tests__/images.test.ts`
Expected: PASS（5 個 it 全綠）

- [ ] **Step 5: 追加 schema-smoke 覆蓋** — 在 `src/lib/queries/__tests__/schema-smoke.test.ts` 適當位置加：

```ts
// 於檔案上方 import 區加：
import {
  getItemIconMap,
  getItemIcon,
  getNpcImageMap,
  getNpcImage,
} from "../images";

// 於 describe("items.ts") 之後加一個新 describe：
describe("images.ts", () => {
  it("getItemIcon / getItemIconMap（非空才 prepare）", () => {
    expect(() => getItemIcon(REAL_ITEM_ID)).not.toThrow();
    expect(() => getItemIconMap([REAL_ITEM_ID])).not.toThrow();
  });
  it("getNpcImage / getNpcImageMap（非空才 prepare）", () => {
    expect(() => getNpcImage(REAL_MONSTER_ID)).not.toThrow();
    expect(() => getNpcImageMap([REAL_MONSTER_ID])).not.toThrow();
  });
});
```

- [ ] **Step 6: 跑全部測試 + lint**

Run: `npx vitest run && npm run lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/queries/images.ts src/lib/queries/__tests__/images.test.ts src/lib/queries/__tests__/schema-smoke.test.ts
git commit -m "feat(images): add item/npc image batch resolver"
```

---

## Task 2: `<ItemIcon>` 道具小圖元件

**Files:**
- Create: `src/components/common/item-icon.tsx`

**Interfaces:**
- Consumes: `EntityImage`（Task 1）
- Produces: `ItemIcon({ image, alt, className?, pixelated? })`

- [ ] **Step 1: 實作元件**（純展示、server-safe、無 `"use client"`）

```tsx
import { PackageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EntityImage } from "@/lib/queries/images";

interface ItemIconProps {
  image: EntityImage | null | undefined;
  alt: string;
  /** 覆寫外框尺寸等；預設 size-8。 */
  className?: string;
  /** 像素風放大（詳情大圖用）。 */
  pixelated?: boolean;
}

export function ItemIcon({ image, alt, className, pixelated }: ItemIconProps) {
  const frame = cn(
    "inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/30",
    className,
  );

  if (!image) {
    return (
      <span className={cn(frame, "text-muted-foreground")} aria-hidden>
        <PackageIcon className="size-4" />
      </span>
    );
  }

  return (
    <span className={frame}>
      {/* eslint-disable-next-line @next/next/no-img-element -- hotlink 直連；走 next/image 會集中到 Vercel optimizer IP，對 img.hanshino.dev 反而更易被限流 */}
      <img
        src={image.url}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn("h-full w-full object-contain", pixelated && "[image-rendering:pixelated]")}
      />
    </span>
  );
}
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit` （或 `npm run build` 於最後 task 統一驗）
Expected: 無型別錯誤

- [ ] **Step 3: Commit**

```bash
git add src/components/common/item-icon.tsx
git commit -m "feat(images): add <ItemIcon> shared component"
```

---

## Task 3: `<EntityPortrait>` 怪物/NPC 立繪元件

**Files:**
- Create: `src/components/common/entity-portrait.tsx`

**Interfaces:**
- Consumes: `EntityImage`（Task 1）
- Produces: `EntityPortrait({ image, alt, size?, className? })`，`size: "sm" | "lg"`（預設 `"lg"`）

- [ ] **Step 1: 實作元件**（純展示、server-safe）

```tsx
import { GhostIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EntityImage } from "@/lib/queries/images";

interface EntityPortraitProps {
  image: EntityImage | null | undefined;
  alt: string;
  /** sm 用於列表縮圖，lg 用於詳情立繪。 */
  size?: "sm" | "lg";
  className?: string;
}

const SIZE_CLASS: Record<"sm" | "lg", string> = {
  sm: "size-9",
  lg: "h-40 w-40 sm:h-48 sm:w-48",
};

export function EntityPortrait({ image, alt, size = "lg", className }: EntityPortraitProps) {
  const frame = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/30",
    SIZE_CLASS[size],
    className,
  );

  if (!image) {
    return (
      <span className={cn(frame, "text-muted-foreground")} aria-hidden>
        <GhostIcon className={size === "sm" ? "size-4" : "size-10"} />
      </span>
    );
  }

  return (
    <span className={frame}>
      {/* eslint-disable-next-line @next/next/no-img-element -- hotlink 直連；走 next/image 會集中到 Vercel optimizer IP，對 img.hanshino.dev 反而更易被限流 */}
      <img
        src={image.url}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain"
      />
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/common/entity-portrait.tsx
git commit -m "feat(images): add <EntityPortrait> shared component"
```

---

## Task 4: 擴充 `<ItemCover>` 支援像素放大後備

**Files:**
- Modify: `src/components/items/item-cover.tsx`

**Interfaces:**
- Produces: `ItemCover` 新增 optional prop `pixelated?: boolean`

- [ ] **Step 1: 修改 `item-cover.tsx`** — 於 `Props` 加 `pixelated?: boolean`，兩處 `<img>` 的 `className` 依 `pixelated` 加 `[image-rendering:pixelated]`。

`Props` 介面改為：
```tsx
interface Props {
  cover: EquipmentImage;
  alt: string;
  pixelated?: boolean;
}
export function ItemCover({ cover, alt, pixelated }: Props) {
```

觸發鈕內的縮圖 `<img>` className 改為：
```tsx
className={cn(
  "h-auto w-40 object-contain sm:w-52",
  pixelated && "[image-rendering:pixelated]",
)}
```

放大彈窗內的 `<img>` className 改為：
```tsx
className={cn(
  "max-h-[80vh] w-auto max-w-full object-contain",
  pixelated && "[image-rendering:pixelated]",
)}
```

於檔案頂端加 `import { cn } from "@/lib/utils";`（若尚未 import）。

- [ ] **Step 2: Commit**

```bash
git add src/components/items/item-cover.tsx
git commit -m "feat(images): support pixelated fallback in <ItemCover>"
```

---

## Task 5: 道具列表縮圖

**Files:**
- Modify: `src/app/items/page.tsx`
- Modify: `src/components/items/item-table.tsx`

**Interfaces:**
- Consumes: `getItemIconMap`（Task 1）、`<ItemIcon>`（Task 2）
- `ItemTable` 新增 prop `iconMap: Map<number, EntityImage>`

- [ ] **Step 1: 頁面補圖** — `src/app/items/page.tsx`：`getItems` 後加解析並傳給表格。

在 `const result = getItems({...})` 之後加：
```tsx
const iconMap = getItemIconMap(result.items.map((i) => i.id));
```
於頂端 import：`import { getItemIconMap } from "@/lib/queries/images";`
`<ItemTable items={result.items} sort={...} />` 改為加上 `iconMap={iconMap}`。

- [ ] **Step 2: 表格加縮圖欄** — `src/components/items/item-table.tsx`：

頂端 import：
```tsx
import { ItemIcon } from "@/components/common/item-icon";
import type { EntityImage } from "@/lib/queries/images";
```
Props 介面加 `iconMap: Map<number, EntityImage>;`，並於函式簽名解構。

名稱 `<TableCell>`（目前含 `<Link>`）改為圖示＋名稱並排：
```tsx
<TableCell>
  <div className="flex items-center gap-2">
    <ItemIcon image={item.iconImage} alt={item.name} className="size-7" />
    <div className="min-w-0">
      <Link href={`/items/${item.id}`} className="font-medium hover:underline">
        {item.name}
      </Link>
      {item.note && (
        <span className="ml-2 text-xs text-muted-foreground">{item.note}</span>
      )}
    </div>
  </div>
</TableCell>
```
> 注意：`item` 沒有 `iconImage` 欄位，改用 `iconMap.get(item.id) ?? null`：
```tsx
<ItemIcon image={iconMap.get(item.id) ?? null} alt={item.name} className="size-7" />
```

- [ ] **Step 3: 驗證** `npm run lint && npm run build` → PASS
- [ ] **Step 4: Commit**

```bash
git add src/app/items/page.tsx src/components/items/item-table.tsx
git commit -m "feat(images): item list row thumbnails"
```

---

## Task 6: 道具詳情大圖後備

**Files:**
- Modify: `src/app/items/[id]/page.tsx`
- Modify: `src/components/items/item-detail.tsx`

**Interfaces:**
- Consumes: `getItemIcon`（Task 1）、`ItemCover.pixelated`（Task 4）
- `ItemDetail` 新增 prop `fallbackIcon?: EntityImage | null`

- [ ] **Step 1: 頁面解析官方 icon** — `src/app/items/[id]/page.tsx`：
於頂端 import：`import { getItemIcon } from "@/lib/queries/images";`
在 `const cover = imageOfItem(item);` 之後加：
```tsx
const fallbackIcon = cover ? null : getItemIcon(item.id);
```
`<ItemDetail ... cover={cover} />` 加上 `fallbackIcon={fallbackIcon}`。

- [ ] **Step 2: `item-detail.tsx` 渲染後備** — 於 `ItemDetailProps` 加：
```tsx
import type { EntityImage } from "@/lib/queries/images";
// ...
fallbackIcon?: EntityImage | null;
```
簽名解構 `fallbackIcon`。將 header 內 `cover` 區塊改為：
```tsx
{cover ? (
  <div className="shrink-0 self-center sm:self-start">
    <ItemCover cover={cover} alt={item.name} />
  </div>
) : fallbackIcon ? (
  <div className="shrink-0 self-center sm:self-start">
    <ItemCover
      cover={{ src: fallbackIcon.url, sourceUrl: fallbackIcon.url }}
      alt={item.name}
      pixelated
    />
  </div>
) : null}
```

- [ ] **Step 3: 驗證** `npm run lint && npm run build` → PASS
- [ ] **Step 4: Commit**

```bash
git add src/app/items/[id]/page.tsx src/components/items/item-detail.tsx
git commit -m "feat(images): item detail pixelated icon fallback cover"
```

---

## Task 7: 怪物詳情立繪

**Files:**
- Modify: `src/app/monsters/[id]/page.tsx`
- Modify: `src/components/monsters/monster-detail.tsx`

**Interfaces:**
- Consumes: `getNpcImage`（Task 1）、`<EntityPortrait>`（Task 3）
- `MonsterDetailView` 新增 prop `portrait?: EntityImage | null`

- [ ] **Step 1: 頁面解析立繪** — `src/app/monsters/[id]/page.tsx`：
import：`import { getNpcImage } from "@/lib/queries/images";`
在取得 `monster` 後加：`const portrait = getNpcImage(monster.id);`
`<MonsterDetailView monster={monster} />` 改為 `<MonsterDetailView monster={monster} portrait={portrait} />`。

- [ ] **Step 2: `monster-detail.tsx` 顯示立繪** — 於 `MonsterDetailProps` 加：
```tsx
import { EntityPortrait } from "@/components/common/entity-portrait";
import type { EntityImage } from "@/lib/queries/images";
// ...
portrait?: EntityImage | null;
```
把 `<header>` 包進與立繪並排的 flex（立繪在右、桌機靠上），比照 item-detail 的 `sm:flex-row-reverse`：
```tsx
<section className="space-y-6">
  <div className="flex flex-col gap-4 sm:flex-row-reverse sm:items-start">
    {portrait && (
      <div className="shrink-0 self-center sm:self-start">
        <EntityPortrait image={portrait} alt={monster.name} size="lg" />
      </div>
    )}
    <header className="min-w-0 flex-1 space-y-3">
      {/* 原有 header 內容照舊 */}
    </header>
  </div>
  {/* 原有屬性 grid 照舊 */}
</section>
```

- [ ] **Step 3: 驗證** `npm run lint && npm run build` → PASS
- [ ] **Step 4: Commit**

```bash
git add src/app/monsters/[id]/page.tsx src/components/monsters/monster-detail.tsx
git commit -m "feat(images): monster detail portrait"
```

---

## Task 8: 怪物列表縮圖

**Files:**
- Modify: `src/app/monsters/page.tsx`
- Modify: `src/components/monsters/monster-table.tsx`

**Interfaces:**
- Consumes: `getNpcImageMap`（Task 1）、`<EntityPortrait size="sm">`（Task 3）
- `MonsterTable` 新增 prop `portraitMap: Map<number, EntityImage>`

- [ ] **Step 1: 讀取並理解** `src/app/monsters/page.tsx`（怪物列表頁）取得 `monsters` 陣列處。
- [ ] **Step 2: 頁面補圖** — import `getNpcImageMap`；在取得列表後加 `const portraitMap = getNpcImageMap(monsters.map((m) => m.id));`（變數名依該頁實際變數調整），並把 `portraitMap` 傳給 `<MonsterTable>`。
- [ ] **Step 3: 表格加縮圖** — `src/components/monsters/monster-table.tsx`：import `EntityPortrait` 與 `EntityImage`；Props 加 `portraitMap: Map<number, EntityImage>;`；名稱 `<TableCell>` 改為：
```tsx
<TableCell>
  <div className="flex items-center gap-2">
    <EntityPortrait image={portraitMap.get(m.id) ?? null} alt={m.name} size="sm" />
    <Link href={`/monsters/${m.id}`} className="font-medium hover:underline">
      {m.name}
    </Link>
  </div>
</TableCell>
```
- [ ] **Step 4: 驗證** `npm run lint && npm run build` → PASS
- [ ] **Step 5: Commit**

```bash
git add src/app/monsters/page.tsx src/components/monsters/monster-table.tsx
git commit -m "feat(images): monster list row portraits"
```

---

## Task 9: 任務 NPC 立繪

**Files:**
- Read first: `src/app/missions/[id]/page.tsx`、`src/lib/queries/missions.ts`（找出 `mission_refs` 中 `ref_type='npc'` 的 npc 清單如何取得與呈現）
- Modify: 任務詳情頁與其呈現 NPC 引用的元件/區塊

**Interfaces:**
- Consumes: `getNpcImageMap`（Task 1）、`<EntityPortrait>`（Task 3）

- [ ] **Step 1: 讀取** 上述兩檔，確認任務詳情如何列出關聯 NPC（`getMissionDetail` 的 npc refs）。
- [ ] **Step 2: 頁面補圖** — 於任務詳情頁 server 端對所有 NPC ref 的 `npc_id` 呼叫 `getNpcImageMap(npcIds)`，把對應立繪傳入呈現 NPC 的區塊。
- [ ] **Step 3: 呈現** — 在每個 NPC 引用（名稱/地圖標記）前用 `<EntityPortrait size="sm">` 顯示立繪；缺圖走佔位。
- [ ] **Step 4: 驗證** `npm run lint && npm run build` → PASS
- [ ] **Step 5: Commit**

```bash
git commit -am "feat(images): mission NPC portraits"
```

---

## Task 10: 掉落清單小圖（怪物掉落 + 道具掉落來源）

**Files:**
- Modify: `src/app/monsters/[id]/page.tsx`（傳 iconMap 給掉落表）
- Modify: `src/components/monsters/monster-drop-table.tsx`（client：加 `iconMap` prop）
- Modify: `src/app/items/[id]/page.tsx`（傳 portraitMap 給掉落來源）
- Modify: `src/components/items/item-drop-list.tsx`（怪物縮圖）

**Interfaces:**
- `MonsterDropTable` 新增 prop `iconMap: Map<number, EntityImage>`（道具 icon）
- `ItemDropList` 新增 prop `portraitMap: Map<number, EntityImage>`（怪物立繪）

- [ ] **Step 1: 怪物掉落表道具小圖** — `monsters/[id]/page.tsx`：`const dropIconMap = getItemIconMap(drops.map((d) => d.itemId));` 傳入 `<MonsterDropTable iconMap={dropIconMap} ... />`。`monster-drop-table.tsx`（`"use client"`）Props 加 `iconMap: Map<number, EntityImage>`；在每列道具名稱前加 `<ItemIcon image={iconMap.get(d.itemId) ?? null} alt={d.name ?? String(d.itemId)} className="size-6" />`（import `ItemIcon`、`EntityImage`）。
- [ ] **Step 2: 道具詳情「掉落來源」怪物縮圖** — `items/[id]/page.tsx`：`const sourcePortraitMap = getNpcImageMap(sources.map((s) => s.id));` 傳入 `<ItemDropList sources={sources} spawnsByMonster={spawnsByMonster} portraitMap={sourcePortraitMap} />`。`item-drop-list.tsx` Props 加 `portraitMap`；怪物名稱前加 `<EntityPortrait image={portraitMap.get(m.id) ?? null} alt={m.name} size="sm" />`。
- [ ] **Step 3: 驗證** `npm run lint && npm run build` → PASS
- [ ] **Step 4: Commit**

```bash
git commit -am "feat(images): drop-list item icons and monster portraits"
```

---

## Task 11: 合成配方小圖

**Files:**
- Read first: `src/components/items/compound-sources-section.tsx`、`compound-uses-section.tsx`、`src/components/items/enhancements-list.tsx`、`src/components/items/equipment-enhancements-section.tsx`、`src/app/compounds/[id]/page.tsx`、`src/lib/queries/compound.ts`
- Modify: `src/components/compounds/material-link.tsx`、`output-cell.tsx`、`compound-recipe-table.tsx` 及上述引用處

**Interfaces:**
- `MaterialLink` 新增 optional `image?: EntityImage | null`；`MaterialList` 新增 optional `iconMap?: Map<number, EntityImage>`
- `OutputCell` 新增 optional `iconMap?: Map<number, EntityImage>`
- `CompoundRecipeTable` 新增 prop `iconMap: Map<number, EntityImage>`

- [ ] **Step 1: `MaterialLink`** — 加 `image?: EntityImage | null`，僅 `kind==='real'` 時在名稱前渲染 `<ItemIcon image={image} alt={m.name} className="size-5" />`（import `ItemIcon`、`EntityImage`）。placeholder（slot-kind/self）不顯示圖。
- [ ] **Step 2: `MaterialList`** — 加 `iconMap?: Map<number, EntityImage>`，逐筆傳 `image={iconMap?.get(m.id) ?? null}` 給 `MaterialLink`。
- [ ] **Step 3: `OutputCell`** — 加 `iconMap?`，`o.itemId` 存在時在 label 前渲染 `<ItemIcon image={iconMap?.get(o.itemId) ?? null} alt={o.label} className="size-5" />`。
- [ ] **Step 4: `CompoundRecipeTable`** — 加 `iconMap` prop，蒐集所有 row 的 `coreMaterial.id`、`sideMaterials[].id`、`outputs[].itemId`、`failItem.id`，把 `iconMap` 傳給各 `MaterialLink`/`MaterialList`/`OutputCell`。
- [ ] **Step 5: 上游 server 補圖** — 於 `compounds/[id]/page.tsx` 與 item-detail 的 compound 兩區段（sources/uses）、enhancements：對該區段所有相關 item id 呼叫 `getItemIconMap`，把結果作為 `iconMap` 傳入。（各檔在 Step 1 讀取後依實際資料結構蒐集 id。）
- [ ] **Step 6: 驗證** `npm run lint && npm run build` → PASS
- [ ] **Step 7: Commit**

```bash
git commit -am "feat(images): compound recipe icons"
```

---

## Task 12: 商店買/賣清單小圖

**Files:**
- Modify: `src/app/shops/[id]/page.tsx`

**Interfaces:**
- Consumes: `getItemIconMap`、`<ItemIcon>`

- [ ] **Step 1: 補圖** — import `getItemIconMap`、`ItemIcon`。在 `shop` 取得後加：
```tsx
const iconMap = getItemIconMap([
  ...shop.sells.map((e) => e.itemId),
  ...shop.buys.map((e) => e.itemId),
]);
```
- [ ] **Step 2: 販售與收購兩處** 道具名稱 `<Link>` 前加：
```tsx
<div className="flex items-center gap-2">
  <ItemIcon image={iconMap.get(e.itemId) ?? null} alt={e.itemName ?? String(e.itemId)} className="size-6" />
  <Link href={`/items/${e.itemId}`} className="font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid">
    {e.itemName ?? `#${e.itemId}`}
  </Link>
</div>
```
- [ ] **Step 3: 驗證** `npm run lint && npm run build` → PASS
- [ ] **Step 4: Commit**

```bash
git commit -am "feat(images): shop buy/sell list icons"
```

---

## Task 13: 任務道具小圖

**Files:**
- Read first: `src/components/items/mission-uses-section.tsx`、`src/app/missions/[id]/page.tsx`（道具 ref 呈現處）、`src/lib/queries/missions.ts`
- Modify: 上述呈現任務道具引用的元件/區塊

**Interfaces:**
- Consumes: `getItemIconMap`、`<ItemIcon>`

- [ ] **Step 1: 讀取** 上述檔案，找出任務詳情列出 `mission_refs`（`ref_type='item'`）的道具清單，以及道具詳情 `mission-uses-section` 的呈現。
- [ ] **Step 2: 補圖並呈現** — server 端對相關 item id 呼叫 `getItemIconMap`，於每個道具引用名稱前加 `<ItemIcon>`（`className="size-6"`）。
- [ ] **Step 3: 驗證** `npm run lint && npm run build` → PASS
- [ ] **Step 4: Commit**

```bash
git commit -am "feat(images): mission item icons"
```

---

## Task 14: 比較工具小圖

**Files:**
- Read first: `src/app/compare/compare-client.tsx`、`src/components/compare/compare-matrix.tsx`、`compare-bar.tsx`
- Modify: `src/app/compare/page.tsx`（server 補圖）、`compare-client.tsx`（傳遞 prop）、`item-picker.tsx`（下拉選項小圖）、比較呈現元件

**Interfaces:**
- Consumes: `getItemIconMap`、`<ItemIcon>`
- client 元件由 `page.tsx` 傳入 `iconMap: Map<number, EntityImage>`（涵蓋 `pool` 與 `initialItems` 的 id）

- [ ] **Step 1: 讀取** 上述檔案，確認 `pool`/`initialItems`/比較欄如何流動、`item-picker` 下拉如何 render。
- [ ] **Step 2: 頁面補圖** — `compare/page.tsx`：
```tsx
const iconMap = getItemIconMap([...pool.map((p) => p.id), ...ids]);
```
傳入 `<CompareClient ... iconMap={iconMap} />`。
- [ ] **Step 3: 下傳與呈現** — `CompareClient` 透 prop 傳到 `ItemPicker`（下拉每筆名稱前 `<ItemIcon className="size-5">`）與比較矩陣的欄標題（每件裝備名稱前小圖）。缺圖走佔位。
- [ ] **Step 4: 驗證** `npm run lint && npm run build` → PASS
- [ ] **Step 5: Commit**

```bash
git commit -am "feat(images): compare tool icons"
```

---

## Task 15: 排行榜小圖（以官方 icon 取代 imgur 縮圖）

**Files:**
- Read first: `src/app/ranking/ranking-client.tsx`
- Modify: `src/app/ranking/page.tsx`（server 補圖）、`ranking-client.tsx`（傳 prop）、`src/components/ranking/ranking-table.tsx`（改用官方 icon）

**Interfaces:**
- Consumes: `getItemIconMap`、`<ItemIcon>`
- `RankingTable` 新增 prop `iconMap: Map<number, EntityImage>`

- [ ] **Step 1: 頁面補圖** — `ranking/page.tsx`：`const iconMap = getItemIconMap(items.map((i) => i.id));`，傳入 `<RankingClient ... iconMap={iconMap} />`。
- [ ] **Step 2: `ranking-client.tsx`** 透傳 `iconMap` 給 `<RankingTable>`。
- [ ] **Step 3: `ranking-table.tsx`** — 移除 `imageOfItem` import 與本地 `ItemThumbnail`；Props 加 `iconMap: Map<number, EntityImage>`；名稱連結內把 `<ItemThumbnail itemId={item.id} />` 換成：
```tsx
<ItemIcon image={iconMap.get(item.id) ?? null} alt={item.name} className="size-9" />
```
（import `ItemIcon`、`EntityImage`；移除不再使用的 `imageOfItem` import。）
- [ ] **Step 4: 驗證** `npm run lint && npm run build` → PASS
- [ ] **Step 5: Commit**

```bash
git add src/app/ranking/page.tsx src/app/ranking/ranking-client.tsx src/components/ranking/ranking-table.tsx
git commit -m "feat(images): ranking table official icons"
```

---

## Task 16: 最終驗證

**Files:** 無（純驗證）

- [ ] **Step 1: 完整測試** `npx vitest run` → 全綠
- [ ] **Step 2: Lint** `npm run lint` → 無錯誤
- [ ] **Step 3: Build** `npm run build` → 成功
- [ ] **Step 4: 視覺 QA**（Playwright / dev server）逐頁截圖確認：
  - `/items`（列表縮圖）
  - `/items/<有 imgur 大圖的 id，如 412 集合之一>` 與 `/items/<只有官方圖的 id，如 67890>`（兩種大圖情形）
  - `/monsters`（列表立繪）、`/monsters/5011`（詳情立繪 + 掉落道具小圖）
  - `/shops/9`（買/賣小圖）
  - `/compounds/<某 group>`（配方小圖）
  - `/ranking?type=HORSE`（官方 icon 縮圖）、`/compare?ids=...`
  - `/missions/1`（NPC 立繪、道具小圖）
- [ ] **Step 5: 缺圖佔位** 確認無圖道具/怪物顯示佔位框且不跳版。

---

## Self-Review

**Spec coverage:**
- §2 決策1 全站鋪滿 → Tasks 5–15 覆蓋列表/詳情/掉落/合成/商店/任務/比較/排行。✓
- §2 決策2 只用 icon → Global Constraints + 所有道具查詢用 `kind='icon'`。✓
- §2 決策3 列表小圖／詳情大圖（imgur 優先，否則像素放大）→ Task 4 + Task 6。✓
- §2 決策4 怪物/NPC 立繪 → Tasks 3,7,8,9,10。✓
- §3.1 批次解析器 → Task 1。✓
- §3.2 共用元件 → Tasks 2,3,4。✓
- §7 缺圖/CLS/效能/無障礙 → 元件佔位、固定框尺寸、批次查詢、`alt`。✓
- §8 驗證 → Task 1 測試 + Task 16。✓
- 註記：`shops` 無 npc 綁定，故無商店店主立繪（僅道具小圖，Task 12）。✓

**Placeholder scan:** Tasks 9/11/13/14/15 含「Read first」步驟（因該區塊資料結構未於計畫階段完整讀取），但每個都給了精確檔案路徑、資料來源（如 `mission_refs.npc_id`）、共用元件用法與 prop 介面，非空泛佔位。Tasks 1–8,10,12 為完整程式碼。

**Type consistency:** `EntityImage`、`getItemIconMap`/`getItemIcon`/`getNpcImageMap`/`getNpcImage`、`iconMap`/`portraitMap`（皆 `Map<number, EntityImage>`）、`<ItemIcon image=... />`、`<EntityPortrait image=... size=... />`、`ItemCover pixelated`、`ItemDetail fallbackIcon`、`MonsterDetailView portrait` 全計畫一致。✓
