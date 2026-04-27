# 列表欄位排序功能設計

**日期：** 2026-04-27
**範圍：** Items、Monsters、Skills 三個列表頁
**狀態：** 已核准，待實作

---

## 目標

在 Items、Monsters、Skills 列表頁的數值欄位標頭加入可點擊排序功能。排序為全資料集伺服器端排序（非當頁排序），結果透過 URL params 驅動，可分享、可書籤、瀏覽器返回鍵正確。

---

## 不在範圍內

- Compounds、Missions、Maps hub 頁（另行規劃）
- 文字分類欄位排序（類型、屬性、門派等已有 filter 篩選）
- 名稱欄排序

---

## 架構

```
URL params (sortBy, sortDir)
  → page.tsx（讀取、驗證）
  → query function（動態 ORDER BY）
  → Table component（渲染 SortableHead）
  → SortableHead（計算下一個 href → <Link>）
```

`SortableHead` 為 server component，不使用 `useSearchParams`，由 server page 傳入 `searchParamsStr`。既有的 `Pagination` 維持原本的 `"use client"`，不修改。

---

## 可排序欄位

| 表 | 可排序欄位 | 預設排序（無 sortBy 時） |
|---|---|---|
| Items | `level`（等級）、`weight`（重量）、`id`（編號） | `level DESC, id ASC` |
| Monsters | `level`（等級）、`hp`（血量）、`id`（編號） | `n.level ASC, n.id ASC` |
| Skills | `maxLevel`（最高 Lv）、`id`（編號） | `maxLevel DESC, id ASC, firstLevel ASC` |

---

## URL 參數

| 參數 | 值 | 說明 |
|---|---|---|
| `sortBy` | 欄位名稱字串 | 必須在各表 allowlist 內，否則視為無效 |
| `sortDir` | `asc` \| `desc` | 缺省視為 `asc` |

無 `sortBy` → 使用原預設 ORDER BY。排序變更時重設 `page` 為 1（由 SortableHead 負責，見下）。

---

## 三態切換邏輯

| 目前狀態 | 點同一欄 | 點其他欄 |
|---|---|---|
| 無作用欄 | 該欄 `asc` | 該欄 `asc` |
| 作用欄 `asc` | 該欄 `desc` | 新欄 `asc` |
| 作用欄 `desc` | 移除 `sortBy`/`sortDir`（回預設） | 新欄 `asc` |

---

## 元件設計

### `SortableHead`（新增）

```
src/components/common/sortable-head.tsx
```

Server component，無 `"use client"`。

```tsx
interface SortableHeadProps {
  column: string           // e.g. "level"
  label: React.ReactNode
  currentSortBy?: string
  currentSortDir?: string  // "asc" | "desc"
  searchParamsStr: string  // URLSearchParams.toString() from server page（不含 page）
  basePath: string         // e.g. "/items"
  className?: string
}
```

**href 計算邏輯（SortableHead 內部，每次都 delete page）：**

```typescript
function nextSortHref(
  searchParamsStr: string,
  basePath: string,
  column: string,
  currentSortBy: string | undefined,
  currentSortDir: string | undefined,
): string {
  const params = new URLSearchParams(searchParamsStr);
  params.delete("page"); // 排序切換永遠回第 1 頁

  if (currentSortBy === column) {
    if (currentSortDir === "asc") {
      params.set("sortBy", column);
      params.set("sortDir", "desc");
    } else {
      // desc → 重置
      params.delete("sortBy");
      params.delete("sortDir");
    }
  } else {
    params.set("sortBy", column);
    params.set("sortDir", "asc");
  }

  return `${basePath}${params.size > 0 ? `?${params}` : ""}`;
}
```

**圖示（lucide-react）：**

| 狀態 | 圖示 | 顏色 |
|---|---|---|
| 非作用（可排序） | `ChevronsUpDown` | `text-muted-foreground` |
| 作用 asc | `ChevronUp` | `text-foreground` |
| 作用 desc | `ChevronDown` | `text-foreground` |

非可排序欄維持純文字 `<TableHead>`，不做任何改動。

### Table components（修改）

三個 table 元件各新增 props：

```tsx
interface ItemTableProps {
  items: Item[]
  sortBy?: string
  sortDir?: string
  searchParamsStr: string
}
// MonsterTable、SkillTable 同樣結構
```

### Page components（修改）

