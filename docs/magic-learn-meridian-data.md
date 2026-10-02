# 技能學習條件 / 經脈系統資料：給 genbu agent 的讀取說明

> 來源：`tthol-data` repo（`learn.js` + `skill.js`，2026-10-02 加入）。本文件說明 `tthol.sqlite` 新增的 4 張表怎麼讀、怎麼 join、哪些地方不能亂假設。後續要做「技能學習條件」「經脈樹 / 經脈模擬器」等功能時，先讀這份。

## 0. 前提：DB 版本

這些表只存在 **db-2026-10-01-2 之後** 的 DB release。目前 `db.lock.json` 指向的 `db-2026-10-01-2` **還沒有**它們。開工前先確認：

```bash
sqlite3 tthol.sqlite ".tables" | tr -s ' ' '\n' | grep -E '^(magic_(learn|prereqs|meridians|stats)|meridian_channels|ui_images)$'
```

六張都要在，而且 `magic_meridians` 要有 `btn_x` 欄位。§2.1 的等級經驗表另外要有 `char_levels`。沒有的話，請使用者從 tthol-data 重建後走 `npm run changelog -- <version>` → `npm run db:publish` → commit `db.lock.json`，**不要自己改 `tthol.sqlite`**。

同一版 DB 的 `magic` 表另外多了 `cd_time`、`trigger_id` 兩欄，`spend_hp` 也從全 NULL 變成有 91 列有值。`src/lib/types/magic.ts` 要補上前兩欄。

## 1. 新增的表

### `magic_learn`：每個技能每一級怎麼學（5,100 列，PK `(magic_id, level)`）

來自 `LEARN.INI`。有兩種列，用 `is_meridian` 區分：

| 欄位 | 一般技能（`is_meridian = 0`，4,615 列） | 經脈穴位（`is_meridian = 1`，485 列） |
| --- | --- | --- |
| `char_level` | 需求角色等級 | NULL |
| `spend_exp` | 學習花費經驗。**`-1` = 不能在技能視窗學，由對話 / 任務觸發器直接給**（590 列） | NULL（只有承漿 Lv1 是 -1） |
| `spend_cost` | NULL | 打通花費，單位是**丹田**（經脈視窗的欄位標籤是「消耗丹田」） |
| `success_prob` | NULL | 打通成功率 %，**打通可能失敗** |

- 沒列出的等級代表該級在 LEARN.INI 沒有設定，不要自己補值。
- 有 41 列的 `magic_id/level` 在 `magic` 不存在（例：52 Lv1..5），所以 **不是 FK**，join 用 LEFT JOIN。

### `magic_prereqs`：學某一級的前置技能（1,406 列，PK `(magic_id, level, seq)`）

- `seq` 1..4 = 原始 `PreLearn1..4`；`raw` = 原始值 = `req_magic_id × 100 + req_level`。
- **同一 `(magic_id, level)` 的多列全部要成立（AND）**，沒有 OR。
- 前置只掛在「某些等級」上，例如提托 1010 只有 Lv1 和 Lv6 有前置，Lv2..5 只要前一級學過即可（等級本身逐級學是隱含規則，表裡不會寫「需要提托 Lv1 才能學 Lv2」）。
- 偶爾有「自己」當前置（提托 Lv6 需要提托 Lv5），反查時記得排除 `req_magic_id = magic_id`。

### `magic_meridians`：經脈穴位清單（55 列，PK `magic_id`）

| 欄位 | 說明 |
| --- | --- |
| `channel_no` / `channel` | 1 任脈 / 2 督脈 / 3 帶脈 / 4 沖脈 |
| `max_level` | 該穴位最高級（5 / 10 / 20） |
| `is_root` | Lv1 只需要承漿 Lv1（或本身就是承漿）＝ 該脈的入口穴 |
| `slot` | 1..16，在該分頁的格位（客戶端表格順序，不是前置順序） |
| `btn_x` / `btn_y` | 穴位在 640×480 經脈視窗裡的按鈕座標；**圓點中心 = (`btn_x + 5`, `btn_y + 5`)** |

