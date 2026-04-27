# Sort Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side, URL-param-driven column sort to Items, Monsters, and Skills list pages with a three-state (asc → desc → reset) toggle on numeric column headers.

**Architecture:** `sortBy`/`sortDir` URL params flow from page → query function (allowlist-gated ORDER BY) → Table component → `SortableHead` (server component, renders `<Link>` with lucide icons). `SortableHead` owns page-reset logic (`delete("page")` on every sort click).

**Tech Stack:** Next.js App Router (server components), better-sqlite3, lucide-react, shadcn/ui Table primitives, vitest.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/lib/queries/items.ts` | Add `sortBy`/`sortDir` to params + allowlist ORDER BY |
| Modify | `src/lib/queries/monsters.ts` | Same, n. alias aware |
| Modify | `src/lib/queries/magic.ts` | Same, GROUP BY alias + name tiebreak |
| Create | `src/components/common/sortable-head.tsx` | `SortableHead` component + exported `nextSortHref` |
| Modify | `src/app/items/page.tsx` | Read sort params, build searchParamsStr, pass to table |
| Modify | `src/app/monsters/page.tsx` | Same |
| Modify | `src/app/skills/page.tsx` | Same |
| Modify | `src/components/items/item-table.tsx` | Accept sort props, use SortableHead on level/weight/id |
| Modify | `src/components/monsters/monster-table.tsx` | Same, level/hp/id |
| Modify | `src/components/skills/skill-table.tsx` | Same, maxLevel/id |

---

## Task 1: Items query — add sort support

**Files:**
- Modify: `src/lib/queries/items.ts`
- Test: `src/lib/queries/__tests__/items-phase2.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/lib/queries/__tests__/items-phase2.test.ts`:

```typescript
describe("getItems — sort", () => {
  it("sorts by level ascending", () => {
    const result = getItems({ sortBy: "level", sortDir: "asc", pageSize: 20 });
    expect(result.items.length).toBeGreaterThan(0);
    const levels = result.items.map((i) => i.level);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    }
  });

  it("sorts by level descending", () => {
    const result = getItems({ sortBy: "level", sortDir: "desc", pageSize: 20 });
    const levels = result.items.map((i) => i.level);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeLessThanOrEqual(levels[i - 1]);
    }
  });

  it("sorts by id ascending", () => {
    const result = getItems({ sortBy: "id", sortDir: "asc", pageSize: 20 });
    const ids = result.items.map((i) => i.id);
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeGreaterThanOrEqual(ids[i - 1]);
    }
  });

  it("ignores invalid sortBy and falls back to default order", () => {
    const defaultResult = getItems({ pageSize: 20 });
    const invalidResult = getItems({ sortBy: "'; DROP TABLE items; --", pageSize: 20 });
    expect(invalidResult.items.map((i) => i.id)).toEqual(defaultResult.items.map((i) => i.id));
  });
});
```

Also add `getItems` to the import at line 1:
```typescript
import { getItemsByType, getItemsByIds, getItemRandsByIds, getItems } from "../items";
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- items-phase2
```

Expected: `getItems is not a function` or sort order assertions fail (function exists but sort params ignored).

- [ ] **Step 3: Implement sort in `getItems`**

In `src/lib/queries/items.ts`, add the allowlist constant before `getItems` (after the imports):

```typescript
const ITEM_SORT_ALLOWLIST: Record<string, string> = {
  level: "level",
  weight: "weight",
  id: "id",
};
```

Update `GetItemsParams` interface:

```typescript
export interface GetItemsParams {
  search?: string;
  type?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
}
```

Inside `getItems()`, replace the hard-coded ORDER BY line:

```typescript
// BEFORE (line ~94):
  const items = db
    .prepare(`SELECT * FROM items ${whereSql} ORDER BY level DESC, id ASC LIMIT ? OFFSET ?`)
    .all(...args, pageSize, offset) as Item[];

// AFTER:
  const sortCol = params.sortBy ? (ITEM_SORT_ALLOWLIST[params.sortBy] ?? null) : null;
  const sortDirSql = params.sortDir === "desc" ? "DESC" : "ASC";
  const orderBy = sortCol
    ? sortCol === "id"
      ? `ORDER BY id ${sortDirSql}`
      : `ORDER BY ${sortCol} ${sortDirSql}, id ASC`
    : `ORDER BY level DESC, id ASC`;

  const items = db
    .prepare(`SELECT * FROM items ${whereSql} ${orderBy} LIMIT ? OFFSET ?`)
    .all(...args, pageSize, offset) as Item[];
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- items-phase2
```

Expected: all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/items.ts src/lib/queries/__tests__/items-phase2.test.ts
git commit -m "feat(items): add sortBy/sortDir to getItems with allowlist ORDER BY"
```

