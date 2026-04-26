// messages / message_options / npc_strings (MSG{file_no}.INI + MSGNAME.INI)
//
// MSG 對話文本：每個 file_no 大致對應一張地圖（特例：file_no=1 是系統 + 成都）。
// triggers 欄位是原始 DSL（純數字 token，沒有官方 opcode 表）— 解析方式
// 與 opcode 對照見 `docs/msg-trigger-codes.md`。

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

/**
 * Trigger 推斷出來的「此訊息對該任務扮演的角色」。
 * 來源 opcode：
 *   - C27 expect=True   → "check_progress" （在某狀態才顯示這段）
 *   - C27/28 expect=False / inverse → "gated_off"
 *   - A34 → "accept"     （第一次接任務）
 *   - A33 → "set_state"  （改任務步驟）
 *   - A13/35/36 → "progress" （任務狀態變更）
 */
export type MissionMessageRole =
  | "accept"
  | "progress"
  | "set_state"
  | "check_progress"
  | "gated_off";

/** 某任務的全部相關對話，依 file_no 分組。 */
export interface MissionDialogueGroup {
  fileNo: number;
  entries: Array<MessageNode & { roles: MissionMessageRole[] }>;
}