各脈：任脈 855..925（15 穴）、督脈 930..1005（16）、帶脈 1010..1070（13）、沖脈 1075..1125（11），ID 每 5 一個。入口穴：任脈 855 承漿、860、865、870；督脈 930 神道；帶脈 1010 提托；沖脈 1075 商曲。

### `magic_stats`：技能的屬性加成（1,114 列，PK `(magic_id, level, stat)`）

`MAGIC.INI` 裡不屬於 `magic` 欄位的數值鍵。經脈的實際效果**只在這張表**（`magic` 只剩 `help` 文字）。88 個技能有資料，其中 55 個是經脈，其他 33 個是 1150..1189 一帶的被動技能（加 Atk / HPMAX…），以及 3 列 `FireAttack`。

| 欄位 | 說明 |
| --- | --- |
| `stat` | 原始鍵名，如 `Encumbrance`、`HPMAX` |
| `value` | 整數 |
| `flag` | `AFFECT_NUMBER` 加固定值 / `AFFECT_MAX_NUMBER` 加上限 / `AFFECT_RATIO` 百分比；`FireAttack` 沒有 flag（NULL） |

`stat` 中文對照（中文取自同一列的 `magic.help`，用遊戲內用語）：

| stat | 中文 | stat | 中文 |
| --- | --- | --- | --- |
| `Atk` | 物攻 | `MAtk` | 內勁 |
| `ExtraDef` | 防禦 | `MagicDef` | 護勁 |
| `Hit` | 命中 | `Dodge` | 閃躲 |
| `Critical` | 重擊 | `Encumbrance` | 負重 |
| `HPMAX` | 體力（上限） | `MPMAX` | 真氣（上限） |
| `HP` | 體力恢復（量） | `MP` | 真氣恢復（量） |
| `HPRecover` | 體力恢復間隔 −N 秒 | `MPRecover` | 真氣恢復間隔 −N 秒 |
| `Str` | 外功 | `Pow` | 內力 |
| `Vit` | 根骨 | `Dex` | 技巧 |
| `Agi` | 身法 | `Wis` | 玄學 |
| `FireDef` | 抗火 | `WaterDef` | 抗水 |
| `LightningDef` | 抗雷 | `EarthDef` | 抗木（不是抗土） |
| `BleedRes` | 抗失血 | `StunRes` | 抗定身 |
| `ShapeRes` | 抗變異 | `WeakenRes` | 抗衰弱 |
| `Hurt` | 減少受到傷害 % | `EnemyDef` / `EnemyMDef` | 減少敵方防禦 / 護勁 % |
| `AtribChanlExp` | 經脈消耗經驗值 −% | `AtribChanlProb` | 穴位打通成功率 +% |
| `FireAttack` | 原始值，意義未解 | | |

六圍與攻防的標籤先用 `@/lib/constants/i18n` 的 `itemAttributeNames`，對照表裡沒有的再用上表。

### `meridian_channels`：每個分頁的圖（4 列）

| 欄位 | 說明 |
| --- | --- |
| `channel_no` / `channel` | 對應 `magic_meridians.channel_no` |
| `tab_icon_id` | 分頁標籤圖（`ui_images` 的 `state='disable'` 那張是選中狀態的字） |
| `base_icon_id` | 該脈的人形剪影，穴位圓點和連線已經畫在圖上 |
| `base_x` / `base_y` | 剪影在視窗裡的左上角 |

### `ui_images`：遊戲介面圖（PictShare URL，PK `(icon_id, state, frame)`）

目前只收經脈視窗（`window = 'AttribChannel'`，23 列）。`icon_id` 是遊戲 Window INI 的 `[ICON] ID`；`state` 為 normal / focus / down / disable；`frame` 是動畫幀。繪製規則：圖的 `anchor` 點對齊「控制項位置 + `pos`」，也就是左上角 = 位置 + `pos` − `anchor`。

