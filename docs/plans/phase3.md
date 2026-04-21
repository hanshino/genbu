# Phase 3 — Skills & Monsters

## Overview

新增技能查詢系統和怪物資料庫，並建立道具與怪物之間的雙向連結（怪物掉落道具、道具來源怪物）。

---

## 1. Skill System

### 1.1 Data Structure

`magic` table (6,142 rows) 每筆技能可有多個等級（同 id 不同 level）。

主要顯示欄位：
- 基本: name, id, level, clan (職業), target, range
- 消耗: spend_mp, spend_hp
- 傷害: func_dmg, func_dmg_p1~p5
- 命中: func_hit, func_hit_p1
- 效果: stun (僵直), time (持續時間), status_param, extra_status
- 其他: recharge_time, pk_disable, attrib

### 1.2 14 Schools/Clans

從 LINE Bot `advance.config.js` 移植：

| 派系 | 二階技能書 ID | 三階技能書 ID |
|------|-------------|-------------|
| 刀法 | 28225-28231, 31183 | 31215-31218, 31260-31263 |
| 惡術 | 28232-28238, 31212 | 31211-31214, 31256-31259 |
| 掌法 | 28239-28247, 31181 | 31219-31223, 31264-31268 |
| 劍法 | 28248-28256, 31182 | 31224-31228, 31269-31272 |
| 匕首 | 28257-28265, 31185 | 31229-31233, 31274-31278 |
| 醫毒 | 28266-28276, 31186 | 31234-31239, 31279-31284 |
| 野性 | 31080-31087 | 31248-31251, 31293-31296 |
| 法術 | 31088-31095 | 31252-31255, 31297-31300 |
| 劍扇 | 31163-31170 | 31240-31243, 31285-31288 |
| 靈種 | 31171-31178 | 31244-31247, 31289-31292 |
| 戰體 | 31403-31406, 31411-31414 | 31419-31422, 31427-31430 |
| 禁術 | 31407-31410, 31415-31418 | 31423-31426, 31431-31434 |
| 劍刃 | 34099-34102, 34107-34110 | 34115-34118, 34123-34126 |
| 劍氣 | 34103-34106, 34111-34114 | 34119-34122, 34127-34130 |

---

## 2. Pages — Skills

### 2.1 Skill List Page (`/skills`)

**UI 配置**:

```
┌──────────────────────────────────────────────────┐
│ 技能查詢                                          │
│ [搜尋: _________]  [派系: 全部 ▼]                │
├──────────────────────────────────────────────────┤
│ 編號  │ 名稱       │ 派系   │ 目標   │ 消耗MP   │
│ 1001  │ 幽冥刺擊   │ 刀法   │ 敵方   │ 50      │
│ 1002  │ 破陣斬     │ 刀法   │ 敵方   │ 80      │
│ ...                                               │
└──────────────────────────────────────────────────┘
```

**行為**:
- 搜尋支援 ID 或名稱（模糊搜尋）
- 派系篩選：14 個派系 + 全部
- 表格欄位: 編號、名稱、派系、目標、MP 消耗
- 同一技能只顯示一列（取 level 1 的基本資訊用於列表顯示）
- 去重查詢:
  ```sql
  SELECT DISTINCT m.id, m.name, m.clan, m.target, m.spend_mp
  FROM magic m
  WHERE m.level = 1
  ```
  （因同一 id 不同 level 的 name/clan/target 相同，取 level=1 即可）
- 點擊進入詳情頁

### 2.2 Skill Detail Page (`/skills/[id]`)

**UI 配置**:

```
┌──────────────────────────────────────────────────┐
│ 幽冥刺擊 (ID: 1001)                              │
│ 派系: 刀法 │ 目標: 敵方 │ 距離: 3               │
├──────────────────────────────────────────────────┤
│ 等級選擇: [1] [2] [3] [4] [5] [6] [7] [8]      │
├──────────────────────────────────────────────────┤
│ 屬性             │ 數值                           │
│ MP 消耗          │ 50                             │
│ 僵直時間         │ 500ms                          │
│ 持續時間         │ 3000ms                         │
│ 傷害參數         │ ...                            │
│ 命中率           │ ...                            │
└──────────────────────────────────────────────────┘
```

**行為**:
- 等級切換以 Tab/Button group 呈現（比 LINE Bot 的逐級切換更方便）
- 切換等級時即時更新下方屬性值
- 只顯示非零/有意義的屬性欄位
- URL 參數: `/skills/1001?level=5`

### 2.3 Advanced Skill Books Page (`/skills/books`)

**UI 配置**:

```
┌──────────────────────────────────────────────────┐
│ 進階技能書                                        │
│                                                    │
│ [刀法] [惡術] [掌法] [劍法] [匕首] [醫毒]       │
│ [野性] [法術] [劍扇] [靈種] [戰體] [禁術]       │
│ [劍刃] [劍氣]                                     │
├──────────────────────────────────────────────────┤
│ 刀法技能書                                        │
│                                                    │
│ ── 二階 ──                                        │
│ • 技能書A (ID: 28225) — 說明文字                  │
│ • 技能書B (ID: 28226) — 說明文字                  │
│                                                    │
│ ── 三階 ──                                        │
│ • 技能書X (ID: 31215) — 說明文字                  │
│ • 技能書Y (ID: 31216) — 說明文字                  │
└──────────────────────────────────────────────────┘
```

**行為**:
- 14 個派系以 Tab 切換
- 每個派系顯示二階和三階技能書
- 技能書名稱從 items 表查詢（透過 ID 對應）
- 點擊技能書可跳至道具詳情頁

---

## 3. Monster System

### 3.1 Data Structure

兩個表都有怪物資料，共用相同的 `id` 主鍵：
- `npc` (5,071 rows) — 主資料來源，包含完整屬性（六維、攻防、元素抗性、狀態抗性等），**無** drop_item 欄位
- `monsters` (2,829 rows) — 補充資料，包含 `drop_item` JSON 欄位和 `drop_exp`、`drop_money_min/max`

**查詢策略（雙表查詢）**:
- 怪物列表/詳情: 以 `npc` 表為主
- 掉落物品: 從 `monsters` 表查 `drop_item`，以 `monsters.id = npc.id` 關聯
- 怪物詳情頁需兩次查詢: (1) `SELECT * FROM npc WHERE id = ?` 取屬性 (2) `SELECT drop_item FROM monsters WHERE id = ?` 取掉落
- LINE Bot 也使用此雙表模式（monsterRepository 分別查 npc 和 monsters）

### 3.2 drop_item JSON 解析

格式: `["1", "15", "26024", "7976", "20102", "60000", ...]`

- `[0]`: 固定值 "1"
- `[1]`: 掉落物品數量 (pair count)
- `[2], [3]`: 第 1 組 (item_id, rate)
- `[4], [5]`: 第 2 組 (item_id, rate)
- 以此類推...

**Rate 顯示策略**: rate 為原始整數值（如 7976, 60000），無權威性分母可轉百分比。統一顯示原始 rate 值，與 Phase 1 道具詳情頁的掉落來源保持一致。共用 `parseDropItems()` utility。

---

## 4. Pages — Monsters

### 4.1 Monster List Page (`/monsters`)

**UI 配置**:

```
┌──────────────────────────────────────────────────┐
│ 怪物查詢                                          │
│ [搜尋: _________]                                 │
│ [等級範圍: 50 ~ 60]  [屬性: 全部 ▼]             │
├──────────────────────────────────────────────────┤
│ 編號  │ 名稱     │ 等級 │ HP     │ 屬性  │ 經驗  │
│ 5011  │ 波波鼠   │ 50  │ 12000  │ 火    │ 500  │
│ 5012  │ 粉紅豬   │ 52  │ 15000  │ 無    │ 620  │
│ ...                                               │
└──────────────────────────────────────────────────┘
```

**行為**:
- 搜尋支援 ID 或名稱
- 等級範圍篩選（雙滑桿或兩個輸入框）
- 屬性篩選: 火、水、雷、木、無
- 表格欄位: 編號、名稱、等級、HP、屬性、經驗
- 分頁 + 排序

### 4.2 Monster Detail Page (`/monsters/[id]`)

**三個區塊**:

**A. 基本資訊**
- 名稱、編號、等級、屬性、HP
- 六維屬性 (str, pow, vit, dex, agi, wis)

**B. 戰鬥資訊**
- 攻擊: 傷害範圍 (min~max), 內勁傷害範圍, 攻速, 攻擊距離
- 防禦: 防禦, 護勁, 命中, 閃躲, 重擊, 拆招
- 抗性: 火抗, 水抗, 雷抗, 木抗
- 狀態抗性: 虛弱, 僵直, 變形, 出血

**C. 掉落物品**
- 解析 drop_item JSON
- 表格: 道具名稱（連結到 `/items/[id]`）、掉落率
- 掉落金幣範圍: drop_money_min ~ drop_money_max

---

## 5. Cross-Linking (Bidirectional Navigation)

道具與怪物之間建立 bidirectional 雙向導航連結：

### 5.1 Item → Monster (已在 Phase 1 實作)

道具詳情頁的「掉落來源」區塊，列出掉落此道具的怪物，點擊可跳至怪物詳情頁。

### 5.2 Monster → Item

怪物詳情頁的「掉落物品」區塊，列出此怪物掉落的道具，點擊可跳至道具詳情頁。

