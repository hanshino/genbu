# 屬性模擬器：從 tthol-reader 匯入角色（TTHOL1 格式）

> 狀態：**規劃中**。建立於 2026-10-03。
> 兩個專案共用這份契約：**tthol-memory**（tthol-reader，讀遊戲記憶體）負責匯出，**genbu** `/tools/stat-sim` 負責匯入。
> 相關文件：`docs/plans/2026-10-02-stat-simulator.md`、`docs/stat-simulator-formulas.md`、tthol_data `scripts/stat_formula_investigation.md`。

---

## 目標

玩家在 tthol-reader 按「複製到配裝模擬器」，到 genbu 貼上，就能建好一隻跟遊戲裡一樣的角色：門派、等級、轉生點數、配點、十格裝備（含 +N、插槽、隨機素質）、被動、經脈。不用再手抄。

**分工原則：匯出端只給讀到的原始值，所有換算都在 genbu。**

- 公式、配方區間、隨機素質區間只在 genbu 維護一份。tthol-memory 內建的 `tthol.sqlite` 版本較舊（2026-10-03 時還沒有 `item_rand_counts`，`compound_number` 也有錯），不適合拿來拆解。
- 遊戲改版後，只要更新 genbu 的資料，舊的匯出字串仍能匯入。

---

## 字串格式

```
TTHOL1.<payload>
payload = base64url( deflate-raw( UTF-8( JSON ) ) )，不補 '='
```

- 前綴 `TTHOL1` 的數字就是格式主版本，等於 JSON 的 `v`。不相容的改動要升版號，genbu 遇到不認得的版號時明確提示「請更新網站／更新 tthol-reader」，不要猜。
- Python：`zlib.compressobj(9, zlib.DEFLATED, -15)`。瀏覽器：`new DecompressionStream("deflate-raw")`。
- 字串大約 1–2 KB。
- **連結形式**：`https://genbu.hanshino.dev/tools/stat-sim#import=TTHOL1.<payload>`。放在 `#` 後面，所以不會送到伺服器。genbu 讀到 hash 後要清掉，避免重新整理時重複匯入。
- genbu 的匯入框同時接受純字串和整段連結，前後空白要忽略。

---

## JSON 結構（v1）

```jsonc
{
  "v": 1,
  "app": "1.4.0",                 // tthol-reader 版本，只拿來顯示與除錯
  "at": "2026-10-03T14:05:00Z",   // 讀取時間（UTC）
  "name": "止戰詩園",
  "sect": 8,                      // sect.ini ID，HP −196；等同 CharacterV1.sectId
  "level": 190,                   // HP −36
  "bare": { "str": 59, "pow": 1, "vit": 1, "agi": 144, "dex": 21, "wis": 40 },  // HP −264..−244，不含裝
  "remainingPoints": 11,          // HP −32
  "equipment": {
    "cap":   { "id": 50401, "plus": 5, "inlays": [0, 0, 10737, 10737], "stats": { "hp": 950, "mp": 650, "def": 89, "mdef": 35, "hit": 30, "uncanny_dodge": 5 } },
    "body":  { "id": 50444, "plus": 5, "inlays": [0, 0, 10641, 10641], "stats": { "hp": 2375, "mp": 1563, "def": 461, "mdef": 355 } },
    "right": { "id": 55008, "plus": 5, "inlays": [0, 0, 11111, 11111], "stats": { "str": 6, "atk": 131, "hit": 12, "critical": 26, "attack_speed": 1 } },
    "left":  null
    // 十個 key 都要出現：cap body foot right left wing horse ornament1 ornament2 ornament3
  },
  "skills": { "21": 10, "24": 6, "1151": 2 },   // 全部已學技能 magic.id → 等級（被動、主動、經脈、收藏、成就都在內）
  "panel": {                       // 遊戲當下的面板（含裝備、丹藥、英雄），只拿來對照
    "attributes": { "str": 69, "pow": 1, "vit": 1, "agi": 148, "dex": 21, "wis": 40 },  // HP −96..−76
    "hp": 32442, "mp": 4530,       // 上限；compat 佈局要用 worker 已有的對調處理，不可直接讀 +4 / +12
    "atk": 753, "matk": 153, "def": 573, "mdef": 491,        // +72 +80 +84 +88
    "hit": 372, "dodge": 699, "critical": 42, "uncanny_dodge": 10,  // +92 +96 +100 +104
    "attack_speed": 13, "weight_cap": 69300                  // +64 +28
  }
  // 上面 panel 是止戰詩園 2026-10-03 只穿四件時的實際讀數；equipment 是示意，不是同一時間的裝備
}
```

