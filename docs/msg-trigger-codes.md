# MSG Trigger DSL 解析

`messages.triggers` 是一段純數字 token、用 `,` 分隔的 DSL；遊戲 INI 沒有 opcode 文件，要靠交叉比對來推斷。本文件記錄已破解的 opcode 與信心等級，供 `src/lib/queries/messages.ts` 的解析器引用。

來源：`E:\new\SETTING\setting\msg{N}.ini` 的 `Trigger{1..8}=…` 欄位（會被 message extractor 解碼後存進 SQLite，多個 trigger 以 JSON array of arrays 形式 pack 在 `messages.triggers`）。

---

## Trigger 整體結構

```
[ "0",                          // header（永遠是 0）
  condCount,
  (opcode, expect, argCount, ...args)^condCount,
  actionCount,
  (opcode,         argCount, ...args)^actionCount ]
```

- `expect` ∈ {`"True"`, `"False"`} — 條件期望結果。整段 trigger 必須**全部**條件吻合 expect 才會執行 actions。
- `argCount` 是該 opcode 接幾個參數（不固定，看 opcode 定義）。
- 16,794 筆 trigger 用此格式 0 失敗解析（驗證資料：本專案 `tthol.sqlite`，2026-04 版）。

---

## 已解碼 opcode

信心等級：
- ✅ **confirmed** — 由具體 NPC/任務的 msg+option+text 三角驗證過
- 🔶 **inferred**  — 由 arg id range（`mission`/`item`/`npc` 80%+ 命中率）推得
- ❓ **guessed**   — 結構合理但缺實證，UI 暫不依賴

### 條件 opcodes (cond)

| OP | 信心 | 推斷意義 | arg[0] 範圍命中 | 備註 |
|---:|:---:|---|---|---|
| 27 | ✅ | `MISSION_STATE(missionId, stepValue)` — 任務 missionId 在 stepValue 步驟 | mission 88.1% | True/False 共用，最常見的條件 opcode |
| 28 | ✅ | 與 27 互補 — 不同的 mission state 比較 | mission 90.9% | 跟 27 通常成對出現 |
| 31 | 🔶 | `HAS_ITEM(itemId, qty)` | item 99.3% | 任務「需要 N 個 X」前置檢查 |
| 4  | ❓ | 玩家狀態檢查（等級 / 性別 / 等？） | small 0–250 範圍 | arg 範圍小，未對應到任何資料表 id |
| 34 | ❓ | 全域旗標／NPC 對話狀態？ | mission 1.2% | 命中率低，**不是**任務 op |
| 52 | ❓ | — | 0–820 | 未解 |

### 動作 opcodes (act)

| OP | 信心 | 推斷意義 | arg[0] 範圍命中 | 備註 |
|---:|:---:|---|---|---|
| 12 | ✅ | `JUMP_TO_MSG(msgId)` | 73.6% 命中本檔內 msg_id | OptStr/OptJump 鏡像；剩 26% 為跨檔跳轉 |
| 33 | ✅ | `SET_MISSION_STATE(missionId, stepIdx, value)` | mission 91.9% | 改任務步驟 |
| 34 | ✅ | `ACCEPT_MISSION(missionId)` | mission 89.9% | 接任務的核心動作（msg7→8 驗證） |
| 13 | 🔶 | mission state mutator（give reward？complete？） | mission 92.9% | 跟 33/35/36 同族 |
| 35 | 🔶 | mission state mutator | mission 91.0% | arg[1] 看起來是數值（exp/數量？） |
| 36 | 🔶 | mission state mutator | mission 91.0% | 跟 35 結構相同，意義待分 |
| 37 | 🔶 | `GIVE_ITEM(itemId, qty)` | item 99.3% | 給玩家物品 |
| 8  | 🔶 | `TAKE_ITEM(itemId, qty)` | item 99.3% | 收回物品（任務交付） |
| 42 | ❓ | — | mission 17%、unknown 81% | 多用途，未拆解 |
| 77 | ❓ | mission progress？ | mission 61% | 信心不足，先當 mission op 但 UI 不顯示 |

---

## Mission ↔ Message 連結規則

`src/lib/queries/messages.ts` 的 `buildMissionLinkIndex()` 用以下規則：

```
COND opcodes 27, 28          → 若 args[0] ∈ missions.id：
                                 expect="True"  → role = "check_progress"
                                 expect="False" → role = "gated_off"

ACT opcodes 13, 33, 34, 35, 36 → 若 args[0] ∈ missions.id：
                                   34 → role = "accept"
                                   33 → role = "set_state"
                                   13/35/36 → role = "progress"
```

實測連結率（針對 1,323 個任務）：覆蓋率 80%+；少數任務（特別是純地圖事件、自動劇情）不會出現在 trigger 裡，沒對話可關聯。

---

## 待解 opcodes

依出現次數 ≥30 排序，仍未確認語意者：

```
COND: 4(2962) 52(1260) 2(1162) 37(932) 73(688) 119(615) 120(610)
      76(517) 84(297) 26(296) 3(207) 96(152) 129(134) 125(92)

ACT:  77(869) 3(642) 48(622) 86(453) 9(306) 30(248)
      27(243) 64(206) 68(205) 79(191) 47(135) 140(112) 85(110)
```

**下一輪優先**：A77（task progress 候選）、A30（負值常見、可能是「扣血/扣錢」）、A86（reward bonus？）。
解碼策略：抽樣 10–20 筆出現該 opcode 的 trigger，把所在 msg 的 NPC + 文本 + 選項 結構讀過，套常識推測。

---

## 重現方法

```bash
# 1. 解析所有 trigger 並掃 opcode 分布
node -e '...'  # 見 src/lib/queries/messages.ts 的 parseTrigger 函式

# 2. 抽樣某 opcode 的 context
SELECT m.file_no, m.msg_id, m.msg, mo.text AS opt_text, m.triggers
FROM messages m
LEFT JOIN message_options mo USING (file_no, msg_id)
WHERE m.triggers LIKE '%"<OP>",%'
LIMIT 20;
```

**更新時機**：`E:\new\SETTING` 內容異動（遊戲更新後重抓 INI）就要重跑 opcode 統計，並補上新出現的 opcode。
