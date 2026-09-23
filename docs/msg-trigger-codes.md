# MSG Trigger DSL 解析

> **語意來源已上游化**：op 語意的權威來源現在是 `tthol_data` repo 的
> `scripts/trigger_op_investigation.md` 及其 `CLAUDE.md` 的 parser 對照表，
> 那邊解析原始 `messages.triggers` DSL 後，把結果寫回 `tthol.sqlite` 的
> `mission_events`（任務語意事件：accept/set_step/step_done/complete/reset/
> timer35/timer36）、`trigger_ops`（逐 op 拆解，含 a0..a4 參數）、`op_defs`
> （op → 中文名稱 + 信心等級）三張表。**genbu 端（`src/lib/queries/messages.ts`）
> 只查這三張表，不再自行解析 `messages.triggers` 原始 DSL** —— 下方
> 「已解碼 opcode」表格中的 A13/A33/A34/A35/A36 已依上游最新結果更正；
> 其餘 op 仍保留舊調查記錄供參考，若要異動請回上游 repo 修正再重新匯出。

`messages.triggers` 是一段純數字 token、用 `,` 分隔的 DSL；遊戲 INI 沒有 opcode 文件，要靠交叉比對來推斷。本文件記錄已破解的 opcode 與信心等級。

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
| 33 | 🔶 | `SET_MISSION_STATE(missionId, step, unknown)` — step=0 為接取(accept)，step>0 為設定目前進度(set_step) | mission 91.9% | mission_events.event ∈ {accept, set_step} |
| 34 | 🔶 | `RESET_MISSION(missionId)` — 重置任務 | mission 89.9% | mission_events.event = reset（注意：與舊版「ACCEPT」定義相反，已更正） |
| 13 | 🔶 | `MISSION_STEP_DONE(missionId, step)` — step<15 為完成該步驟(step_done)，step=15 為整個任務完成(complete) | mission 92.9% | mission_events.event ∈ {step_done, complete} |
| 35 | ✅ | `SET_TIMER35(missionId, minutes)` — 設定計時器 35，-1 = 無限時，到期由 C29 檢查 | mission 91.0% | mission_events.event = timer35；1 時辰 = 10 分鐘 |
| 36 | ✅ | `SET_TIMER36(missionId, minutes)` — 設定計時器 36，-1 = 無限時，到期由 C30 檢查 | mission 91.0% | mission_events.event = timer36；1 時辰 = 10 分鐘 |
| 37 | 🔶 | `GIVE_ITEM(itemId, qty)` | item 99.3% | 給玩家物品 |
| 8  | 🔶 | `TAKE_ITEM(itemId, qty)` | item 99.3% | 收回物品（任務交付） |
| 42 | ❓ | — | mission 17%、unknown 81% | 多用途，未拆解 |
| 77 | ❓ | mission progress？ | mission 61% | 信心不足，先當 mission op 但 UI 不顯示 |

---

## Mission ↔ Message 連結規則

`src/lib/queries/messages.ts` 的 `getMissionDialogue()` 直接查 `mission_events`
（`WHERE mission_id = ? AND is_mission = 1 AND is_gm = 0`），語意對照：

```
A33 step = 0   → event = "accept"    （接取）
A33 step > 0   → event = "set_step"  （設定目前進度到 step）
A13 step < 15  → event = "step_done" （完成第 step 步）
A13 step = 15  → event = "complete"  （整個任務完成）
A34            → event = "reset"     （重置任務）
A35            → event = "timer35"   （minutes，-1 = 無限時）
A36            → event = "timer36"   （minutes，-1 = 無限時）
```

`is_gm = 1` 的列一律排除（GM 專用觸發，不對應玩家實際遊玩路徑）。

每則對話另外提供 `trigger_ops` 逐條翻譯（`op_defs.name_zh` + a0..a4 參數），
`op_defs.confidence !== "confirmed"` 的條目標記為推測語意。

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
# 1. 查某任務的事件（權威來源，見本檔頂部 note）
SELECT file_no, msg_id, event, step, minutes
FROM mission_events
WHERE mission_id = ? AND is_mission = 1 AND is_gm = 0
ORDER BY file_no, msg_id;

# 2. 抽樣某 opcode 的 context（原始 DSL 層級，重新調查用）
SELECT m.file_no, m.msg_id, m.msg, mo.text AS opt_text, m.triggers
FROM messages m
LEFT JOIN message_options mo USING (file_no, msg_id)
WHERE m.triggers LIKE '%"<OP>",%'
LIMIT 20;
```

**更新時機**：`E:\new\SETTING` 內容異動（遊戲更新後重抓 INI）就要回 `tthol_data`
repo 重跑 opcode 解析、重新匯出 `mission_events` / `trigger_ops` / `op_defs`。