---

## Task 2: Monsters query — add sort support

**Files:**
- Modify: `src/lib/queries/monsters.ts`
- Test: `src/lib/queries/__tests__/monsters.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/lib/queries/__tests__/monsters.test.ts` (inside the `describe("getMonsters", ...)` block or as a new describe):

```typescript
describe("getMonsters — sort", () => {
  it("sorts by level ascending", () => {
    const result = getMonsters({ sortBy: "level", sortDir: "asc", pageSize: 20 });
    const levels = result.monsters.map((m) => m.level);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    }
  });

  it("sorts by level descending", () => {
    const result = getMonsters({ sortBy: "level", sortDir: "desc", pageSize: 20 });
    const levels = result.monsters.map((m) => m.level);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeLessThanOrEqual(levels[i - 1]);
    }
  });

  it("sorts by hp descending — top results have non-null hp", () => {
    // Use pageSize: 5 to stay well within high-hp monsters; avoids NULL-hp edge cases
    // (SQLite puts NULL last in DESC, ?? 0 would corrupt the >= chain if NULLs appear)
    const result = getMonsters({ sortBy: "hp", sortDir: "desc", pageSize: 5 });
    expect(result.monsters.length).toBeGreaterThan(0);
    const hps = result.monsters.map((m) => m.hp);
    for (const hp of hps) expect(hp).not.toBeNull();
    for (let i = 1; i < hps.length; i++) {
      expect(hps[i]!).toBeLessThanOrEqual(hps[i - 1]!);
    }
  });

  it("ignores invalid sortBy and falls back to default order", () => {
    const defaultResult = getMonsters({ pageSize: 20 });
    const invalidResult = getMonsters({ sortBy: "n.drop_item", pageSize: 20 });
    expect(invalidResult.monsters.map((m) => m.id)).toEqual(
      defaultResult.monsters.map((m) => m.id),
    );
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- monsters
```

Expected: sort order assertions fail (params ignored, still uses default order).

- [ ] **Step 3: Implement sort in `getMonsters`**

In `src/lib/queries/monsters.ts`, add the allowlist before `getMonsters`:

```typescript
const MONSTER_SORT_ALLOWLIST: Record<string, string> = {
  level: "n.level",
  hp: "n.hp",
  id: "n.id",
};
```

Update `GetMonstersParams` interface — add after `pageSize`:

```typescript
  sortBy?: string;
  sortDir?: string;
```

Inside `getMonsters()`, replace the hard-coded ORDER BY (currently `ORDER BY n.level ASC, n.id ASC`):

```typescript
  const sortCol = params.sortBy ? (MONSTER_SORT_ALLOWLIST[params.sortBy] ?? null) : null;
  const sortDirSql = params.sortDir === "desc" ? "DESC" : "ASC";
  const orderBy = sortCol
    ? sortCol === "n.id"
      ? `ORDER BY n.id ${sortDirSql}`
      : `ORDER BY ${sortCol} ${sortDirSql}, n.id ASC`
    : `ORDER BY n.level ASC, n.id ASC`;
```

In the `.prepare(...)` call, replace `ORDER BY n.level ASC, n.id ASC` with `${orderBy}`.

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- monsters
```

Expected: all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/monsters.ts src/lib/queries/__tests__/monsters.test.ts
git commit -m "feat(monsters): add sortBy/sortDir to getMonsters with allowlist ORDER BY"
```

---

## Task 3: Skills query — add sort support with name tiebreak

**Files:**
- Modify: `src/lib/queries/magic.ts`
- Test: `src/lib/queries/__tests__/magic.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/lib/queries/__tests__/magic.test.ts`:

```typescript
describe("getSkills — sort", () => {
  it("sorts by maxLevel ascending", () => {
    const result = getSkills({ sortBy: "maxLevel", sortDir: "asc", pageSize: 20 });
    const levels = result.skills.map((s) => s.maxLevel);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    }
  });

  it("sorts by maxLevel descending", () => {
    const result = getSkills({ sortBy: "maxLevel", sortDir: "desc", pageSize: 20 });
    const levels = result.skills.map((s) => s.maxLevel);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeLessThanOrEqual(levels[i - 1]);
    }
  });

  it("stable across pages when sorted by maxLevel asc — no overlap or gap", () => {
    const p1 = getSkills({ sortBy: "maxLevel", sortDir: "asc", pageSize: 5, page: 1 });
    const p2 = getSkills({ sortBy: "maxLevel", sortDir: "asc", pageSize: 5, page: 2 });
    const p1Keys = new Set(p1.skills.map((s) => `${s.id}::${s.name}`));
    for (const s of p2.skills) expect(p1Keys.has(`${s.id}::${s.name}`)).toBe(false);
    const p1MaxLevel = Math.max(...p1.skills.map((s) => s.maxLevel));
    const p2MinLevel = Math.min(...p2.skills.map((s) => s.maxLevel));
    expect(p1MaxLevel).toBeLessThanOrEqual(p2MinLevel);
  });

  it("ignores invalid sortBy and falls back to default order", () => {
    const defaultResult = getSkills({ pageSize: 20 });
    const invalidResult = getSkills({ sortBy: "clan", pageSize: 20 });
    expect(invalidResult.skills.map((s) => `${s.id}::${s.name}`)).toEqual(
      defaultResult.skills.map((s) => `${s.id}::${s.name}`),
    );
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- magic
```

Expected: sort order and cross-page stability assertions fail.

- [ ] **Step 3: Implement sort in `getSkills`**

In `src/lib/queries/magic.ts`, add the allowlist before `getSkills`:

```typescript
const SKILL_SORT_ALLOWLIST: Record<string, string> = {
  maxLevel: "maxLevel",
  id: "id",
};
```

Update `GetSkillsParams` interface — add after `pageSize`:

```typescript
  sortBy?: string;
  sortDir?: string;
```

Inside `getSkills()`, replace the hard-coded `ORDER BY maxLevel DESC, id ASC, firstLevel ASC`:

```typescript
  const sortCol = params.sortBy ? (SKILL_SORT_ALLOWLIST[params.sortBy] ?? null) : null;
  const sortDirSql = params.sortDir === "desc" ? "DESC" : "ASC";
  // name tiebreak required: magic table's unique key is (id, name), not id alone.
  const orderBy = sortCol
    ? sortCol === "id"
      ? `ORDER BY id ${sortDirSql}, name ASC`
      : `ORDER BY ${sortCol} ${sortDirSql}, id ASC, name ASC`
    : `ORDER BY maxLevel DESC, id ASC, firstLevel ASC`;
```

In the `.prepare(...)` call, replace `ORDER BY maxLevel DESC, id ASC, firstLevel ASC` with `${orderBy}`.

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- magic
```

Expected: all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/magic.ts src/lib/queries/__tests__/magic.test.ts
git commit -m "feat(skills): add sortBy/sortDir to getSkills with name tiebreak"
```

---

## Task 4: `SortableHead` component

**Files:**
- Create: `src/components/common/sortable-head.tsx`
- Create: `src/components/common/__tests__/sortable-head.test.ts`

- [ ] **Step 1: Write failing tests for `nextSortHref`**

Create `src/components/common/__tests__/sortable-head.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { nextSortHref } from "../sortable-head";

describe("nextSortHref", () => {
  it("no active sort → clicking any column starts at asc", () => {
    const href = nextSortHref("search=foo", "/items", "level", undefined, undefined);
    expect(href).toBe("/items?search=foo&sortBy=level&sortDir=asc");
  });

  it("active column asc → clicking it gives desc", () => {
    const href = nextSortHref("sortBy=level&sortDir=asc", "/items", "level", "level", "asc");
    expect(href).toBe("/items?sortBy=level&sortDir=desc");
  });

  it("active column desc → clicking it resets to default (no sort params)", () => {
    const href = nextSortHref("sortBy=level&sortDir=desc", "/items", "level", "level", "desc");
    expect(href).toBe("/items");
  });

  it("different column → starts at asc regardless of current sort", () => {
    const href = nextSortHref("sortBy=level&sortDir=desc", "/items", "weight", "level", "desc");
    expect(href).toBe("/items?sortBy=weight&sortDir=asc");
  });

  it("always deletes page param", () => {
    const href = nextSortHref("search=a&page=5", "/monsters", "level", undefined, undefined);
    expect(href).toBe("/monsters?search=a&sortBy=level&sortDir=asc");
    expect(href).not.toContain("page=");
  });

  it("preserves other params (search, type, etc.)", () => {
    const href = nextSortHref(
      "search=foo&type=%E5%BA%A7%E9%A8%B2",
      "/items",
      "level",
      undefined,
      undefined,
    );
    expect(href).toContain("search=foo");
    expect(href).toContain("sortBy=level");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- sortable-head
```