### 5.3 Implementation

```typescript
// 共用 utility: 解析 monsters.drop_item JSON
// 格式: ["1", "15", "item_id", "rate", "item_id", "rate", ...]
// 跳過 [0] 和 [1]，之後每 2 個一組
function parseDropItems(dropItemJson: string): { itemId: number; rate: number }[];

// 查詢掉落指定道具的怪物（需 JOIN npc 取 name/level）
// SELECT n.id, n.name, n.level, m.drop_item
// FROM monsters m JOIN npc n ON m.id = n.id
// WHERE m.drop_item LIKE '%"itemId"%'
function getMonstersDropping(itemId: number): MonsterDrop[];

// 查詢指定怪物的掉落道具（從 monsters 表取 drop_item，再從 items 表取名稱）
function getMonsterDrops(monsterId: number): ItemDrop[];
```

---

## 6. Components

```
src/components/
├── skills/
│   ├── skill-table.tsx          # 技能列表表格
│   ├── skill-filters.tsx        # 派系/搜尋篩選
│   ├── skill-detail.tsx         # 技能詳情顯示
│   ├── skill-level-tabs.tsx     # 等級切換 tabs
│   └── skill-books-browser.tsx  # 進階技能書瀏覽器
├── monsters/
│   ├── monster-table.tsx        # 怪物列表表格
│   ├── monster-filters.tsx      # 等級範圍/屬性篩選
│   ├── monster-detail.tsx       # 怪物詳情顯示
│   └── monster-drops.tsx        # 掉落物品列表
```

---

## 7. Data Layer

### 7.1 New Types

```typescript
// src/lib/types/magic.ts
// 完整欄位定義，對應 magic 表所有 column（參考 locales/zh-tw.json magic section）
export interface Magic {
  id: number;
  level: number;
  name: string;
  icon: string;
  clan: string;
  clan2: string;
  target: string;
  help: number;
  cast_effect: number;
  range: number;
  spend_mp: number;
  spend_hp: number;
  spend_flag: number;
  break_prob: number;
  stun: number;
  status_param: number;
  extra_status: number;
  time: number;
  group: number;
  order: number;
  // 傷害系
  func_dmg: number;
  func_dmg_p1: number;
  func_dmg_p2: number;
  func_dmg_p3: number;
  func_dmg_p4: number;
  func_dmg_p5: number;
  // 命中系
  func_hit: number;
  func_hit_p1: number;
  // 效果系
  func_case: number;
  func_case_p1: number;
  func_case_p2: number;
  func_case_p3: number;
  func_case_p4: number;
  func_case_p5: number;
  // 其他
  skill_type: number;
  teacher: number;
  pk_disable: number;
  attrib: number;
  status_prob: number;
  recharge_time: number;
  hit_range: number;
  recharge_effect: number;
  exclude: number;
  pet_id: number;
  confine_state: number;
}

// src/lib/types/monster.ts (擴充)
export interface Npc {
  id: number;
  name: string;
  type: number;
  elemental: string;
  level: number;
  hp: number;
  // 六維、攻防、抗性...
}

export interface MonsterDrop {
  itemId: number;
  itemName: string;
  rate: number;
}
```

### 7.2 New Query Functions

```typescript
// src/lib/queries/skills.ts
function getSkills(params: { search?: string; clan?: string; page?: number }): { skills: Magic[]; total: number };
function getSkillById(id: number): Magic[];  // 回傳所有等級
function getSkillBookItems(bookIds: number[]): Item[];

// src/lib/queries/monsters.ts (擴充)
function getMonsters(params: { search?: string; levelMin?: number; levelMax?: number; elemental?: string; page?: number }): { monsters: Npc[]; total: number };
function getMonsterById(id: number): Npc | null;
function getMonsterDrops(monsterId: number): MonsterDrop[];
```

---

## 8. Implementation Order

1. `src/lib/types/magic.ts` + `src/lib/queries/skills.ts`
2. Skill list page + filters
3. Skill detail page + level tabs
4. Advanced skill books page
5. `src/lib/types/monster.ts` 擴充 + `src/lib/queries/monsters.ts` 擴充
6. Monster list page + filters
7. Monster detail page + drops
8. Cross-linking: 道具頁掉落來源完善、怪物頁掉落道具連結

---

## 9. SEO

技能和怪物詳情頁需匯出 `generateMetadata` 以利搜尋引擎索引：

```typescript
// /skills/[id]/page.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const skill = getSkillById(params.id);
  return { title: `${skill.name} - 技能 | Genbu` };
}

// /monsters/[id]/page.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const monster = getMonsterById(params.id);
  return { title: `${monster.name} - 怪物 | Genbu` };
}
```
