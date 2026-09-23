import { getDb } from "@/lib/db";
import { getNpcImagesByName } from "@/lib/queries/mission-logic";
import type {
  MessageNode,
  MessageOption,
  MissionDialogueGroup,
  MissionEvent,
  MissionEventKind,
  TriggerOpTranslation,
} from "@/lib/types/message";

// =========================================================================
// Mission ↔ Message 對話查詢
//
// 語意來源已由上游 tthol_data repo 解析寫回：
//   - mission_events：每筆對話對某任務的語意事件（接取/設定進度/完成步驟/
//     整體完成/重置/計時器），已排除 is_gm。
//   - trigger_ops + op_defs：單筆 trigger 內每個 cond(C)/action(A) op 的
//     原始參數與中文釋義，供逐條列出人類可讀翻譯。
// 詳見 docs/msg-trigger-codes.md。
// =========================================================================

interface MissionEventRow {
  fileNo: number;
  msgId: number;
  event: MissionEventKind;
  step: number | null;
  minutes: number | null;
}

function getMissionEventRows(missionId: number): MissionEventRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT file_no AS fileNo, msg_id AS msgId, event, step, minutes
       FROM mission_events
       WHERE mission_id = ? AND is_mission = 1 AND is_gm = 0
       ORDER BY file_no, msg_id`,
    )
    .all(missionId) as MissionEventRow[];
}

interface OpDefRow {
  kind: "C" | "A";
  op: number;
  name_zh: string | null;
  args: string | null;
  confidence: string;
}

interface TriggerOpRow {
  msgId: number;
  kind: "C" | "A";
  op: number;
  seq: number;
  negated: number | null;
  a0: number | null;
  a1: number | null;
  a2: number | null;
  a3: number | null;
  a4: number | null;
}

function formatTriggerOp(row: TriggerOpRow, def: OpDefRow | undefined): TriggerOpTranslation {
  const args = [row.a0, row.a1, row.a2, row.a3, row.a4].filter(
    (a): a is number => a !== null && a !== undefined,
  );
  const name = def?.name_zh ?? `${row.kind}${row.op}`;
  const negatedPrefix = row.negated ? "非" : "";
  const label = args.length > 0 ? `${negatedPrefix}${name}(${args.join(", ")})` : `${negatedPrefix}${name}`;
  return {
    kind: row.kind,
    op: row.op,
    label,
    likely: def?.confidence !== "confirmed",
  };
}

function getTriggerOpsByMsg(
  fileNo: number,
  msgIds: number[],
): Map<number, TriggerOpTranslation[]> {
  const db = getDb();
  const ph = msgIds.map(() => "?").join(",");

  const rows = db
    .prepare(
      `SELECT t.msg_id AS msgId, t.kind, t.op, t.seq, t.negated,
              t.a0, t.a1, t.a2, t.a3, t.a4
       FROM trigger_ops t
       WHERE t.file_no = ? AND t.msg_id IN (${ph})
       ORDER BY t.msg_id, t.trigger_idx, t.kind, t.seq`,
    )
    .all(fileNo, ...msgIds) as TriggerOpRow[];

  if (rows.length === 0) return new Map();

  const defRows = db
    .prepare(`SELECT kind, op, name_zh, args, confidence FROM op_defs`)
    .all() as OpDefRow[];
  const defByKey = new Map(defRows.map((d) => [`${d.kind}${d.op}`, d]));

  const result = new Map<number, TriggerOpTranslation[]>();
  for (const r of rows) {
    const def = defByKey.get(`${r.kind}${r.op}`);
    let arr = result.get(r.msgId);
    if (!arr) {
      arr = [];
      result.set(r.msgId, arr);
    }
    arr.push(formatTriggerOp(r, def));
  }
  return result;
}

export function getMissionDialogue(missionId: number): MissionDialogueGroup[] {
  const eventRows = getMissionEventRows(missionId);
  if (eventRows.length === 0) return [];

  const db = getDb();

  // 依 file_no 分群，把同檔的 msg_id 一次撈
  const byFile = new Map<number, MissionEventRow[]>();
  for (const r of eventRows) {
    let arr = byFile.get(r.fileNo);
    if (!arr) {
      arr = [];
      byFile.set(r.fileNo, arr);
    }
    arr.push(r);
  }

  const groups: MissionDialogueGroup[] = [];

  for (const [fileNo, list] of [...byFile.entries()].sort(([a], [b]) => a - b)) {
    const msgIds = [...new Set(list.map((r) => r.msgId))];
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

    const eventsByMsg = new Map<number, MissionEvent[]>();
    for (const r of list) {
      let arr = eventsByMsg.get(r.msgId);
      if (!arr) {
        arr = [];
        eventsByMsg.set(r.msgId, arr);
      }
      arr.push({ event: r.event, step: r.step, minutes: r.minutes });
    }

    const triggerOpsByMsg = getTriggerOpsByMsg(fileNo, msgIds);

    const entries: MissionDialogueGroup["entries"] = msgRows
      .map((m) => ({
        fileNo,
        msgId: m.msgId,
        speaker: m.speaker,
        speakerImage: null,
        text: m.text,
        options: optsByMsg.get(m.msgId) ?? [],
        jumpTo: m.jumpTo,
        events: eventsByMsg.get(m.msgId) ?? [],
        triggerOps: triggerOpsByMsg.get(m.msgId) ?? [],
      }))
      .sort((a, b) => a.msgId - b.msgId);

    groups.push({ fileNo, entries });
  }

  // 說話者立繪：跨檔一次查
  const entries = groups.flatMap((g) => g.entries);
  const images = getNpcImagesByName(entries.flatMap((e) => (e.speaker ? [e.speaker] : [])));
  for (const e of entries) if (e.speaker) e.speakerImage = images.get(e.speaker) ?? null;

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
