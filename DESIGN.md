---
name: 玄武 Genbu
description: 武林同萌傳玩家資料站：宣紙、墨、朱砂的江湖案頭
colors:
  cinnabar: "oklch(0.52 0.17 27)"
  cinnabar-ring: "oklch(0.65 0.15 27)"
  rice-paper: "oklch(0.975 0.008 85)"
  paper-card: "oklch(0.985 0.006 85)"
  paper-wash: "oklch(0.935 0.012 85)"
  paper-muted: "oklch(0.95 0.008 85)"
  brush-line: "oklch(0.88 0.012 85)"
  cool-ink: "oklch(0.22 0.015 260)"
  faded-ink: "oklch(0.48 0.018 260)"
  warning-red: "oklch(0.55 0.2 22)"
  celadon: "oklch(0.62 0.08 165)"
  indigo-dye: "oklch(0.48 0.1 250)"
  antique-gold: "oklch(0.7 0.12 78)"
  ink-plum: "oklch(0.48 0.09 320)"
  xuan-night: "oklch(0.165 0.015 260)"
  xuan-card: "oklch(0.21 0.018 260)"
  candle-ivory: "oklch(0.92 0.012 85)"
  cinnabar-lit: "oklch(0.65 0.18 28)"
typography:
  display:
    fontFamily: "Noto Serif TC, Songti TC, PingFang TC, Source Han Serif, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Noto Serif TC, Songti TC, PingFang TC, Source Han Serif, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Noto Serif TC, Songti TC, PingFang TC, Source Han Serif, Georgia, serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Noto Sans TC, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Noto Sans TC, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  numeric:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
    fontFeature: "tnum"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  container: "72rem"
components:
  button-primary:
    backgroundColor: "{colors.cinnabar}"
    textColor: "{colors.rice-paper}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
    typography: "{typography.body}"
  button-outline:
    backgroundColor: "{colors.rice-paper}"
    textColor: "{colors.cool-ink}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.paper-muted}"
    textColor: "{colors.cool-ink}"
  nav-link-active:
    backgroundColor: "{colors.paper-wash}"
    textColor: "{colors.cool-ink}"
    rounded: "{rounded.md}"
    height: "28px"
  card:
    backgroundColor: "{colors.paper-card}"
    textColor: "{colors.cool-ink}"
    rounded: "{rounded.xl}"
    padding: "16px"
  input:
    backgroundColor: "{colors.rice-paper}"
    textColor: "{colors.cool-ink}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  badge:
    backgroundColor: "{colors.paper-wash}"
    textColor: "{colors.cool-ink}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
    height: "20px"
    typography: "{typography.label}"
---

# Design System: 玄武 Genbu

## Overview

**Creative North Star: "江湖案頭 (The Wuxia Ledger)"**

玄武是一張攤在桌上的江湖帳冊。底是溫潤的宣紙，字是偏冷的墨，資料一筆一筆排得密而整齊；朱砂只在要緊處蓋一印：品牌字、主要動作、你現在在哪裡。古風住在材質與用色裡，不住在裝飾裡：沒有卷軸邊框、沒有毛筆筆觸貼圖，介面本身仍是精準的工具。

這是一個 Operate 為主的資料站。密度高，`text-xs` 與 `text-sm` 是工作字級，數字一律等寬。標題用宋體（Noto Serif TC）提供書卷氣，內文與資料用黑體（Noto Sans TC）確保掃讀速度。暗色主題「玄」把宣紙換成深夜藍、墨換成燭光象牙白，朱砂提亮以維持辨識。

**Key Characteristics:**
- 宣紙暖底、冷墨字，兩個色相（85° 與 260°）構成整套中性色
- 朱砂是唯一的強調色，用量刻意稀少
- 宋體標題 × 黑體內文 × 等寬數字
- 扁平、細框線，陰影只給浮層
- 雙主題同等完整：亮色「宣紙」、暗色「玄」

## Colors

宣紙與墨構成九成畫面，朱砂一點，四色文房色（青瓷、靛青、鎏金、墨紫）只服務資料視覺化。

### Primary
- **朱砂 Cinnabar Seal**：品牌字「玄武」、主要按鈕、連結、玄字印、目前所在位置的強調。暗色主題換為較亮的 **燭下朱砂 Cinnabar Lit**。
- **朱砂餘韻 Cinnabar Echo**：focus ring，以 50% 透明度環繞聚焦元素。

