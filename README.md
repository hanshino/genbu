# 玄武 · Genbu

武林同萌傳（TTHOL）的非官方資料站與工具集。提供道具查詢、裝備排行、裝備比較、流派加權，以及後續規劃中的技能 / 怪物 / 秘境解謎工具。

資料來源為遊戲 SQLite 檔案（`tthol.sqlite`，唯讀）；裝備圖片透過 Google Sheet 同步。專案姐妹作：[`tthol-line-bot`](https://github.com/hanshino/tthol-line-bot)（同系列的 LINE bot 版本）。

## 主要功能

- **道具查詢** — 依類型 / 等級 / 名稱檢索，詳細頁顯示屬性條、流派分位、隨機屬性、掉落來源。
- **裝備排行** — 依流派預設或自訂加權排序，支援分位標籤、流派合格度、相容性等視覺化。
- **自訂流派** — 調整屬性權重後存成自訂流派（存在瀏覽器 localStorage，可刪除）。
- **裝備比較** — 最多同時比較 5 件裝備，格狀矩陣比對屬性差異。

## 技術棧

- Next.js 16 App Router · React 19 · TypeScript
- Tailwind CSS 4 + shadcn/ui + base-ui
- better-sqlite3（Server Components / Route Handlers）
- Vitest · ESLint · Prettier

## 開發

```bash
npm install
npm run dev        # localhost:3000
```

常用指令：

```bash
npm run build        # 產品建置
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest
npm run format       # Prettier 全專案排版
npm run sync:images  # 從 Google Sheet 同步裝備圖到 public/equipment
```

## 專案結構

```
src/
├── app/          # Next.js App Router pages
├── components/   # React components（shadcn-first）
├── lib/          # scoring / DB queries / types / constants
│   ├── queries/  # better-sqlite3 存取
│   ├── scoring/  # 流派加權與排名計算
│   └── generated/  # 自動產生的資料（裝備圖 manifest 等）
├── configs/      # 權重設定
scripts/
└── sync-equipment-images.mjs  # 裝備圖下載 / 正規化為 JPEG
public/
└── equipment/    # 同步產出的裝備圖
tthol.sqlite      # 遊戲資料庫（唯讀）
```

## 資料約定

- 使用者介面一律使用繁體中文（zh-tw）。
- 盡量以 Server Component 為主，需互動時才標 `"use client"`。
- UI 元件優先走 shadcn/`src/components/ui/`，其次 `@base-ui/react`；自寫是最後手段。
- 圖示一律使用 `lucide-react`，避免 Unicode 字元或 emoji。
- `tthol.sqlite` 為唯讀資料，請勿修改。

## 部署

以 Docker 映像部署，透過 Portainer 佈到 VPS。裝備圖採建置期同步（約兩週一次），一併重新打包映像。

## 路線圖

- [x] Phase 1 — 基礎建設 + 道具查詢
- [x] Phase 2 — 裝備排行 / 流派加權 / 裝備比較
- [ ] Phase 3 — 技能 & 怪物瀏覽
- [ ] Phase 4 — 秘境解謎工具（160/175/180）
