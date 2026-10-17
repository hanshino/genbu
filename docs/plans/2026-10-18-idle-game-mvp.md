# 放置掛機 MVP（階段 1）

Roadmap：`docs/roadmaps/idle-game.md`。這份是第一階段的實作規格。

## 使用者已決定

- 地圖：雷島南˙淺灘（stage 147；148–152 怪物相同）。怪物：5407 ▲沙包海馬（Lv3、HP 50、exp 85）、5408 ▲肉靶龜（Lv5、HP 110、exp 94）。
- 怪物不反擊：角色沒有 HP 狀態、不會死。
- 數值照原作公式（`src/lib/combat/damage.ts`、`char_levels`），只用一個「遊戲速度」倍率調整節奏。
- 進度存伺服器（登入後），離線收益由伺服器結算。
- 屬性點：升級時照原作給點，玩家自己配；另有「依門派自動配點」按鈕。
- 版面：場景置頂（地圖底圖、角色走路 → 打怪），下方一條等級／經驗／金錢，再下方分頁「角色／技能／戰鬥紀錄」。點數分配放在「角色」分頁內。

## 架構：同一個確定性引擎跑兩端

引擎是純函式 `advance(state, ticks, data) → { state, events }`，不碰 DB、不碰 DOM，亂數全部走 seeded PRNG（mulberry32），種子存在 state 裡。

- **瀏覽器：** 用它推進畫面；`events`（開始找怪、遇怪、施放、命中/未命中、擊倒、經驗、金錢、升級、命中不足）驅動動畫與紀錄。
- **伺服器：** 存檔與離線結算都是「從上次存檔的 state 重跑同一個引擎」，所以畫面和存檔不會兜不起來，不需要另外的期望值模型。
- **存檔流程：** 瀏覽器定期（約 30 秒、升級、配點、換技能、離開頁面）呼叫 `POST /api/idle/sync`，帶 `{ saveCounter, clientTicks }`。伺服器從自己存的 state 重跑 `min(clientTicks, 實際經過時間換算的 ticks)`，存下新 state 回傳。瀏覽器只送「跑了多久」，不送結果，所以不用驗證數值。
- **離線結算：** `GET /api/idle` 載入時，伺服器依 `now − lastSettledAt` 重跑，上限 **12 小時**；回傳結算摘要（擊倒數、經驗、金錢、升級），畫面開場顯示「離線期間…」。重跑時以每秒 ticks × 速度倍率換算；長時間結算用批次快轉（不產生逐筆 events，只累計）。
- **配點、換技能：** 先 sync 到現在，再套用變更，因為擊殺率會跟著變。

## 狀態（`idle_saves`，版本化 JSON）

```sql
CREATE TABLE IF NOT EXISTS idle_saves (
  sub TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  state TEXT NOT NULL,          -- JSON
  updated_at INTEGER NOT NULL
)
```

v1 欄位：`presetId, gender, sectId, level, exp, money, attributes, unspentPoints, skillId, skillLevel, stageId, seed, saveCounter, lastSettledAt, phase`（目前階段與剩餘 ticks，讓重跑可以從中途接上）、`stats`（累計擊倒數等）。之後的階段只加欄位、用 `version` 判斷。

## 循環

`找怪中`（走路，固定秒數 × 速度倍率，之後換成依移動速度）→ `遇怪`（依出現比例抽 5407 / 5408）→ `施放`（時長取技能演出時間軸 ticks，每次命中照 `playerHit` 判定）→ 怪物 HP 歸零 → `擊倒`（經驗 `drop_exp`、金錢 `drop_money_min..max`）→ 回到找怪。

- 角色數值：用 `computePanel`（`src/lib/stat-sim.ts`）由門派、等級、六圍算面板，再對應到 `Attacker`；武器取該預設角色的 `effect_presets.weapon_item_id` → `items` 的 damage / pdamage / type。
- 技能（v1 簡化）：只用一招。可選範圍＝該門派技能中 `magic_learn.char_level ≤ 角色等級`、武器符合（`requiredWeapon`）、且有演出資料的；技能等級取可學的最高級；不扣經驗、金錢、內力。內力與多技能是階段 2。
- **命中不足：** `hitChance` 可能是 0（命中低於閃躲的 1/1.5）。引擎不能空轉：連續一段時間全 miss 時發出 `hit-too-low` 事件並帶 `computeHitRequirement` 算出的需求命中，畫面提示「命中不足，建議加點技巧」。

## 已查證的事實

- `TargetLike` = `{level, extraDef, magicDef, baseDodge}`，對應 `monsters.level / extra_def / magic_def / base_dodge`（5407：3 / 1 / 1 / 65；5408：5 / 3 / 3 / 67）。
- `SkillLike` 欄位都在 `magic`（func_dmg、func_dmg_p1..p4、func_hit_p1、spend_mp、spend_flag）。
- 屬性點：`levelPoints(level)` 已在 `stat-sim.ts`。