### 欄位規則

| 欄位 | 規則 |
|---|---|
| `bare` | 六項都是 ≥ 1 的整數。**不含裝、不含丹藥**（吃賞善技巧丹後 HP −248 仍是 21，實測 2026-10-03）。 |
| `equipment.<slot>` | 空欄位填 `null`。對應 tthol-memory `EQUIP_SLOTS`：`CAP→cap`、`BODY→body`、`FOOT→foot`、`HAND_R→right`（雙手武器也在這裡）、`HAND_L→left`、`WING→wing`、`HORSE→horse`、`ORNAMENT_1..3→ornament1..3`。 |
| `.id` | 記憶體裡的 item id。**同一個名稱在 DB 裡可能有好幾個 id**（隨機素質款，例如天御蒼龍甲 50444 / 55231），一律用 id 對應，不要用名稱。 |
| `.plus` | 強化 +N，0–20。 |
| `.inlays` | 長度 4，依記憶體插槽順序（`+0x226/+0x22A/+0x22E/+0x232`），0 表示空槽。遊戲從**最後一格往前**填，所以 2 槽裝備是 `[0, 0, a, b]`。值是 `compounds.id`，等於 `SocketFill.recipeId`。 |
| `.stats` | 道具實例上的數值，是**固定值 + 隨機素質 + 全部插槽**的合計，**不含強化**。只列非 0 項。武器傷害區間（`damage_*`）不匯出。 |
| `skills` | key 是十進位字串。tthol-reader 不做任何篩選。 |
| `panel` | 選填，可以整個省略或只給部分欄位。 |

### 數值 key 對照（`stats` / `panel` 都適用，已換成 genbu 的 `StatKey`）

| tthol-memory（items 欄位） | genbu StatKey |
|---|---|
| `hp` `mp` `str` `pow` `vit` `agi` `dex` `wis` `atk` `matk` `hit` `dodge` `uncanny_dodge` `attack_speed` `run_speed` | 同名 |
| `extra_def` | `def` |
| `magic_def` | `mdef` |
| `critical_hit` | `critical` |

實例的 `hp` / `mp` 只在旗標為 0 或 1（固定加值）時計入，這部分由 tthol-memory 的 `read_item_stats` 處理。

---

## genbu 匯入流程

匯入**一律新建角色**，不覆蓋現有角色。名稱沿用 `name`，跟現有角色撞名時加上「（匯入）」。

1. **解碼與驗證**：前綴、版號、JSON 結構有一項不對就整筆拒絕，並說明是哪一項。
2. **門派**：`sect` 不在 `SectId`（2 / 4 / 8 / 512 / 2048 / 4096 / 8192）時拒絕。轉職前的門派是 1 / 256 / 1024，提示「v1 尚未支援轉職前門派」。
3. **等級、配點**：`level` 直接用；`attributes = bare`，不需要再做含裝換算。
4. **轉生點數**：`inferRebirthPoints({ level, attributes: bare, remaining: remainingPoints })`。
   - `ok`：填入 `rebirthPoints`。
   - `check` / `incomplete`：填 0，並把 `reasons` 顯示在匯入結果裡。
   - 記憶體裡沒有轉生次數，也沒有每次轉生的等級，所以 `rebirthLevels` 不要填。
