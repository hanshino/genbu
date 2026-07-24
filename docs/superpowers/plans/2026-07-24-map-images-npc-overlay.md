# 地圖圖片與 NPC 疊圖呈現 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在地圖詳情頁 `/maps/[id]` 呈現地圖背景圖，並在圖上以圓點疊出 NPC 位置（hover 顯示頭像＋名字），另附常駐 NPC 清單涵蓋全部地圖。

**Architecture:** 新增 `src/lib/queries/maps.ts` 提供兩支 server 端查詢（地圖圖 + NPC placement，重用既有 `getNpcImageMap` 補頭像）。新增 client 元件 `<StageMapViewer>` 負責圖片、疊點、彈卡、清單與 hover 互相高亮。頁面（server component）查好資料後傳入。

**Tech Stack:** Next.js App Router（Server Components）、TypeScript、better-sqlite3（唯讀）、Tailwind、shadcn/base-ui（`ui/popover.tsx` 已存在）、Vitest + @testing-library/react。

## Global Constraints

- 使用者可見文字一律繁體中文（zh-tw）。
- 圖片一律原生 `<img>` hotlink 直連 `img.hanshino.dev`；**不引入 next/image、不改 `next.config`**（沿用 `EntityPortrait` / `ItemCover` 既有決策）。
- `tthol.sqlite` 唯讀，不得寫入。
- Server Component 為預設；僅需互動的 `<StageMapViewer>` 標 `"use client"`。
- NPC 為**純展示（頭像＋名字），不設連結**（城鎮 NPC 不在 `monsters` 表、專案無 NPC 詳情頁）。
- shadcn-first：Popover 使用既有 `src/components/ui/popover.tsx`，不重造。
- 測試用 `tthol.sqlite` 真實 id（比照 `images.test.ts` 慣例）。

---

### Task 1: 資料層 `src/lib/queries/maps.ts`

**Files:**
- Create: `src/lib/queries/maps.ts`
- Test: `src/lib/queries/__tests__/maps.test.ts`

**Interfaces:**
- Consumes: `getDb` from `@/lib/db`；`StageKind` from `@/lib/types/stage`；`getNpcImageMap` 與 `EntityImage` from `./images`。
- Produces（後續 Task 2/3 依賴）：
  - `interface StageMapImage { url: string; imgWidth: number; imgHeight: number; tilesW: number; tilesH: number; tilePx: number }`
  - `interface NpcPlacement { npcId: number; name: string | null; tileX: number; tileY: number; image: EntityImage | null }`
  - `function getStageMapImage(kind: StageKind, id: number): StageMapImage | null`
  - `function getNpcPlacementsForStage(kind: StageKind, id: number): NpcPlacement[]`

**測試 fixture（已於 tthol.sqlite 驗證）：**
- `("stage", 2)` 莫愁谷村莊：有圖 `4880×6480`、`122×162` 格、`tile_px=40`；NPC placement 共 **79** 筆（78 distinct）。
- `("stage", 1)` 莫愁谷入口：在 `stages` 但**無** `map_images` 列 → 圖回 `null`。
- `("stage", 42)` 凌霄閣：有圖但 `category='npc'` placement **為 0** → NPC 回空陣列。

- [ ] **Step 1: 寫失敗測試**