### Tertiary（資料視覺化專用）
- **青瓷 Celadon**、**靛青 Indigo Dye**、**鎏金 Antique Gold**、**墨紫 Ink Plum**：圖表 `chart-2`～`chart-5`，`chart-1` 為朱砂。只用在 Recharts 與資料標記，不拿來當 UI 裝飾色。
- 地圖另有專用色組（`--marker-1..12` 怪物標記、`--walk-*` 可行走通道、`--hazard` 危險區、`--route-*` 路線），定義在 `src/app/globals.css`，針對暗色地圖底圖與色盲辨識調過，不得挪作他用。

### Neutral
- **宣紙 Rice Paper**：頁面底色。
- **素箋 Paper Card**：卡片、浮層底色，比宣紙略亮一階。
- **淡墨渲 Paper Wash**：secondary 表面、導覽的目前頁、badge 底。
- **薄宣 Paper Muted**：hover 表面、muted 區塊。
- **筆線 Brush Line**：邊框、分隔線、輸入框外框。
- **冷墨 Cool Ink**：主要文字。
- **淡墨 Faded Ink**：次要文字、說明、標籤。
- **玄夜 Xuan Night / 玄卡 Xuan Card / 燭光 Candle Ivory**：暗色主題的底、卡片、文字。暗色邊框為白色 10%、輸入框 15%。
- **警示紅 Warning Red**：destructive，色相刻意偏離朱砂（22° vs 27°），且多以 10% 底色＋紅字呈現，不與主按鈕混淆。

### Named Rules
**一處一印 Rule.** 朱砂只蓋在品牌字、主要 CTA、目前所在位置與 focus ring。大面積一律宣紙與墨；一個畫面同時出現三處以上朱砂實心塊，就是用多了。

**兩色相 Rule.** 所有中性色只在暖紙（hue 85）與冷墨（hue 260）兩個色相上取值。新增表面色時沿用這兩個色相調明度，不要引入純灰或其他色相。

## Typography

**Display Font:** Noto Serif TC（fallback：Songti TC、PingFang TC、Source Han Serif、Georgia）
**Body Font:** Noto Sans TC（fallback：system-ui）
**Label/Mono Font:** Geist Mono，搭配 `tabular-nums`

**Character:** 宋體標題帶書卷氣但字重夠（500/700），黑體負責所有可掃讀的資料，等寬數字讓屬性欄位上下對齊。

### Hierarchy
- **Display**（700，1.875rem，`text-3xl`）：頁面 h1，例如道具名、頁標題。
- **Headline**（700，1.5rem → md 1.875rem）：區塊大標。
- **Title**（600，1rem）：卡片標題、側欄小標，仍用宋體。
- **Section Rule**（400，15px，letter-spacing 0.08em，淡墨，後接一條延伸到右緣的筆線）：攻略與長頁的分段標，宋體細字。
- **Body**（400，0.875rem，`text-sm`）：預設工作字級。
- **Label**（500，0.75rem，`text-xs`）：表頭、badge、次要說明，全站最常用字級。
- **Numeric**（Geist Mono，tabular-nums）：屬性值、機率、等級、價格。

### Named Rules
**宋題黑文 Rule.** h1–h3 一律宋體（`font-heading`，全域 base 已套用），資料與 UI 控制項一律黑體。不要用宋體排表格或按鈕。

**數字等寬 Rule.** 會被拿來上下比較的數字一定 `tabular-nums`（必要時 `font-mono`）。

## Layout

- 內容容器 `max-w-6xl`（72rem）置中，水平 padding 16px；閱讀型頁面（關於、攻略）收窄到 `max-w-3xl`～`max-w-4xl`。
- 頂部 navbar 高 56px、sticky、半透明宣紙底加 backdrop blur，底部一條 60% 筆線。
- 桌機 navbar 為分組下拉選單；md 以下收成右側滑出抽屜（寬 288px，最多 85vw）。
- 間距以 4px 為基數，元件內多用 8–16px，區塊之間 24–40px。
- 手機寬表格可橫向捲動，右緣有一道淡出漸層提示還能往右滑（`.scroll-hint-x`），捲到底時消失。
- 開啟比較列時 body 底部留 5rem，避免被固定的比較列蓋住。