Expected: `Cannot find module '../sortable-head'`.

- [ ] **Step 3: Create `SortableHead` component**

Create `src/components/common/sortable-head.tsx`:

```tsx
import Link from "next/link";
import { ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface SortableHeadProps {
  column: string;
  label: React.ReactNode;
  currentSortBy?: string;
  currentSortDir?: string;
  searchParamsStr: string;
  basePath: string;
  right?: boolean;
  className?: string;
}

export function nextSortHref(
  searchParamsStr: string,
  basePath: string,
  column: string,
  currentSortBy: string | undefined,
  currentSortDir: string | undefined,
): string {
  const params = new URLSearchParams(searchParamsStr);
  params.delete("page");

  if (currentSortBy === column) {
    if (currentSortDir === "asc") {
      params.set("sortBy", column);
      params.set("sortDir", "desc");
    } else {
      params.delete("sortBy");
      params.delete("sortDir");
    }
  } else {
    params.set("sortBy", column);
    params.set("sortDir", "asc");
  }

  return `${basePath}${params.size > 0 ? `?${params}` : ""}`;
}

export function SortableHead({
  column,
  label,
  currentSortBy,
  currentSortDir,
  searchParamsStr,
  basePath,
  right = false,
  className,
}: SortableHeadProps) {
  const isActive = currentSortBy === column;
  const href = nextSortHref(searchParamsStr, basePath, column, currentSortBy, currentSortDir);

  const Icon =
    isActive && currentSortDir === "asc"
      ? ChevronUpIcon
      : isActive && currentSortDir === "desc"
        ? ChevronDownIcon
        : ChevronsUpDownIcon;

  return (
    <TableHead className={cn(className, right && "text-right")}>
      <Link
        href={href}
        className={cn(
          "flex h-full w-full items-center gap-1 hover:text-foreground",
          right && "justify-end",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </Link>
    </TableHead>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- sortable-head
```

Expected: all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/common/sortable-head.tsx src/components/common/__tests__/sortable-head.test.ts
git commit -m "feat: add SortableHead server component with nextSortHref"
```

---

## Task 5: Items page + table wiring

**Files:**
- Modify: `src/app/items/page.tsx`
- Modify: `src/components/items/item-table.tsx`

- [ ] **Step 1: Update `src/app/items/page.tsx`**

Replace the entire file content:

```tsx
import { Suspense } from "react";
import { getItems } from "@/lib/queries/items";
import { ItemFilters } from "@/components/items/item-filters";
import { ItemTable } from "@/components/items/item-table";
import { ItemPagination } from "@/components/items/item-pagination";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    type?: string;
    page?: string;
    sortBy?: string;
    sortDir?: string;
  }>;
}

