# Phase 1 — Foundation + Item Query

## Overview

建立專案基礎建設，包含 Next.js 專案初始化、資料庫存取層、Docker 部署配置，以及第一個核心功能：道具查詢系統。

---

## 1. Project Initialization

### 1.1 Create Next.js Project

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

### 1.2 Install Dependencies

```bash
# UI
npx shadcn@latest init
npx shadcn@latest add table input select badge card button separator tabs

# Database
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

### 1.3 Directory Structure

```
genbu/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (nav + footer)
│   │   ├── page.tsx                # Homepage
│   │   ├── items/
│   │   │   ├── page.tsx            # Item list (search + filter + table)
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Item detail
│   │   └── globals.css
│   ├── components/
│   │   ├── layout/
│   │   │   ├── navbar.tsx          # Top navigation bar
│   │   │   └── footer.tsx          # Footer
│   │   ├── items/
│   │   │   ├── item-table.tsx      # Item list table (client component)
│   │   │   ├── item-filters.tsx    # Category/search filter bar
│   │   │   ├── item-detail.tsx     # Item full detail display
│   │   │   ├── item-rand-table.tsx # Random attributes table
│   │   │   └── item-drop-list.tsx  # Which monsters drop this item
│   │   └── ui/                     # shadcn/ui components (auto-generated)
│   ├── lib/
│   │   ├── db.ts                   # better-sqlite3 singleton connection
│   │   ├── types/
│   │   │   ├── item.ts             # Item, ItemRand types
│   │   │   └── monster.ts          # Monster type (for drops)
│   │   ├── queries/
│   │   │   ├── items.ts            # Item query functions
│   │   │   └── monsters.ts         # Monster query functions (for drop lookup)
│   │   └── constants/
│   │       ├── item-types.ts       # Item type enum/mapping
│   │       └── i18n.ts             # Attribute name zh-tw mapping
│   └── hooks/                      # Client-side hooks (if needed)
├── public/                         # Static assets
├── tthol.sqlite                    # Game database (read-only, COPY into Docker)
├── Dockerfile
├── docker-compose.yml
├── CLAUDE.md
└── .gitignore
```

---

## 2. Database Access Layer

### 2.1 SQLite Connection Singleton (`src/lib/db.ts`)

```typescript
import Database from "better-sqlite3";
import path from "path";

// 使用 globalThis 避免 Next.js HMR (Hot Module Reload) 時重複建立連線
const globalDb = globalThis as typeof globalThis & { _db?: Database.Database };

export function getDb(): Database.Database {
  if (!globalDb._db) {
    globalDb._db = new Database(path.join(process.cwd(), "tthol.sqlite"), {
      readonly: true,
    });
    globalDb._db.pragma("journal_mode = WAL");
  }
  return globalDb._db;
}
```

- **Read-only** — 遊戲資料不會被修改
- **globalThis singleton** — 避免重複開啟連線，且在 Next.js dev mode HMR 時不會產生 `SQLITE_BUSY` 錯誤
- **WAL mode** — 提升讀取併發效能

### 2.2 TypeScript Types (`src/lib/types/item.ts`)

```typescript
export interface Item {
  id: number;
  name: string;
  note: string | null;
  type: string | null;
  summary: string | null;
  level: number;
  weight: number;
  // 六維屬性
  hp: number;
  mp: number;
  str: number;   // 外功
  pow: number;   // 內力
  vit: number;   // 根骨
  dex: number;   // 技巧
  agi: number;   // 身法
  wis: number;   // 玄學
  // 戰鬥屬性
  atk: number;   // 物攻
  matk: number;  // 內勁
  def: number;   // 防禦
  mdef: number;  // 護勁
  dodge: number; // 閃躲
  uncanny_dodge: number; // 拆招
  critical: number;      // 重擊
  hit: number;           // 命中
  speed: number;         // 移動
  // 抗性
  fire: number;
  water: number;
  thunder: number;
  tree: number;
  freeze: number;
  // 傷害
  min_damage: number;
  max_damage: number;
  min_pdamage: number;
  max_pdamage: number;
  // 圖片/分類
  picture: number;
  icon: number;
  value: number;
  durability: number;
}