5. **被動**：`passiveLevels` 只保留 `data.passives` 裡有的 id，等級照抄；超過 `maxLevel` 的截到上限並提示。收藏 1151–1159 和成就 1181–1202 也是從技能清單來的，**不要再用收藏值去換算**。
6. **副門派**：只看 `data.passives` 的 `clan`。`skills` 裡屬於 `group: "sub"` 的被動，依 clan 計算技能數，由多到少取前兩個；超過兩個時提示。副門派的被動（鍛體、煉心、棍法修行 …）都在 `passives` 裡，這樣就夠用，不需要把全部技能的 clan 傳到 client。
7. **經脈**：`GameData` 要新增 `meridianIds: number[]`（`SELECT magic_id FROM magic_meridians`，目前沒有傳到 client）。`skills` 裡的 id 只要在這個清單裡，就是經脈穴位，用 `encodePlan` 組成 `meridianPlan`。v1 引擎不計算經脈，但先存起來，之後接上就能直接用，現在也能讓經脈模擬器打開。
8. **英雄 / 陣法**：記憶體讀不到，`manual` 留空。
9. **裝備**：照下一節拆解。

### 裝備拆解

每一件裝備，設 `F` = `itemsById[id].stats`（DB 固定值），`S` = 匯出的 `stats`。

1. `itemsById[id]` 不存在時，`manualBonuses = S`，回報 `missing-item`。
2. 剩餘量 `R = S − F`，逐項相減。不能為負數，出現負數就是資料版本不一致：把負值項目放進 `manualBonuses` 並提示。
3. **插槽**（`inlays` 的非 0 值依序對應 `sockets[0..]`，空槽填 `null`，長度不超過 `socketCount`）：
   - 配方不存在或類別不符時，該槽填 `null`，回報錯誤。
   - **固定值配方**（只有一種效果，而且 min = max）：直接填 `{ recipeId, stat, value }`，然後 `R[stat] -= value`。
   - **區間配方**：同一屬性的區間插槽集中處理，見第 5 步。
   - **多效果配方**（例如一個配方可能抽到兩種屬性）：選 `R` 還有正值、而且數值落得進區間的那個屬性。
4. **隨機素質**：對每個 `randomOptions` 的屬性，如果 `R[stat] > 0`，就產生一筆 roll（`attribute` 用 `option.attribute` 原文）。
5. **同一屬性同時有區間插槽和隨機素質時**，要把 `R[stat]` 分到兩邊。這時沒有唯一解，因為記憶體只存合計：

   **插槽每格的實際數值，記憶體裡沒有。**插槽區每格只有 u16 配方 id 後接 `00 00`（2026-10-03 dump 驗證）。

   分配規則（決定性，同一筆輸入每次結果都一樣）：
   - 插槽先全部取各自的 min。
   - 剩下的優先給隨機素質，夾在隨機素質區間內。
   - 再有剩的，依插槽順序往上加，直到各格的 max。
   - 加完還有剩、或怎麼分都低於下限，就是無解：這個屬性整筆放進 `manualBonuses`，回報「無法拆解」。

   沒有隨機素質的屬性，只在插槽之間平均分，每格都要在區間內。合計一樣，面板結果就一樣。
6. 還有剩的 `R` 放進 `manualBonuses`，回報「這件裝備有 X 無法對應到隨機素質或插槽」。正常情況下應該是空的。
7. 拆解完用 `computePanel` 驗算，該裝備的 `issues` 不能出現 `invalid-*`，有的話退回第 6 步的處理。

例：天御蒼龍甲 50444，DB 固定值是空的（全部是隨機素質），兩格狂暴劫匪小真元強化（防禦 +25 固定）。
`R = { hp 2375, mp 1563, def 461, mdef 355 }` → 兩格插槽各填防禦 25 → 隨機素質：防禦 411、護勁 355、體力 2375、真氣 1563。這件沒有根骨（probe 的裝備六圍合計根骨是 0），所以只有 4 條，比 `item_rand_counts.mod_count_min = 5` 少一條。genbu 不要求填滿下限，這裡照實際讀到的匯入，但這表示 `mod_count` 不一定代表「實際一定有幾條」。tthol_data 的推測（`scripts/zhenjie_investigation.md` §2.5）：`mod_count` 是**抽幾次**，抽過的屬性可以再被抽到，重複抽到時不疊加，所以實際條數常少於 `mod_count`。匯入端因此**不能**因為條數少於下限就回報錯誤。如果重複抽到其實會疊加，數值就可能超過區間上限，這時第 7 步的驗算會擋下來，退回 `manualBonuses`。真的遇到時要回報給 tthol_data，這種案例可以確定是哪一種機制。

