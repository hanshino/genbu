// messages / message_options / npc_strings (MSG{file_no}.INI + MSGNAME.INI)
//
// MSG 對話文本：每個 file_no 大致對應一張地圖（特例：file_no=1 是系統 + 成都）。
// 任務事件語意（接取/設定進度/完成/重置/計時器）與 trigger op 對照表已由上游
// tthol_data repo 的 `scripts/trigger_op_investigation.md`（及其 CLAUDE.md 的
// parser 對照表）解析、寫回 mission_events / trigger_ops / op_defs 三張表，
// genbu 只需查表，不再自行解析 messages.triggers 原始 DSL。

/** 對話節點上玩家可點的選項。 */
export interface MessageOption {
  /** 1..8 */
  index: number;
  /** OptStr — 顯示文字 */
  text: string | null;
  /** OptJump — 點下後跳到本檔 (file_no) 內的 msg_id */
  jumpTo: number | null;
  /** OptAction — 罕用，原始 DSL token 字串 */
  action: string | null;
}

/** 一筆 message + 其選項，已 join 上 npc_strings 取得說話者名稱。 */
export interface MessageNode {
  fileNo: number;
  msgId: number;
  /** 來自 messages.name_id → npc_strings.name；null 代表系統訊息（無說話者）。 */
  speaker: string | null;
  text: string | null;
  options: MessageOption[];
  /** Msg.Jump — 顯示後自動跳到的下一個 msg_id（無選項時用）。 */
  jumpTo: number | null;
}

/** mission_events.event 的語意，對照 upstream 解析出的 opcode：
 *  - accept     — A33 且 step=0：第一次接任務
 *  - set_step   — A33 且 step>0：設定目前進度到 step
 *  - step_done  — A13 且 step<15：完成第 step 步
 *  - complete   — A13 且 step=15：整個任務完成
 *  - reset      — A34：重置任務
 *  - timer35    — A35：設定計時器 35（minutes，-1 = 無）
 *  - timer36    — A36：設定計時器 36（minutes，-1 = 無）
 */
export type MissionEventKind =
  | "accept"
  | "set_step"
  | "step_done"
  | "complete"
  | "reset"
  | "timer35"
  | "timer36";

/** 單一 mission_events 列（已過濾 is_gm=1、is_mission=1）。 */
export interface MissionEvent {
  event: MissionEventKind;
  step: number | null;
  minutes: number | null;
}

/** trigger_ops 的人類可讀翻譯：op_defs.name_zh + 參數。 */
export interface TriggerOpTranslation {
  kind: "C" | "A";
  op: number;
  /** 例如「等級(>=, 25)」；op_defs 無 name_zh 時退回 "C4(>=, 25)" 形式。 */
  label: string;
  /** op_defs.confidence !== "confirmed" 時為 true，UI 需標示為推測語意。 */
  likely: boolean;
}

/** 某任務的全部相關對話，依 file_no 分組。 */
export interface MissionDialogueGroup {
  fileNo: number;
  entries: Array<
    MessageNode & {
      events: MissionEvent[];
      triggerOps: TriggerOpTranslation[];
    }
  >;
}
