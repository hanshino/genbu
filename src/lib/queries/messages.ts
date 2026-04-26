import { getDb } from "@/lib/db";
import type {
  MessageNode,
  MessageOption,
  MissionDialogueGroup,
  MissionMessageRole,
} from "@/lib/types/message";

// =========================================================================
// Trigger DSL parser
// 結構（以 comma-separated token array 為單位）：
//   [ "0",                          // header（永遠是 0）
//     condCount,
//     (opcode, expect("True"/"False"), argCount, ...args)^condCount,
//     actionCount,
//     (opcode, argCount, ...args)^actionCount ]
// 詳見 `docs/msg-trigger-codes.md`。
// =========================================================================

interface TriggerCondition {
  op: string;
  expect: string;
  args: string[];
}
interface TriggerAction {
  op: string;
  args: string[];
}
interface ParsedTrigger {
  conds: TriggerCondition[];
  acts: TriggerAction[];
}

function parseTrigger(arr: string[]): ParsedTrigger | null {
  if (arr.length === 0 || arr[0] !== "0") return null;
  let i = 1;
  const condCount = parseInt(arr[i++], 10);
  if (!Number.isFinite(condCount) || condCount < 0) return null;
  const conds: TriggerCondition[] = [];
  for (let c = 0; c < condCount; c++) {
    if (i + 3 > arr.length) return null;
    const op = arr[i++];
    const expect = arr[i++];
    const argc = parseInt(arr[i++], 10);
    if (!Number.isFinite(argc) || argc < 0 || i + argc > arr.length) return null;
    conds.push({ op, expect, args: arr.slice(i, i + argc) });
    i += argc;
  }
  if (i >= arr.length) return null;
  const actCount = parseInt(arr[i++], 10);
  if (!Number.isFinite(actCount) || actCount < 0) return null;
  const acts: TriggerAction[] = [];
  for (let a = 0; a < actCount; a++) {
    if (i + 2 > arr.length) return null;
    const op = arr[i++];
    const argc = parseInt(arr[i++], 10);
    if (!Number.isFinite(argc) || argc < 0 || i + argc > arr.length) return null;
    acts.push({ op, args: arr.slice(i, i + argc) });
    i += argc;
  }
  return { conds, acts };
}

// 推斷信心度高的「第一個參數 = mission_id」opcode 集合：
//   - 條件：C27（HAS_STATE）、C28（互補檢查）
//   - 動作：A13、A33（SET_STATE）、A34（ACCEPT）、A35、A36（state mutators）
// 命中率經 88–93% 抽樣驗證；不在 missions.id 範圍的 token 直接跳過。
const MISSION_COND_OPS = new Set(["27", "28"]);
const MISSION_ACT_OPS = new Set(["13", "33", "34", "35", "36"]);

function actionRole(op: string): MissionMessageRole {
  if (op === "34") return "accept";
  if (op === "33") return "set_state";
  return "progress"; // 13 / 35 / 36
}

// =========================================================================
// Mission-message link cache
// 50k 條 messages × 17k 條 triggers parse 結果 ~50ms；建一次後 in-memory 重用。
// 用 globalThis 避免 Next.js HMR 重複 build。
// =========================================================================

interface MissionMessageLink {
  fileNo: number;
  msgId: number;
  roles: Set<MissionMessageRole>;
}

const globalCache = globalThis as typeof globalThis & {
  _msgMissionLinkCache?: Map<number, MissionMessageLink[]>;
};

function buildMissionLinkIndex(): Map<number, MissionMessageLink[]> {
  if (globalCache._msgMissionLinkCache) return globalCache._msgMissionLinkCache;

  const db = getDb();
  const missionIds = new Set<number>(
    (db.prepare("SELECT id FROM missions").all() as Array<{ id: number }>).map(
      (r) => r.id,
    ),
  );

  const rows = db
    .prepare(
      "SELECT file_no, msg_id, triggers FROM messages WHERE triggers IS NOT NULL",
    )
    .all() as Array<{ file_no: number; msg_id: number; triggers: string }>;

  const result = new Map<number, MissionMessageLink[]>();
  // 同一 (mission, file_no, msg_id) 的多個 trigger 角色會合併
  const dedupe = new Map<string, MissionMessageLink>();

  for (const r of rows) {
    let triggers: string[][];
    try {
      triggers = JSON.parse(r.triggers) as string[][];
    } catch {
      continue;
    }

    for (const sub of triggers) {
      const parsed = parseTrigger(sub);
      if (!parsed) continue;

      // 累積此單一 trigger 對各 mission 貢獻的 roles
      const local = new Map<number, Set<MissionMessageRole>>();
      const addRole = (mid: number, role: MissionMessageRole) => {
        let s = local.get(mid);
        if (!s) {
          s = new Set();
          local.set(mid, s);
        }
        s.add(role);
      };

      for (const c of parsed.conds) {
        if (!MISSION_COND_OPS.has(c.op) || c.args.length === 0) continue;
        const mid = parseInt(c.args[0], 10);
        if (!Number.isFinite(mid) || !missionIds.has(mid)) continue;
        addRole(mid, c.expect === "True" ? "check_progress" : "gated_off");
      }
      for (const a of parsed.acts) {
        if (!MISSION_ACT_OPS.has(a.op) || a.args.length === 0) continue;
        const mid = parseInt(a.args[0], 10);
        if (!Number.isFinite(mid) || !missionIds.has(mid)) continue;
        addRole(mid, actionRole(a.op));
      }

      for (const [mid, roles] of local) {
        const key = `${mid}::${r.file_no}::${r.msg_id}`;
        let link = dedupe.get(key);
        if (!link) {
          link = { fileNo: r.file_no, msgId: r.msg_id, roles: new Set() };
          dedupe.set(key, link);
          let arr = result.get(mid);
          if (!arr) {
            arr = [];
            result.set(mid, arr);
          }
          arr.push(link);
        }
        for (const role of roles) link.roles.add(role);
      }
    }
  }

  globalCache._msgMissionLinkCache = result;
  return result;
}