| icon_id | 內容 |
| --- | --- |
| 1284 | 640×480 主框（分頁列、屬性總表、穴位資訊欄、底部等級 / 經驗值 / 丹田） |
| 1285–1288 | 分頁字：任脈 / 督脈 / 帶脈 / 沖脈（只有 `disable` 狀態） |
| 1290 / 1289 / 1293 / 1294 | 任 / 督 / 帶 / 沖脈剪影（以 `meridian_channels` 為準，遊戲 INI 註解把帶、沖寫反了） |
| 1291 | 穴位亮燈（`normal`；`focus` 有 2 幀閃爍）。anchor (24,27)、pos (5,5)，所以燈的左上角 = (`btn_x − 19`, `btn_y − 22`) |
| 1292 | 「打通經脈」按鈕（`normal` / `disable`） |
| 1295–1302 | **氣海**水球，Water0..7 共 8 階水位（換算見 §2.1）。不是丹田：丹田是底部的數字欄 |
| 1303 | 小箭頭 |

### 在網頁上重現經脈視窗

```sql
-- 底圖：主框 + 該分頁剪影
SELECT c.channel_no, c.base_x, c.base_y, f.url AS frame_url, b.url AS base_url
FROM meridian_channels c
JOIN ui_images f ON f.icon_id = 1284 AND f.state = 'normal'
JOIN ui_images b ON b.icon_id = c.base_icon_id AND b.state = 'normal';

-- 打點：圓點中心
SELECT mm.magic_id, m.name, mm.btn_x + 5 AS cx, mm.btn_y + 5 AS cy
FROM magic_meridians mm JOIN magic m ON m.id = mm.magic_id AND m.level = 1
WHERE mm.channel_no = ?;
```

- 想只顯示剪影、不要主框時，點位改用剪影內座標：(`cx − base_x`, `cy − base_y`)。
- 用百分比定位做 RWD：`left = cx / 640`、`top = cy / 480`；只顯示剪影時，分母換成剪影圖的 `width` / `height`。
- 已用這些 DB 欄位把四頁重組出來，比對過：55 個點都落在剪影畫好的圓點上（誤差 ≤ 3 px）。

## 2. 經脈系統怎麼運作（顯示用的背景）

- **入口**：承漿 Lv1 不能在視窗學（`spend_exp = -1`），只能從掃地僧的任務「經脈通-陵絕頂」（18931）拿到。任務資料可以從現有的 `mission_*` / `trigger_ops` 查（MSG37）。
  - 條件是角色等級 ≥ 180。跟掃地僧對話有 10% 機率觸發「緣」分支，才能接任務。
  - 到神武禁地從傀儡身上拿通竅丹（34169）交回。
  - 接著閉關 7 天（計時任務 20519 經脈通竅等七日）。
  - 7 天後再找掃地僧，獲得承漿 Lv1 + 1 億經驗。
- **承漿 Lv1 是四條脈的總鑰匙**：督脈神道、帶脈提托、沖脈商曲的 Lv1 都只要求承漿 Lv1。
- 遊戲內有專用的「經脈」視窗，四個分頁對應四條脈，每頁最多 16 個穴位。升級按鈕旁會顯示成功率與花費。
- `AtribChanlProb` 有兩個意思，別搞混：在 `magic_learn.success_prob` 是「這一級的打通成功率」，在 `magic_stats` 是天突 865 / 膻中 890 給的「成功率加成」。

## 2.1 丹田、氣海與等級經驗（2026-10-02 查 `tthola.dat` + INI）

**結論先講：丹田和氣海的增減規則全部在伺服器。** 客戶端只負責顯示伺服器送來的數值、做送出前的門檻檢查，不做任何換算。下面只寫客戶端查得到的部分，每項附來源；查不到的寫「查無」，網站上不要寫成定論。