// item_rand.id 在 DB schema 中為 varchar(255)，實際存放的是道具 ID 的字串形式
// 查詢時需以 string 傳入: getItemRands(String(item.id))
export interface ItemRand {
  id: string;
  attribute: string;
  max: number;
  min: number;
  rate: number;
}
```

### 2.3 Query Functions (`src/lib/queries/items.ts`)

```typescript
// 列表查詢 — 支援搜尋、分類篩選、分頁
function getItems(params: {
  search?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}): { items: Item[]; total: number };

// 單筆詳情
function getItemById(id: number): Item | null;

// 隨機屬性
function getItemRands(itemId: string): ItemRand[];

// 掉落此道具的怪物
function getMonstersByDropItem(itemId: number): Monster[];
```

---

## 3. i18n Attribute Mapping (`src/lib/constants/i18n.ts`)

從 LINE Bot 的 `locales/zh-tw.json` 移植，用於顯示屬性中文名：

```typescript
export const itemAttributeNames: Record<string, string> = {
  id: "編號",
  type: "類型",
  name: "名稱",
  note: "備註",
  summary: "描述",
  level: "等級",
  weight: "重量",
  hp: "體力",
  mp: "真氣",
  str: "外功",
  pow: "內力",
  vit: "根骨",
  dex: "技巧",
  agi: "身法",
  wis: "玄學",
  atk: "物攻",
  matk: "內勁",
  def: "防禦",
  mdef: "護勁",
  dodge: "閃躲",
  uncanny_dodge: "拆招",
  critical: "重擊",
  hit: "命中",
  speed: "移動",
  fire: "火抗",
  water: "水抗",
  thunder: "雷抗",
  tree: "木抗",
  freeze: "抗定",
  min_damage: "傷害min",
  max_damage: "傷害max",
  min_pdamage: "內勁傷害min",
  max_pdamage: "內勁傷害max",
};
```

---

## 4. Item Type Categories (`src/lib/constants/item-types.ts`)

從資料庫整理出的 45 種道具分類：

| 分類 | 數量 | 群組 |
|------|------|------|
| **裝備 — 防具** | 帽(445), 衣(260), 鞋(160) | armor |
| **裝備 — 飾品** | 左飾(179), 中飾(170), 右飾(293) | accessory |
| **裝備 — 特殊** | 座騎(407), 背飾(366) | special |
| **裝備 — 武器** | 刀(122), 劍(117), 匕首(116), 拳刃(132), 盾(131), 手套(120), 法杖(102), 扇(90), 雙手刀(87), 拂塵(85), 手甲(85), 棍(83), 雙劍(53), 暗器(28) | weapon |
| **消耗品** | 藥品(403), 卷軸(41) | consumable |
| **寶箱** | 寶箱(1838) | chest |
| **寵物飾品** | 火寵飾(20), 水寵飾(10), 木寵飾(23), 雷寵飾(15) | pet |
| **外裝** | 座騎[外裝](243), 背飾[外裝](254), 帽[外裝](126), 衣[外裝](139), 鞋[外裝](135), 右武器[外裝](78), 左武器[外裝](14), 飾品[外裝](36), 盾[外裝](7) | skin |
| **其他** | 真元/魂石(1352), 娃娃(940), 機關人(6), 未知1/2/3 | misc |

UI 上以群組做第一層篩選，展開後可選擇子分類。

---

## 5. Pages

### 5.1 Homepage (`/`)

- **Hero Section**: 網站名稱 + 簡介（武林同萌傳遊戲資料庫）
- **Feature Cards**: 4 張卡片分別導向 Phase 1~4 的核心功能
  - 道具查詢（Phase 1）
  - 裝備比較（Phase 2, 顯示「即將推出」）
  - 技能 & 怪物（Phase 3, 顯示「即將推出」）
  - 副本解謎（Phase 4, 顯示「即將推出」）
- **Quick Stats**: 顯示資料庫統計（13,283 道具 / 6,142 技能 / 2,829 怪物）
- Layout: 簡潔大方，深色主題（遊戲風格）

### 5.2 Item List Page (`/items`)

- **搜尋欄**: 即時搜尋，支援 ID 或名稱
- **分類篩選**: 下拉選單，以群組分層（裝備 > 武器 > 刀/劍/...）
- **結果表格**: shadcn/ui DataTable
  - 欄位: 編號、名稱、類型、等級、重量
  - 排序: 點擊欄位標題排序
  - 分頁: 每頁 20 筆，底部分頁控制
- **URL 參數同步**: `?search=xxx&type=座騎&page=2`，利於分享連結
- 實作方式: Server Component 做初始資料載入，Client Component 處理互動篩選

### 5.3 Item Detail Page (`/items/[id]`)

三個區塊：

**A. 基本資訊**
- 名稱、編號、類型、等級、重量、描述
- 若有非零數值的屬性，以 grid 排列顯示（只顯示有值的）

**B. 隨機屬性** (若 item_rand 有資料)
- 表格顯示: 屬性名、最小值、最大值、機率 (probability)
- 機率由 rate 欄位計算（所有 rate 加總為分母，個別 rate 為分子，轉百分比顯示 probability）

**C. 掉落來源** (查 monsters 表的 drop_item JSON)
- 列出哪些怪物會掉落此道具
- `drop_item` 格式: `["1", "15", "26024", "7976", "20102", "60000", ...]`
  - `[0]`: 固定值 "1"
  - `[1]`: 掉落物品對數 (pair count)
  - `[2], [3]`: 第 1 組 (item_id, rate)
  - `[4], [5]`: 第 2 組 (item_id, rate)
  - 以此類推，所有值皆為字串，需 parseInt 轉換
- **Rate 顯示策略**: rate 為原始整數值（如 7976, 60000），無權威性分母可轉換為百分比。統一顯示原始 rate 值即可，Phase 3 同樣適用此規則
- 怪物名稱/等級需從 `npc` 表查詢（monsters 表無 name/level）：
  ```sql
  SELECT n.id, n.name, n.level FROM monsters m
  JOIN npc n ON m.id = n.id
  WHERE m.drop_item LIKE '%"itemId"%'
  ```
- 每個怪物顯示: 名稱（連結到怪物頁）、等級、掉落 rate

---

## 6. Error / Empty / Loading States

各頁面需處理非 happy-path 場景：

- **Item Detail (`/items/[id]`)**: 若 ID 不存在，使用 Next.js `notFound()` 回傳 404 頁面
- **Item List**: 搜尋無結果時顯示「找不到符合條件的道具」空狀態訊息
- **隨機屬性 / 掉落來源**: 若無資料，該區塊不顯示（而非顯示空表格）
- **Loading**: Client Component 篩選互動時，使用 React `Suspense` boundary 或 `useTransition` 處理載入狀態
- **DB Error**: Server Component 中 try-catch，fallback 顯示通用錯誤訊息

---

## 7. Docker Deployment

### 7.1 Dockerfile

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/tthol.sqlite ./tthol.sqlite

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

### 7.2 next.config.ts

使用 Next.js 15.x（支援 `next.config.ts` TypeScript 配置檔）：

```typescript
const nextConfig = {
  output: "standalone", // Required for Docker
};
```

### 7.3 docker-compose.yml (for Portainer)

```yaml
version: "3.8"
services:
  genbu:
    image: genbu:latest
    container_name: genbu
    ports:
      - "3000:3000"
    restart: unless-stopped
```

---

## 8. Implementation Order

1. `npx create-next-app` + install dependencies
2. `src/lib/db.ts` + types + constants (i18n, item-types)
3. `src/lib/queries/items.ts` + `monsters.ts`
4. Root layout (navbar + footer)
5. Homepage
6. Item list page (search + filter + table + pagination)
7. Item detail page (attributes + rand + drops)
8. Dockerfile + next.config standalone
9. Test build & Docker image