// =========================================================================
// Public queries
// =========================================================================

export function getMissionDialogue(missionId: number): MissionDialogueGroup[] {
  const links = buildMissionLinkIndex().get(missionId);
  if (!links || links.length === 0) return [];

  const db = getDb();

  // 依 file_no 分群，把同檔的 msg_id 一次撈
  const byFile = new Map<number, MissionMessageLink[]>();
  for (const l of links) {
    let arr = byFile.get(l.fileNo);
    if (!arr) {
      arr = [];
      byFile.set(l.fileNo, arr);
    }
    arr.push(l);
  }

  const groups: MissionDialogueGroup[] = [];

  for (const [fileNo, list] of [...byFile.entries()].sort(
    ([a], [b]) => a - b,
  )) {
    const msgIds = list.map((l) => l.msgId);
    const ph = msgIds.map(() => "?").join(",");

    const msgRows = db
      .prepare(
        `SELECT m.msg_id     AS msgId,
                m.msg        AS text,
                m.jump_to    AS jumpTo,
                ns.name      AS speaker
         FROM messages m
         LEFT JOIN npc_strings ns ON ns.id = m.name_id
         WHERE m.file_no = ? AND m.msg_id IN (${ph})`,
      )
      .all(fileNo, ...msgIds) as Array<{
      msgId: number;
      text: string | null;
      jumpTo: number | null;
      speaker: string | null;
    }>;

    const optRows = db
      .prepare(
        `SELECT msg_id   AS msgId,
                opt_index AS idx,
                text,
                jump_to  AS jumpTo,
                action
         FROM message_options
         WHERE file_no = ? AND msg_id IN (${ph})
         ORDER BY msg_id, opt_index`,
      )
      .all(fileNo, ...msgIds) as Array<{
      msgId: number;
      idx: number;
      text: string | null;
      jumpTo: number | null;
      action: string | null;
    }>;

    const optsByMsg = new Map<number, MessageOption[]>();
    for (const o of optRows) {
      let arr = optsByMsg.get(o.msgId);
      if (!arr) {
        arr = [];
        optsByMsg.set(o.msgId, arr);
      }
      arr.push({ index: o.idx, text: o.text, jumpTo: o.jumpTo, action: o.action });
    }

    const rolesByMsg = new Map(list.map((l) => [l.msgId, l.roles]));

    const entries: MissionDialogueGroup["entries"] = msgRows
      .map((m): MessageNode & { roles: MissionMessageRole[] } => ({
        fileNo,
        msgId: m.msgId,
        speaker: m.speaker,
        text: m.text,
        options: optsByMsg.get(m.msgId) ?? [],
        jumpTo: m.jumpTo,
        roles: [...(rolesByMsg.get(m.msgId) ?? new Set<MissionMessageRole>())],
      }))
      .sort((a, b) => a.msgId - b.msgId);

    groups.push({ fileNo, entries });
  }

  return groups;
}

// 給除錯用：直接查單一 message（含 speaker、選項）
export function getMessageNode(
  fileNo: number,
  msgId: number,
): MessageNode | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT m.msg_id     AS msgId,
              m.msg        AS text,
              m.jump_to    AS jumpTo,
              ns.name      AS speaker
       FROM messages m
       LEFT JOIN npc_strings ns ON ns.id = m.name_id
       WHERE m.file_no = ? AND m.msg_id = ?`,
    )
    .get(fileNo, msgId) as
    | {
        msgId: number;
        text: string | null;
        jumpTo: number | null;
        speaker: string | null;
      }
    | undefined;
  if (!row) return null;

  const opts = db
    .prepare(
      `SELECT opt_index AS idx, text, jump_to AS jumpTo, action
       FROM message_options
       WHERE file_no = ? AND msg_id = ?
       ORDER BY opt_index`,
    )
    .all(fileNo, msgId) as Array<{
    idx: number;
    text: string | null;
    jumpTo: number | null;
    action: string | null;
  }>;

  return {
    fileNo,
    msgId: row.msgId,
    speaker: row.speaker,
    text: row.text,
    options: opts.map((o) => ({
      index: o.idx,
      text: o.text,
      jumpTo: o.jumpTo,
      action: o.action,
    })),
    jumpTo: row.jumpTo,
  };
}