export default async function ItemsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search ?? "";
  const type = params.type ?? "";
  const page = Number(params.page) || 1;
  const sortBy = params.sortBy;
  const sortDir = params.sortDir;

  const result = getItems({ search, type, page, sortBy, sortDir });

  const searchParamsStr = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v != null && v !== "" && v !== false)
      .map(([k, v]) => [k, String(v === true ? "1" : v)] as [string, string]),
  ).toString();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">道具查詢</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          共 {result.total.toLocaleString()} 筆{search || type ? "（符合條件）" : ""}
        </p>
      </header>

      <div className="mb-6">
        <Suspense fallback={null}>
          <ItemFilters initialSearch={search} initialType={type} />
        </Suspense>
      </div>

      <ItemTable
        items={result.items}
        sortBy={sortBy}
        sortDir={sortDir}
        searchParamsStr={searchParamsStr}
      />

      {result.totalPages > 1 && (
        <div className="mt-6">
          <Suspense fallback={null}>
            <ItemPagination page={result.page} totalPages={result.totalPages} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `src/components/items/item-table.tsx`**

Replace the entire file content:

```tsx
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SortableHead } from "@/components/common/sortable-head";
import type { Item } from "@/lib/types/item";

interface ItemTableProps {
  items: Item[];
  sortBy?: string;
  sortDir?: string;
  searchParamsStr: string;
}

export function ItemTable({ items, sortBy, sortDir, searchParamsStr }: ItemTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-card px-6 py-12 text-center text-muted-foreground">
        找不到符合條件的道具
      </div>
    );
  }

  const sortProps = { currentSortBy: sortBy, currentSortDir: sortDir, searchParamsStr, basePath: "/items" };

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow>
            <SortableHead column="id" label="編號" className="w-[90px]" {...sortProps} />
            <TableHead>名稱</TableHead>
            <TableHead className="w-[140px]">類型</TableHead>
            <SortableHead column="level" label="等級" className="w-[70px]" right {...sortProps} />
            <SortableHead column="weight" label="重量" className="w-[70px]" right {...sortProps} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono text-xs text-muted-foreground">{item.id}</TableCell>
              <TableCell>
                <Link href={`/items/${item.id}`} className="font-medium hover:underline">
                  {item.name}
                </Link>
                {item.note && (
                  <span className="ml-2 text-xs text-muted-foreground">{item.note}</span>
                )}
              </TableCell>
              <TableCell>
                {item.type ? (
                  <Badge variant="secondary" className="font-normal">
                    {item.type}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">{item.level}</TableCell>
              <TableCell className="text-right">{item.weight}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/items/page.tsx src/components/items/item-table.tsx
git commit -m "feat(items): wire sortBy/sortDir into page and table headers"
```

---

## Task 6: Monsters page + table wiring

**Files:**
- Modify: `src/app/monsters/page.tsx`
- Modify: `src/components/monsters/monster-table.tsx`

- [ ] **Step 1: Update `src/app/monsters/page.tsx`**

Replace the entire file content:

```tsx
import { Suspense } from "react";
import {
  getMonsters,
  getDistinctMonsterTypes,
  getDistinctElementals,
} from "@/lib/queries/monsters";
import { MonsterFilters } from "@/components/monsters/monster-filters";
import { MonsterTable } from "@/components/monsters/monster-table";
import { Pagination } from "@/components/common/pagination";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    type?: string;
    elemental?: string;
    hasDrop?: string;
    isNormal?: string;
    page?: string;
    sortBy?: string;
    sortDir?: string;
  }>;
}

export default async function MonstersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search ?? "";
  const typeRaw = params.type ?? "";
  const elemental = params.elemental ?? "";
  const hasDrop = params.hasDrop === "1";
  const isNormal = params.isNormal === "1";
  const page = Number(params.page) || 1;
  const sortBy = params.sortBy;
  const sortDir = params.sortDir;

  const typeNum = typeRaw ? Number(typeRaw) : undefined;
  const result = getMonsters({
    search,
    type: Number.isInteger(typeNum) ? typeNum : undefined,
    elemental: elemental || undefined,
    hasDrop,
    isNormal,
    page,
    sortBy,
    sortDir,
  });
  const availableTypes = getDistinctMonsterTypes();
  const availableElementals = getDistinctElementals();

  const hasFilter = !!(search || typeRaw || elemental || hasDrop || isNormal);

  // undefined/empty filtered out; boolean coercion guarded for safety
  const searchParamsStr = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v != null && v !== "" && v !== false)
      .map(([k, v]) => [k, String(v === true ? "1" : v)] as [string, string]),
  ).toString();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">怪物查詢</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          共 {result.total.toLocaleString()} 隻{hasFilter ? "（符合條件）" : ""}
        </p>
      </header>

      <div className="mb-6">
        <Suspense fallback={null}>
          <MonsterFilters
            initialSearch={search}
            initialType={typeRaw}
            initialElemental={elemental}
            initialHasDrop={hasDrop}
            initialIsNormal={isNormal}
            availableTypes={availableTypes}
            availableElementals={availableElementals}
          />
        </Suspense>
      </div>

      <MonsterTable
        monsters={result.monsters}
        sortBy={sortBy}
        sortDir={sortDir}
        searchParamsStr={searchParamsStr}
      />

      {result.totalPages > 1 && (
        <div className="mt-6">
          <Suspense fallback={null}>
            <Pagination page={result.page} totalPages={result.totalPages} basePath="/monsters" />
          </Suspense>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `src/components/monsters/monster-table.tsx`**

Replace the entire file content:

```tsx
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SortableHead } from "@/components/common/sortable-head";
import { monsterTypeLabel } from "@/lib/constants/monster-type";
import type { MonsterSummary } from "@/lib/types/monster";

interface MonsterTableProps {
  monsters: MonsterSummary[];
  sortBy?: string;
  sortDir?: string;
  searchParamsStr: string;
}

export function MonsterTable({ monsters, sortBy, sortDir, searchParamsStr }: MonsterTableProps) {
  if (monsters.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-card px-6 py-12 text-center text-muted-foreground">
        找不到符合條件的怪物
      </div>
    );
  }

  const sortProps = { currentSortBy: sortBy, currentSortDir: sortDir, searchParamsStr, basePath: "/monsters" };

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow>
            <SortableHead column="id" label="編號" className="w-[90px]" {...sortProps} />
            <TableHead>名稱</TableHead>
            <TableHead className="w-[120px]">類型</TableHead>
            <TableHead className="w-[70px]">屬性</TableHead>
            <SortableHead column="level" label="等級" className="w-[80px]" right {...sortProps} />
            <SortableHead column="hp" label="血量" className="w-[100px]" right {...sortProps} />
            <TableHead className="w-[80px]">掉落</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {monsters.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-mono text-xs text-muted-foreground">{m.id}</TableCell>
              <TableCell>
                <Link href={`/monsters/${m.id}`} className="font-medium hover:underline">
                  {m.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{monsterTypeLabel(m.type)}</TableCell>
              <TableCell>
                {m.elemental ? (
                  <Badge variant="outline" className="font-normal">
                    {m.elemental}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">{m.level}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {m.hp != null ? m.hp.toLocaleString() : "—"}
              </TableCell>
              <TableCell>
                {m.hasDrop ? (
                  <Badge variant="secondary" className="font-normal">
                    有
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">無</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/monsters/page.tsx src/components/monsters/monster-table.tsx
git commit -m "feat(monsters): wire sortBy/sortDir into page and table headers"
```

---

## Task 7: Skills page + table wiring

**Files:**
- Modify: `src/app/skills/page.tsx`
- Modify: `src/components/skills/skill-table.tsx`

- [ ] **Step 1: Update `src/app/skills/page.tsx`**

Replace the entire file content:

```tsx
import { Suspense } from "react";
import {
  getSkills,
  getDistinctClans,
  getDistinctTargets,
  getDistinctSkillTypes,
} from "@/lib/queries/magic";
import { SkillFilters } from "@/components/skills/skill-filters";
import { SkillTable } from "@/components/skills/skill-table";
import { Pagination } from "@/components/common/pagination";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    clan?: string;
    target?: string;
    skillType?: string;
    page?: string;
    sortBy?: string;
    sortDir?: string;
  }>;
}

export default async function SkillsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search ?? "";
  const clan = params.clan ?? "";
  const target = params.target ?? "";
  const skillTypeRaw = params.skillType ?? "";
  const skillTypeParsed = Number(skillTypeRaw);
  const skillType = Number.isInteger(skillTypeParsed) && skillTypeParsed > 0 ? skillTypeParsed : undefined;
  const page = Number(params.page) || 1;
  const sortBy = params.sortBy;
  const sortDir = params.sortDir;

  const result = getSkills({ search, clan, target, skillType, page, sortBy, sortDir });
  const availableClans = getDistinctClans();
  const availableTargets = getDistinctTargets();
  const availableSkillTypes = getDistinctSkillTypes();

  const hasFilter = !!(search || clan || target || skillType);

  const searchParamsStr = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v != null && v !== "" && v !== false)
      .map(([k, v]) => [k, String(v === true ? "1" : v)] as [string, string]),
  ).toString();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">技能瀏覽</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          共 {result.total.toLocaleString()} 個技能{hasFilter ? "（符合條件）" : ""}
        </p>
      </header>

      <div className="mb-6">
        <Suspense fallback={null}>
          <SkillFilters
            initialSearch={search}
            initialClan={clan}
            initialTarget={target}
            initialSkillType={skillTypeRaw}
            availableClans={availableClans}
            availableTargets={availableTargets}
            availableSkillTypes={availableSkillTypes}
          />
        </Suspense>
      </div>

      <SkillTable
        skills={result.skills}
        sortBy={sortBy}
        sortDir={sortDir}
        searchParamsStr={searchParamsStr}
      />

      {result.totalPages > 1 && (
        <div className="mt-6">
          <Suspense fallback={null}>
            <Pagination page={result.page} totalPages={result.totalPages} basePath="/skills" />
          </Suspense>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `src/components/skills/skill-table.tsx`**

Replace the entire file content:

```tsx
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SortableHead } from "@/components/common/sortable-head";
import { magicClanListLabel } from "@/lib/constants/magic-clan";
import { magicTargetLabel } from "@/lib/constants/magic-target";
import { magicAttribLabel, MAGIC_ATTRIB_COLOR } from "@/lib/constants/magic-attrib";
import { magicSkillTypeLabel } from "@/lib/constants/magic-skill-type";
import type { MagicSummary } from "@/lib/types/magic";

interface SkillTableProps {
  skills: MagicSummary[];
  sortBy?: string;
  sortDir?: string;
  searchParamsStr: string;
}

export function SkillTable({ skills, sortBy, sortDir, searchParamsStr }: SkillTableProps) {
  if (skills.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-card px-6 py-12 text-center text-muted-foreground">
        找不到符合條件的技能
      </div>
    );
  }

  const sortProps = { currentSortBy: sortBy, currentSortDir: sortDir, searchParamsStr, basePath: "/skills" };

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow>
            <SortableHead column="id" label="編號" className="w-[90px]" {...sortProps} />
            <TableHead>名稱</TableHead>
            <TableHead className="w-[120px]">門派</TableHead>
            <TableHead className="w-[110px]">分類</TableHead>
            <TableHead className="w-[120px]">作用目標</TableHead>
            <TableHead className="w-[70px]">屬性</TableHead>
            <SortableHead column="maxLevel" label="最高 Lv" className="w-[80px]" right {...sortProps} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {skills.map((s) => {
            const attribLabel = magicAttribLabel(s.attrib);
            const attribColor = s.attrib != null ? MAGIC_ATTRIB_COLOR[s.attrib] : null;
            const clanDisplay = magicClanListLabel(s.clan, s.skill_type);
            return (
              <TableRow key={`${s.id}-${s.firstLevel}`}>
                <TableCell className="font-mono text-xs text-muted-foreground">{s.id}</TableCell>
                <TableCell>
                  <Link
                    href={`/skills/${s.id}?level=${s.firstLevel}`}
                    className="font-medium hover:underline"
                  >
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {clanDisplay.kind === "clan" ? (
                    <Badge variant="secondary" className="font-normal">
                      {clanDisplay.label}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">{clanDisplay.label}</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {magicSkillTypeLabel(s.skill_type)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {magicTargetLabel(s.target)}
                </TableCell>
                <TableCell>
                  {attribLabel ? (
                    <Badge variant="outline" className={`font-normal ${attribColor ?? ""}`}>
                      {attribLabel}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{s.maxLevel}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Run all tests + type-check**

```bash
npm test && npx tsc --noEmit
```

Expected: all tests green, no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/skills/page.tsx src/components/skills/skill-table.tsx
git commit -m "feat(skills): wire sortBy/sortDir into page and table headers"
```

---

## Final Verification

- [ ] Start dev server: `npm run dev`
- [ ] Visit `/items` — 等級/重量/編號 headers show `ChevronsUpDown` icon
- [ ] Click 等級 → URL gains `?sortBy=level&sortDir=asc`, table re-orders ascending
- [ ] Click 等級 again → `sortDir=desc`, table re-orders descending
- [ ] Click 等級 again → sortBy/sortDir removed from URL, back to default `level DESC`
- [ ] On page 5 (`?page=5`), click any sort header → URL drops `page`, returns to page 1
- [ ] With `?hasDrop=1` filter active, click a sort header → `hasDrop=1` preserved, no `hasDrop=false` in URL
- [ ] Repeat equivalent checks on `/monsters` and `/skills`
- [ ] On `/skills?sortBy=maxLevel&sortDir=asc`, navigate to page 2 and verify no skill from page 1 appears (cross-page stable — catches id-only tiebreak regression where same-id different-name skills could duplicate or vanish at page boundary)