`src/lib/queries/__tests__/maps.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { getStageMapImage, getNpcPlacementsForStage } from "../maps";

// 真實 id（存在於 tthol.sqlite）
const STAGE_WITH_IMAGE = 2; // 莫愁谷村莊：有圖 + 多 NPC
const STAGE_NO_IMAGE = 1; // 莫愁谷入口：在 stages 但無 map_images
const STAGE_IMG_NO_NPC = 42; // 凌霄閣：有圖但無 NPC placement

describe("maps.ts 查詢", () => {
  it("getStageMapImage 回傳有圖 stage 的尺寸與格數", () => {
    const img = getStageMapImage("stage", STAGE_WITH_IMAGE);
    expect(img).not.toBeNull();
    expect(img!.imgWidth).toBe(4880);
    expect(img!.imgHeight).toBe(6480);
    expect(img!.tilesW).toBe(122);
    expect(img!.tilesH).toBe(162);
    expect(img!.tilePx).toBe(40);
    expect(img!.url.length).toBeGreaterThan(0);
  });

  it("getStageMapImage 無圖 stage 回 null", () => {
    expect(getStageMapImage("stage", STAGE_NO_IMAGE)).toBeNull();
  });

  it("getNpcPlacementsForStage 回傳 NPC 座標、名字與頭像", () => {
    const list = getNpcPlacementsForStage("stage", STAGE_WITH_IMAGE);
    expect(list.length).toBe(79);
    for (const p of list) {
      expect(p.npcId).toBeGreaterThan(0);
      expect(typeof p.tileX).toBe("number");
      expect(typeof p.tileY).toBe("number");
    }
    expect(list.some((p) => p.name && p.name.length > 0)).toBe(true);
    expect(list.some((p) => p.image !== null)).toBe(true);
  });

  it("getNpcPlacementsForStage 有圖但無 NPC 的 stage 回空陣列", () => {
    expect(getNpcPlacementsForStage("stage", STAGE_IMG_NO_NPC)).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test -- src/lib/queries/__tests__/maps.test.ts`
Expected: FAIL（`../maps` 模組不存在 / 匯出未定義）。

- [ ] **Step 3: 實作 `src/lib/queries/maps.ts`**

```ts
import { getDb } from "@/lib/db";
import type { StageKind } from "@/lib/types/stage";
import { getNpcImageMap, type EntityImage } from "./images";

export interface StageMapImage {
  url: string;
  imgWidth: number;
  imgHeight: number;
  tilesW: number;
  tilesH: number;
  tilePx: number;
}

/** 單張地圖背景圖；無圖（718 張中僅 62 張有）回 null。 */
export function getStageMapImage(kind: StageKind, id: number): StageMapImage | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT url,
              img_width   AS imgWidth,
              img_height  AS imgHeight,
              map_w_tiles AS tilesW,
              map_h_tiles AS tilesH,
              tile_px     AS tilePx
       FROM map_images
       WHERE stage_kind = ? AND stage_id = ?`,
    )
    .get(kind, id) as StageMapImage | undefined;
  return row ?? null;
}

export interface NpcPlacement {
  npcId: number;
  name: string | null;
  tileX: number;
  tileY: number;
  image: EntityImage | null;
}

/**
 * 該 stage 的 NPC placement（category='npc' 且 in_bounds=1），每個座標一筆。
 * 名字 join npc 表；頭像用批次 getNpcImageMap 補（無 N+1）。
 */