```tsx
// searchParams 新增兩個欄位
interface PageProps {
  searchParams: Promise<{
    search?: string
    // ...現有欄位...
    sortBy?: string
    sortDir?: string
  }>
}

// 傳入 query
const result = getItems({ search, type, page, sortBy, sortDir })

// 傳入 table：過濾 boolean false / 空字串，true → "1"，避免污染 URL
const searchParamsStr = new URLSearchParams(
  Object.entries(params)
    .filter(([, v]) => v != null && v !== "" && v !== false)
    .map(([k, v]) => [k, String(v === true ? "1" : v)] as [string, string])
).toString();

<ItemTable
  items={result.items}
  sortBy={sortBy}
  sortDir={sortDir}
  searchParamsStr={searchParamsStr}
/>
```

**注意：** `page` 本身也可以進 `searchParamsStr`——SortableHead 內部會 `delete("page")`，無需在 page component 排除。

---

## Query 層設計

### Allowlist 防 SQL injection

每個 query 模組定義欄位 allowlist，`sortBy` 必須命中才允許進入 SQL：

```typescript
// items.ts
const ITEM_SORT_ALLOWLIST: Record<string, string> = {
  level: "level",
  weight: "weight",
  id: "id",
};

// monsters.ts（JOIN 查詢需帶 table alias）
const MONSTER_SORT_ALLOWLIST: Record<string, string> = {
  level: "n.level",
  hp: "n.hp",
  id: "n.id",
};

// magic.ts（maxLevel 為 GROUP BY 查詢的 SELECT alias，SQLite 支援在 ORDER BY 使用）
const SKILL_SORT_ALLOWLIST: Record<string, string> = {
  maxLevel: "maxLevel",
  id: "id",
};
```

### ORDER BY 組裝（各表獨立實作）

**Items：**

```typescript
const sortCol = params.sortBy ? ITEM_SORT_ALLOWLIST[params.sortBy] ?? null : null;
const sortDirSql = params.sortDir === "desc" ? "DESC" : "ASC";
const orderBy = sortCol
  ? sortCol === "id"
    ? `ORDER BY id ${sortDirSql}`
    : `ORDER BY ${sortCol} ${sortDirSql}, id ASC`
  : `ORDER BY level DESC, id ASC`;
```

**Monsters：**

```typescript
const sortCol = params.sortBy ? MONSTER_SORT_ALLOWLIST[params.sortBy] ?? null : null;
const sortDirSql = params.sortDir === "desc" ? "DESC" : "ASC";
const orderBy = sortCol
  ? sortCol === "n.id"
    ? `ORDER BY n.id ${sortDirSql}`
    : `ORDER BY ${sortCol} ${sortDirSql}, n.id ASC`
  : `ORDER BY n.level ASC, n.id ASC`;
```

**Skills（magic 表 (id, name) 才唯一，必須帶 name 做 tiebreak 確保分頁穩定）：**

```typescript
const sortCol = params.sortBy ? SKILL_SORT_ALLOWLIST[params.sortBy] ?? null : null;
const sortDirSql = params.sortDir === "desc" ? "DESC" : "ASC";
const orderBy = sortCol
  ? sortCol === "id"
    ? `ORDER BY id ${sortDirSql}, name ASC`
    : `ORDER BY ${sortCol} ${sortDirSql}, id ASC, name ASC`
  : `ORDER BY maxLevel DESC, id ASC, firstLevel ASC`;
```

---

## 修改清單

| 動作 | 檔案 |
|---|---|
| 新增 | `src/components/common/sortable-head.tsx` |
| 修改 | `src/lib/queries/items.ts` |
| 修改 | `src/lib/queries/monsters.ts` |
| 修改 | `src/lib/queries/magic.ts` |
| 修改 | `src/app/items/page.tsx` |
| 修改 | `src/app/monsters/page.tsx` |
| 修改 | `src/app/skills/page.tsx` |
| 修改 | `src/components/items/item-table.tsx` |
| 修改 | `src/components/monsters/monster-table.tsx` |
| 修改 | `src/components/skills/skill-table.tsx` |

---

## 測試重點

- 各欄三態切換正確（asc → desc → 重置）
- 切換欄位時另一欄從 asc 開始
- 排序 + 篩選同時作用（URL params 互不覆蓋）
- 排序切換後 page 重置為 1（包含從第 5 頁切換排序的情境）
- 無效 `sortBy` 值 fallback 到預設排序（不報錯）
- Monsters `hasDrop=false` 不出現在 URL（boolean false 被過濾）
- Skills `id` 排序時次要 tiebreak 為 `name ASC`，跨頁無重複漏行
- Skills `maxLevel` SQLite alias 在 GROUP BY 查詢的 ORDER BY 正確（若有疑慮可改寫為 `MAX(level)`）
- Monsters JOIN 查詢的 `n.level`/`n.hp` 在 ORDER BY 正確