## Elevation & Depth

扁平為主，用色階（宣紙 → 素箋 → 淡墨渲）與 1px 細線分層。卡片用 `ring-1` 的 10% 墨色描邊而非陰影。陰影只出現在脫離版面的浮層上。

### Shadow Vocabulary
- **浮層 Popover**（`shadow-md`）：下拉選單、popover。
- **抽屜 Drawer**（`shadow-xl`）：手機導覽抽屜。
- **印 Seal**（`shadow-sm`）：玄字印等少數需要微微浮起的識別元素。

### Named Rules
**紙面平放 Rule.** 頁面上的卡片、表格、區塊都平放在紙上，不加陰影；只有會蓋住其他內容的東西才有影子。

## Shapes

中等圓角，基準 10px（`--radius: 0.625rem`）：按鈕與輸入框 10px、選單項目與小按鈕 6–8px、卡片 14px、badge 與頭像全圓。玄字印是唯一的方印造型：80px 方塊、2px 朱砂框、5% 朱砂底。

## Components

### Buttons
內斂、扁平，按下時下沉 1px。
- **Shape:** 10px 圓角，預設高 32px（sm 28px、lg 36px）。
- **Primary:** 朱砂底、宣紙字，hover 降到 80% 透明度。一個畫面通常只有一顆。
- **Outline:** 宣紙底、筆線框，hover 換薄宣表面。
- **Ghost:** 無底，hover 薄宣表面；導覽連結的預設型。
- **Secondary:** 淡墨渲底；導覽「目前頁」用這個，而不是朱砂。
- **Focus:** 3px 朱砂餘韻 ring（50%），邊框轉 ring 色。

### Chips / Badges
- **Style:** 高 20px、全圓、`text-xs` 500。預設朱砂底只用於真正需要強調的狀態；一般分類用 secondary 或 outline。

### Cards / Containers
- **Corner Style:** 14px。
- **Background:** 素箋。
- **Shadow Strategy:** 無，靠 `ring-1` 10% 墨色描邊。
- **Internal Padding:** 16px（sm 尺寸 12px）。

### Inputs / Fields
- **Style:** 高 32px、10px 圓角、筆線框、透明底，placeholder 為淡墨。
- **Focus:** 邊框轉朱砂餘韻並加 3px 50% ring。
- **Error:** `aria-invalid` 時邊框與 ring 轉警示紅。

### Navigation
- 品牌字「玄武」宋體 xl 粗體朱砂，旁接 xs 淡墨「Genbu」。
- 分組觸發器為 sm ghost 按鈕加會翻轉的 chevron；展開與目前頁皆為 secondary。
- 下拉面板：素箋、10px 圓角、`shadow-md`、10% 墨色 ring，子群組以筆線分隔、xs 淡墨群組標。

### 玄字印 Seal（signature）
「玄」字置於方印中：宋體 4xl 粗體朱砂、2px 朱砂框、5% 朱砂底。只用在關於頁與品牌位置，是全站唯一的具象古風元素。

## Do's and Don'ts

### Do:
- **Do** 用 shadcn 元件（`src/components/ui/`）與 lucide-react 圖示組 UI，hand-roll 時沿用 `rounded-md`/`rounded-lg`、`border-border/60`、`bg-card`、`text-muted-foreground`、`hover:bg-muted/50`。
- **Do** 每個新表面同時檢查亮色「宣紙」與暗色「玄」兩個主題。
- **Do** 對要比較的數字使用 `tabular-nums`。
- **Do** 圖表配色依序取 `chart-1`～`chart-5`。

### Don't:
- **Don't** 把朱砂當成大面積底色或一般標題色（一處一印 Rule）。
- **Don't** 用 Unicode 符號（`×`、`▾`、`✓`）或 emoji 代替圖示。
- **Don't** 引入 Tailwind 預設色板（`amber-500`、`emerald-500` 等）做新 UI；需要語意色時先擴充 token。
- **Don't** 用卷軸、毛筆筆觸、雲紋等裝飾圖貼古風。
- **Don't** 給平放在頁面上的卡片加陰影。
- **Don't** 寫不必要的次要標籤或說明文字，讓版面自己說明。