| 項目 | 結果 | 來源 |
| --- | --- | --- |
| 經驗轉丹田的按鈕 | 經脈視窗丹田值旁的 `BTN-CHANGE`（23145） | `Window/AttribChannel.ini`（data1.pak）第 1260 行「丹田值」、第 1264 行 `BTN-CHANGE` |
| 轉換門檻 | **角色經驗 ≥ 1 億（100,000,000）才送出**，不足就跳「經驗值不足!!」 | `tthola.dat` 0x4bc5fa：`cmp [exp], 0x5f5e100`；字串在 0x5fdec8 |
| 每次轉換換多少 | **查無**：送出的封包 `0xE7` 不帶任何數量（0x444ea0），換算比例由伺服器決定 | `tthola.dat` 0x4bc606 → 0x444ea0 |
| 跟等級 / 轉生有沒有關 | 客戶端門檻是固定 1 億，不看等級。192 級的 `level.ini` 經驗是 5,557,483,204，跟 9,700 萬對不上，所以不是「該級的升級經驗」 | `level.ini` 第 216 行 `Level192` |
| 每日 / 每次上限 | 查無 | — |
| 承漿 `AtribChanlExp` | Help「消耗經驗值降低 1%」，承漿 5 級每級都是 1%。經脈系統裡唯一消耗經驗的步驟是轉丹田（打通花的是丹田），所以作用在**轉丹田**。實測的 9,700 萬 = 1 億 ×（1 − 3%），剛好對上「承漿 Lv3、每級 1% 累加」。這是推論，請用該角色的承漿等級驗證 | `MAGIC.INI` 第 128073 行起（ID 855）；`LEARN.INI` 經脈列只有 `SpendCost`（丹田），沒有經驗欄 |
| 打通花費 | 丹田值 ≥ `magic_learn.spend_cost` 時打通按鈕才能按 | `tthola.dat` 0x4dc231（比對角色 +0x492 與花費） |
| 打通封包 | 只送選中的穴位（0x445180），成功與否由伺服器判定 | `tthola.dat` 0x4bc86d |
| 打通失敗扣不扣丹田 | 查無：客戶端只顯示伺服器回送的丹田值 | `tthola.dat` 0x499e7f |
| 氣海值存放 | 角色結構 +0x490（u16），丹田在 +0x492（u16，上限 65,535）。伺服器用同一個封包一起更新 | `tthola.dat` 0x499e69–0x499e7f |
| 氣海上限 | **100（客戶端顯示推得）**：水球在 100 剛好滿（Water7）；數字到 100 時往左挪一格給三位數 | `tthola.dat` 0x4dc3f9–0x4dc4b1 |
| 每次失敗加多少、是否因穴位不同 | 查無：`LEARN.INI` 經脈列的欄位只有 `ID / Level / PreLearn1..4 / AtribChanlProb / SpendCost`，沒有氣海相關欄位 | `LEARN.INI` |
| 氣海滿時保證成功、之後歸零 | 客戶端沒有這段邏輯（伺服器端），與官方說明不衝突 | — |

**氣海水球圖（`ui_images` icon 1295..1302）怎麼挑**，照客戶端算法：氣海 `q` = 0 → Water0；否則 `a = clamp(floor(q / 15), 1, 6)`，`q < 17a − 2` 時用 Water`a`，否則用 Water`a+1`。

| 氣海 | 0 | 1–14 | 15–31 | 32–48 | 49–65 | 66–82 | 83–99 | ≥ 100 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 圖 | Water0 | Water1 | Water2 | Water3 | Water4 | Water5 | Water6 | Water7（滿） |
| icon_id | 1295 | 1296 | 1297 | 1298 | 1299 | 1300 | 1301 | 1302 |

### `char_levels`：角色等級經驗表（200 列，PK `level`）

來自 `level.ini`（只在 data1.pak）。10 個門派各有一段，但數值完全相同，所以只存一份（parser 會檢查）。

| 欄位 | 說明 |
| --- | --- |
| `level` | 1..200 |
| `exp` | 原始經驗數字（Lv200 = 12,228,747,426，超過 32-bit，讀取時注意型別）。是「升到下一級要的經驗」還是「累計經驗」，客戶端沒寫 |
| `str / pow / vit / agi / dex / wis` | 只有 Lv1 是 1，其餘 0 |

## 3. Join 陷阱