### 匯入後的對照卡

有 `panel` 時，拿 `computePanel` 的結果逐項比對，列出差值和可能原因。**差值不算錯誤**，只是資訊提示。

| 差值出現在 | 最可能的原因 |
|---|---|
| 六圍（`panel.attributes − computePanel.attributes ≠ 0`） | **有屬性丹藥**（賞善X丹，每顆 +10，會經過屬性公式影響衍生值）。記憶體的 buff 陣列（HP+0x288 / +0x4C4）**不記錄**丹藥，只能從這裡看出來。1189–1194（六圍 +1/級）在 `magic_stats` 裡，已經算進被動，不會造成差值。 |
| 衍生值固定差一個數（物攻 / 內勁 / 防禦 / 護勁 / 體力 / 真氣） | 英雄 / 陣法、符類藥水（直接加在最終值）；或經脈（v1 不計算） |
| 負重上限 | 已知殘差 +0..+215；生效中的藥水也會加上藥的重量（賞善技巧丹 +25） |
| 物攻（拿弓 / 暗器） | 遠程物攻公式未定 |
| 攻速（拿武器） | `attack_speed.ini` 換算未解 |

對照卡上可以放一個「以遊戲六圍為準」的按鈕：差值是丹藥造成時，玩家知道之後可以直接忽略。

---

## tthol-memory 匯出端

- `knowledge.json` 補上 `−264..−244`（不含裝六圍）和 `−32`（剩餘屬性點）兩組欄位。
- `reader.read_bare_attrs(pm, hp_addr)`、`reader.read_remaining_points(pm, hp_addr)`。
- 插槽要保留位置：現在的 `read_item_inlays` 會丟掉 0，匯出要改用固定長度 4 的版本（新函式，或加一個參數），空槽補 0。genbu 靠這個位置把記憶體插槽對到 `sockets[i]`。
- 體力 / 真氣上限沿用 worker 的 compat 處理（`read_all_fields(compat_mode)`），不要直接讀 +4 / +12。
- `services/stat_sim_export.py`：從 worker 最近一次讀到的角色資料組 JSON，壓縮、編碼。純函式，要附測試。
- `GET /api/characters/{pid}/stat-sim-export` → `{ code, url }`。
- 角色頁加「複製到配裝模擬器」按鈕：複製字串，旁邊附一個開啟連結的按鈕。pywebview 要用 `webbrowser.open` 開外部瀏覽器。
- 角色還沒定位完成、裝備或技能還沒讀到時，按鈕停用，不要匯出殘缺資料。

---

## 已驗證（2026-10-03，兩隻天外天：Lv31 未轉、Lv190 四轉）

- `面板六圍 − bare − 裝備（實例 + 強化）− 被動 magic_stats` 六項都是 0。
- `bare` + `remainingPoints` 推出的轉生總和是 0 / 140，跟角色實際狀況一致。tthol_data 另外驗證過移花宮 Lv192、麒麟 Lv198。
- `實例 − DB 固定值` 沒有出現負數，等於插槽加上隨機素質。
- 收藏技能會出現在技能清單裡（移花宮 Lv192 的 skills 有 1151 Lv1）。
- 實機樣本：`docs/plans/stat-sim-import-samples/`（天外天 Lv190、移花宮 Lv192）。
- 吃賞善技巧丹：`bare` 不變；面板技巧 +10、命中 +30、重擊 +1、負重上限 +25；buff 陣列沒有記錄。

## 還沒驗證

- compat 佈局（HP / MP 的目前值與上限對調）的角色，`bare`、`remainingPoints` 的位置是否一樣，`panel.hp` / `panel.mp` 是否讀對。
- 多效果配方的拆解，還沒有實際案例。
