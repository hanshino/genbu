# 放置掛機小遊戲 Roadmap（草稿）

在 genbu 上做一個設定貼近武林同萌傳的放置掛機小遊戲：畫面上角色「找怪中」播走路，遇怪後用對應技能攻擊，打倒怪物拿經驗、金錢與掉寶。功能逐步討論、逐步開放。

## 已決定

- **存檔：** 登入（LINE）後存在 genbu 使用者資料庫（`GENBU_USER_DB_PATH`），換裝置可接著玩；離線收益由伺服器依經過時間計算結果，不在背景跑畫面。
- **戰鬥：** 瀏覽器端用數值模擬、畫面播放；伺服器負責存檔與離線結算。
- **流程：** 新 UI 先給版面選項討論，確定後才實作。

## 可直接沿用的資料與程式

| 需要 | 來源 |
|---|---|
| 怪物數值、經驗、金錢、掉寶 | `monsters`（hp、屬性、damage、base_hit/base_dodge、drop_exp、drop_money_*、drop_item） |
| 練功地點與底圖 | `monster_spawns`、`stages`、`map_images`、`src/lib/training-spots.ts` |
| 升級曲線 | `char_levels` |
| 技能傷害 | `../tthol-combat`（Python 純函式，tthol-headless / tthol-emulator 共用的權威公式：傷害、命中、重擊、真氣、多段）；`magic`、`magic_stats`。genbu 現有 `src/lib/stat-sim-damage.ts` 只驗證過 func_dmg 3/4/6/7/8 |
| 技能畫面 | 技能演出播放器（`src/lib/skill-effect.ts`、`src/components/skills/skill-effect-canvas.ts`） |
| 裝備 | `items`、`item_rand`、`strong_formula` |

## 缺口（需 tthol-data 補）

- 預設角色的走路／跑步動作圖（目前只有戰鬥動作）。
- 練功點怪物的動作圖：wait / hurt / death，怪物反擊需要 attack。目前只有咆嘯雪狼（pic 5520）。
- 怪物攻擊行為：可從 `npc_ai` 研究起。

## 階段（暫定，逐一討論）

1. **MVP 循環：** 選門派與預設角色 → 選一個練功點 → 自動「找怪中（走路）→ 遇怪 → 單一技能攻擊 → 經驗／金錢 → 升級」，進度存伺服器。
2. 多技能與內力消耗、技能自動輪替。
3. 掉寶與裝備、背包。
4. 多張地圖與解鎖條件、離線收益結算。
5. 之後再議：經脈、英雄、強化、合成、任務。

## 待討論

- MVP 的第一張練功地圖與開放的門派。
- 怪物是否反擊（影響是否需要血量／死亡與回復機制）。
- 數值要多貼近原作（直接用原公式 vs. 為放置節奏調整）。