1. **`magic.id` 不唯一，一律用 `(id, level)` join**。這一點 `queries/magic.ts` 已經寫了：id 553 塞了 32 個技能，180 有 10 個名字。`magic_learn` / `magic_prereqs` / `magic_stats` 都有 level，直接 `m.id = x.magic_id AND m.level = x.level` 即可。要拿前置技能的名字，用 `m.id = p.req_magic_id AND m.level = p.req_level`。
2. 經脈 55 個 id 沒有共用問題，取名字用 `level = 1` 即可。
3. `magic_learn` 對 `magic` 用 LEFT JOIN（41 列無對應）。

## 4. 範例查詢（已在 2026-10-02 的 DB 驗證）

```sql
-- 技能詳情頁：每級學習條件 + 前置（一般技能與經脈通用）
SELECT l.level, l.char_level, l.spend_exp, l.spend_cost, l.success_prob,
  (SELECT group_concat(coalesce(m.name, '#' || p.req_magic_id) || ' Lv' || p.req_level, '、')
     FROM magic_prereqs p
     LEFT JOIN magic m ON m.id = p.req_magic_id AND m.level = p.req_level
    WHERE p.magic_id = l.magic_id AND p.level = l.level) AS prereqs
FROM magic_learn l
WHERE l.magic_id = ?
ORDER BY l.level;

-- 經脈總覽：四條脈各自的穴位
SELECT mm.channel_no, mm.channel, mm.magic_id, m.name, mm.max_level, mm.is_root
FROM magic_meridians mm
JOIN magic m ON m.id = mm.magic_id AND m.level = 1
ORDER BY mm.channel_no, mm.magic_id;

-- 經脈樹的邊（畫圖用）：哪個穴位的哪一級需要哪個穴位幾級
SELECT p.magic_id, p.level, p.req_magic_id, p.req_level
FROM magic_prereqs p
JOIN magic_meridians mm ON mm.magic_id = p.magic_id
WHERE p.req_magic_id <> p.magic_id;

-- 反查：學 X 之後解鎖哪些技能
SELECT DISTINCT p.magic_id, m.name
FROM magic_prereqs p
JOIN magic m ON m.id = p.magic_id AND m.level = p.level
WHERE p.req_magic_id = ? AND p.magic_id <> p.req_magic_id;

-- 某穴位逐級加成
SELECT level, stat, value, flag FROM magic_stats WHERE magic_id = ? ORDER BY level, stat;
```

## 5. 不知道的事（不要在 UI 上寫成定論）

- **丹田怎麼來、經驗值有沒有另外扣**：`spend_cost` 是丹田（視窗寫「消耗丹田」），視窗底部同時顯示等級 / 經驗值 / 丹田。承漿的「消耗經驗值降低」暗示升級也會扣經驗值，但扣多少不在客戶端資料裡。
- **每級加成是否累加**：例如提托每級都是 `Encumbrance 800`，Help 每級都寫「增加負重 800 點」。看不出是「每級 +800、10 級共 8000」還是「固定 800」。脊中在 Lv11 從 8 跳到 12，比較像每級的增量，但沒有實測。做模擬器時，把「總和」標成推估，或兩種都列。
- 打通失敗會不會扣丹田、經驗怎麼換成丹田、氣海每次加多少：都在伺服器端，見 §2.1。

## 6. 可以做的應用（建議）

- `/skills/[id]`：加「學習條件」區塊（每級需求等級 / 經驗 / 前置技能連結）。`spend_exp = -1` 顯示成「由任務或對話習得」。
- 新頁 `/skills/meridians`：用 `ui_images` 主框 + 剪影重現遊戲經脈視窗，四個分頁，用 `btn_x/btn_y` 打點；點穴位顯示逐級成功率、花費、加成。入口說明連到任務 18931。
- 經脈模擬器：使用者勾選各穴位等級，即時檢查前置是否滿足，並加總 `magic_stats`（注意 §5 的累加問題）。
- 「X 技能是哪些技能的前置」反查，放在技能詳情頁。

實作慣例：型別放 `src/lib/types/`，查詢放 `src/lib/queries/`，在 `__tests__/schema-smoke.test.ts` 補上六張新表。要讓 DB changelog 顯示這些表的變動，就在 `src/lib/changelog/config.ts` 的 `PROFILES` 加 profile（identity 照各表 PK）。