export function getNpcPlacementsForStage(kind: StageKind, id: number): NpcPlacement[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.npc_id AS npcId,
              n.name    AS name,
              p.tile_x  AS tileX,
              p.tile_y  AS tileY
       FROM map_placements p
       LEFT JOIN npc n ON n.id = p.npc_id
       WHERE p.stage_kind = ?
         AND p.stage_id = ?
         AND p.category = 'npc'
         AND p.in_bounds = 1
       ORDER BY p.id`,
    )
    .all(kind, id) as Array<{
    npcId: number;
    name: string | null;
    tileX: number;
    tileY: number;
  }>;

  if (rows.length === 0) return [];

  const imageMap = getNpcImageMap(rows.map((r) => r.npcId));
  return rows.map((r) => ({ ...r, image: imageMap.get(r.npcId) ?? null }));
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test -- src/lib/queries/__tests__/maps.test.ts`
Expected: PASS（4 個測試全綠）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/maps.ts src/lib/queries/__tests__/maps.test.ts
git commit -m "feat(maps): add map image + NPC placement queries"
```

---

### Task 2: `<StageMapViewer>` client 元件

**Files:**
- Create: `src/components/maps/stage-map-viewer.tsx`
- Test: `src/components/maps/__tests__/stage-map-viewer.test.tsx`

**Interfaces:**
- Consumes: `StageMapImage`、`NpcPlacement` from `@/lib/queries/maps`；`EntityPortrait` from `@/components/common/entity-portrait`；`Popover`/`PopoverTrigger`/`PopoverContent` from `@/components/ui/popover`；`cn` from `@/lib/utils`。
- Produces（Task 3 依賴）：
  - `function StageMapViewer(props: { stageName: string; image: StageMapImage | null; placements: NpcPlacement[] }): JSX.Element | null`
  - 無圖且無 NPC 時回 `null`。

**關鍵細節：**
- 圓點定位：`left = tileX / tilesW * 100%`、`top = tileY / tilesH * 100%`，`-translate-x-1/2 -translate-y-1/2` 置中。
- 圓點為 `PopoverTrigger`（渲染 `<button>`），`aria-label` = NPC 名，`openOnHover delay={0}`（桌機 hover 開卡；點擊亦開，供手機）。
- hover 互相高亮：parent `hoveredNpcId` state；圓點與清單列 `onMouseEnter/Leave`（圓點另加 `onFocus/onBlur`）同步；同一 NPC 多點一起亮。
- 清單去重（`npcId`），純展示 `<li>`（不用 `LinkListRow`，因無連結），外框沿用 link-list 樣式。
- `PopoverContent` 既有預設 `w-72 flex-col`；此處覆寫為 `w-auto` 橫向排（頭像＋名字）。
- `<img>` 帶 `width/height`（DB 像素）避免 CLS。

- [ ] **Step 1: 寫失敗測試**

`src/components/maps/__tests__/stage-map-viewer.test.tsx`：

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StageMapViewer } from "../stage-map-viewer";
import type { StageMapImage, NpcPlacement } from "@/lib/queries/maps";

const image: StageMapImage = {
  url: "https://img.hanshino.dev/test.webp",
  imgWidth: 4880,
  imgHeight: 6480,
  tilesW: 122,
  tilesH: 162,
  tilePx: 40,
};
const placements: NpcPlacement[] = [
  { npcId: 6074, name: "打鐵舖伙計", tileX: 66, tileY: 37, image: null },
  { npcId: 6566, name: "珍品商人", tileX: 99, tileY: 152, image: null },
];

describe("<StageMapViewer>", () => {
  it("無圖無 NPC 時不渲染", () => {
    const { container } = render(
      <StageMapViewer stageName="空地圖" image={null} placements={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("有圖時渲染地圖圖與每個 placement 的圓點按鈕", () => {
    render(<StageMapViewer stageName="莫愁谷村莊" image={image} placements={placements} />);
    const img = screen.getByRole("img", { name: /莫愁谷村莊/ });
    expect(img).toHaveAttribute("src", image.url);
    expect(screen.getByRole("button", { name: "打鐵舖伙計" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "珍品商人" })).toBeInTheDocument();
  });

  it("無圖有 NPC 時只渲染清單、無地圖圖", () => {
    render(<StageMapViewer stageName="某地圖" image={null} placements={placements} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("打鐵舖伙計")).toBeInTheDocument();
    expect(screen.getByText("珍品商人")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test -- src/components/maps/__tests__/stage-map-viewer.test.tsx`
Expected: FAIL（`../stage-map-viewer` 不存在）。

- [ ] **Step 3: 實作 `src/components/maps/stage-map-viewer.tsx`**

```tsx
"use client";

import * as React from "react";
import { EntityPortrait } from "@/components/common/entity-portrait";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { EntityImage } from "@/lib/queries/images";
import type { NpcPlacement, StageMapImage } from "@/lib/queries/maps";

interface StageMapViewerProps {
  stageName: string;
  image: StageMapImage | null;
  placements: NpcPlacement[];
}

interface NpcEntry {
  npcId: number;
  name: string | null;
  image: EntityImage | null;
}

export function StageMapViewer({ stageName, image, placements }: StageMapViewerProps) {
  const [hovered, setHovered] = React.useState<number | null>(null);

  const npcs = React.useMemo<NpcEntry[]>(() => {
    const seen = new Map<number, NpcEntry>();
    for (const p of placements) {
      if (!seen.has(p.npcId)) {
        seen.set(p.npcId, { npcId: p.npcId, name: p.name, image: p.image });
      }
    }
    return [...seen.values()];
  }, [placements]);

  if (!image && npcs.length === 0) return null;

  return (
    <section className="space-y-4">
      {image && (
        <figure className="relative overflow-hidden rounded-lg border border-border/60 bg-muted/20">
          {/* eslint-disable-next-line @next/next/no-img-element -- hotlink 直連，沿用 EntityPortrait 決策 */}
          <img
            src={image.url}
            alt={`${stageName} 地圖`}
            width={image.imgWidth}
            height={image.imgHeight}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full"
          />
          {placements.map((p, i) => (
            <NpcDot
              key={`${p.npcId}-${p.tileX}-${p.tileY}-${i}`}
              placement={p}
              tilesW={image.tilesW}
              tilesH={image.tilesH}
              active={hovered === p.npcId}
              onActiveChange={(on) => setHovered(on ? p.npcId : null)}
            />
          ))}
        </figure>
      )}

      {npcs.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-medium">
            出沒 NPC
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {npcs.length}
            </span>
          </h2>
          <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
            {npcs.map((n) => (
              <li
                key={n.npcId}
                onMouseEnter={() => setHovered(n.npcId)}
                onMouseLeave={() => setHovered(null)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 transition-colors",
                  hovered === n.npcId && "bg-muted/50",
                )}
              >
                <EntityPortrait image={n.image} alt={n.name ?? "NPC"} size="sm" />
                <span className="font-medium">{n.name ?? `NPC #${n.npcId}`}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  #{n.npcId}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

interface NpcDotProps {
  placement: NpcPlacement;
  tilesW: number;
  tilesH: number;
  active: boolean;
  onActiveChange: (active: boolean) => void;
}

function NpcDot({ placement, tilesW, tilesH, active, onActiveChange }: NpcDotProps) {
  const label = placement.name ?? `NPC #${placement.npcId}`;
  const left = (placement.tileX / tilesW) * 100;
  const top = (placement.tileY / tilesH) * 100;

  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        openOnHover
        delay={0}
        onMouseEnter={() => onActiveChange(true)}
        onMouseLeave={() => onActiveChange(false)}
        onFocus={() => onActiveChange(true)}
        onBlur={() => onActiveChange(false)}
        style={{ left: `${left}%`, top: `${top}%` }}
        className={cn(
          "absolute size-3 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full",
          "border-2 border-background bg-primary shadow outline-hidden",
          "ring-primary/50 transition-transform focus-visible:ring-4",
          active && "z-10 scale-150 ring-4",
        )}
      />
      <PopoverContent className="w-auto max-w-xs flex-row items-center gap-2.5">
        <EntityPortrait image={placement.image} alt={label} size="sm" />
        <span className="font-medium">{label}</span>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test -- src/components/maps/__tests__/stage-map-viewer.test.tsx`
Expected: PASS（3 個測試全綠）。

- [ ] **Step 5: Commit**

```bash
git add src/components/maps/stage-map-viewer.tsx src/components/maps/__tests__/stage-map-viewer.test.tsx
git commit -m "feat(maps): add StageMapViewer with NPC dot overlay + list"
```

---

### Task 3: 整合進地圖詳情頁

**Files:**
- Modify: `src/app/maps/[id]/page.tsx`（新增匯入、查資料、於 header 後渲染 `<StageMapViewer>`）

**Interfaces:**
- Consumes: `getStageMapImage`、`getNpcPlacementsForStage` from `@/lib/queries/maps`；`StageMapViewer` from `@/components/maps/stage-map-viewer`。

- [ ] **Step 1: 加入匯入**

在 `src/app/maps/[id]/page.tsx` 既有 import 區塊加入：

```ts
import { getStageMapImage, getNpcPlacementsForStage } from "@/lib/queries/maps";
import { StageMapViewer } from "@/components/maps/stage-map-viewer";
```

- [ ] **Step 2: 於 `MapDetailPage` 查詢資料**

在 `const monsters = getMonstersAtStage(stage.kind, stage.id);` 之後加入：

```ts
  const mapImage = getStageMapImage(stage.kind, stage.id);
  const npcPlacements = getNpcPlacementsForStage(stage.kind, stage.id);
```

- [ ] **Step 3: 於 header 之後、`<PropertiesGrid>` 之前渲染**

將原本：

```tsx
      </header>

      <PropertiesGrid stage={stage} />
```

改為：

```tsx
      </header>

      <StageMapViewer stageName={stage.name} image={mapImage} placements={npcPlacements} />

      <PropertiesGrid stage={stage} />
```

（`stage.name` 於此處已確定非 null —— 前面 `if (!stage || !stage.name) notFound();` 已保證。）

- [ ] **Step 4: 型別/建置驗證**

Run: `npm run typecheck`
Expected: 無錯誤。

Run: `npm run lint`
Expected: 無錯誤（`<img>` 已加 eslint-disable 註解）。

- [ ] **Step 5: Commit**

```bash
git add src/app/maps/[id]/page.tsx
git commit -m "feat(maps): render map image + NPC overlay on stage detail page"
```

---

### Task 4: 全量驗證與收尾

**Files:** 無（僅執行驗證）

- [ ] **Step 1: 全測試綠燈**

Run: `npm test`
Expected: 全部通過（含新增的 `maps.test.ts`、`stage-map-viewer.test.tsx`，既有測試不回歸）。

- [ ] **Step 2: 正式建置**

Run: `npm run build`
Expected: 建置成功（standalone output），`/maps/[id]` 為動態或靜態皆可，無型別/lint 錯誤。

- [ ] **Step 3: 交付人工/畫面驗收（使用者執行）**

以 dev server 檢查下列情境：
- 有圖 + 多 NPC：`/maps/2`（莫愁谷村莊）—— 圓點對齊地圖、hover 彈頭像卡、清單 ↔ 圓點互相高亮。
- 有圖 + 無 NPC：`/maps/42`（凌霄閣）—— 只有地圖圖、無 NPC 清單。
- 無圖 + 有 NPC：找一張無 `map_images` 但有 NPC 的地圖 —— 只有清單。
- 手機寬度：點圓點開卡、清單可捲。

## Self-Review

**Spec coverage：**
- 資料層（spec §3.1）→ Task 1（`getStageMapImage` / `getNpcPlacementsForStage`，重用 `getNpcImageMap`）。✅
- `<StageMapViewer>`（spec §3.2）→ Task 2（圖 + 疊點 + 彈卡 + 清單 + 互相高亮）。✅
- Popover 重用既有 `ui/popover.tsx`（spec §3.2 修正）→ Task 2 直接 import。✅
- NPC 純展示不連結（spec §2 修正）→ Task 2 清單為非連結 `<li>`、彈卡無連結。✅
- 版面：header 後、PropertiesGrid 前、上下堆疊（spec §3.3）→ Task 3。✅
- 邊界：無圖只清單 / 有圖無 NPC 只圖 / 皆無回 null / `in_bounds=1` 過濾（spec §4）→ Task 1 查詢 + Task 2 條件渲染 + 測試涵蓋。✅
- 驗證（spec §6）→ Task 1/2 單元 + 元件測試、Task 4 lint/build/人工。✅

**Placeholder scan：** 無 TBD/TODO；每個程式步驟均含完整程式碼。✅

**Type consistency：** `StageMapImage`/`NpcPlacement` 於 Task 1 定義，Task 2/3 一致引用；`getNpcImageMap`/`EntityImage` 沿用既有 `images.ts` 匯出；`StageMapViewer` props（`stageName`/`image`/`placements`）於 Task 2 定義、Task 3 一致傳入。✅