## tthol-data 回覆（2026-10-18）

- `char_levels.exp` **是每級所需，不是累計**：第 L 列＝在 L 級內要累積多少經驗才升到 L+1（實機封包確認）。與預設一致。
- 等級差經驗增減、組隊分配：客戶端沒有這條規則（伺服器決定），單人直接用 `drop_exp`。v1 不做。
- 移動速度：角色有速度等級（1..44）對照 Move_Speed.ini「每 40 px 一格的毫秒數」，例如 5 = 250、10 = 208、17 = 168、30 = 125。新角色的基礎等級未知（伺服器設定），v1 用 5（250 ms/格）。沒有獨立的跑步。
- 怪物 `walk_speed` 推測同一張表（海馬 5 → 250 ms/格；龜 2 → 500），未驗證。
- 重生：stage 147 每種怪 23 個生怪點、每點 8 隻，重生間隔 45 秒（地圖預設值）。
- 玩家普攻間隔、脫戰回血回魔：未知（伺服器端）。技能的 `magic.recharge_time` 是施放時間、`stun` 是間隔時間、`cd_time` 是冷卻，單位都是毫秒。
- 怪物經驗與金錢：海馬 85 / 2..4、龜 94 / 1..7，來自 NPC.BIN，可能與 monster.ini 有出入，視為近似值。
- 動作圖（db-2026-10-18-1）：60 個預設角色都有 `walk`（走路時不顯示武器，原作如此）；海馬（pic 5582）、龜（pic 5584）有 wait / walk / hurt / death。另有 sit / death / hurt 可再補。

## 建立角色與轉職（2026-10-18 決定，依 tthol-emulator 規則）

來源：tthol-emulator `server/chargen.py`、`server/progress.py`、`server/stats.py`、`server/attack_speed.py`、`server/jobchange.py`、`docs/server-only-data.md`。

- 畫面照原作「創造角色」視窗（NewCreate-1，db-2026-10-17-6 的 `ui_windows` / `ui_controls` / `ui_images`），紙娃娃位置用 control 77 畫。
- 可選：名字（Big5 ≤ 15 bytes；不可空白、不可含 `~!@#$%^&*()=+|?/,'{}"\;`、不可含「GM」）、性別、六項屬性初始點。髮型／髮色先固定（場景用預先合成的入門弟子動作圖）；出生地固定雷島（char.ini 的 55 流星雷島˙南）。
- 初始：入門弟子（clan bit 1，人族）、Lv1、經驗 0、金錢 0、六項屬性 1、可分配 6 點（`levelPoints(1)`），空手。
- 加點成本 `pointCost`：≤10 為 1，之後 `2 + ⌊(v − 11) / 15⌋`，**上限 10**（genbu 現有實作少了上限，要補）。屬性上限：Lv140 以下 99。
- 轉職（使用者簡化）：**到 9 級自動獲得轉職證書**，之後可選惡人谷／移花宮／天外天；選定後換成該門派的預設角色外觀與武器，技能改用該門派的。原作要學完新手技能，v1 省略。
- 入門弟子 1–8 級沒有可學的傷害招式，用普通攻擊。
- 起始武器：char.ini 給 23004 新手用青銅刀（BLADE）；emulator 直接裝在右手，另有 23001 草鞋、23002 布衣、23003 圓盾。v1 讓新角色裝備新手用青銅刀（外觀用入門弟子・刀預設角色 102 / 103）。
- 入門弟子面板（`stats.py` NOVICE_SECTS，**未實測，emulator 沿用移花宮那一列**）：護勁 ⌊3P/2⌋ + W；MP 上限 6·Lv + 40 + 6P + 9W；HP 上限 ⌊(20000 + 1000·Lv + 45·Lv·(Lv+1)) / 100⌋ + ⌊18·V·(V+1) / 20⌋（兩段分別取整）。物攻、內勁、防禦、命中、閃躲、重擊、拆招與門派無關。
- 普攻間隔（`server/attack_speed.py`、`data/attack_speed.csv`）：v = attack_speed.ini[右手武器類型][門派]（空手 185；刀 入門 170；劍 入門 175；匕首 180；棍 170；倭刀 175 …）；s = v + ⌊(250 − v) × 身法 / 250⌋；等級 = 階梯 (0, 150, 157, 163, 170, 177, 183, 190, 197, 203, 210, 217, 223, 230) 中 ≤ s 的個數，再加裝備的 attack_speed 加成；揮擊週期 = 3 × (17 − 等級) × 0.48 / 27 秒（Lv1 ≈ 0.85 秒、Lv14 ≈ 0.16 秒）。

## 仍待定

- 找怪要走多遠（決定找怪秒數）：v1 先用固定 3 秒 × 速度倍率，之後依移動速度與重生間隔估算。
- 施放後間隔：v1 先用 0.5 秒；可改用技能的 `stun`（間隔時間，毫秒）。
