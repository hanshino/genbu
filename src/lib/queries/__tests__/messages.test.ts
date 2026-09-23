import { describe, expect, it } from "vitest";
import { getMissionDialogue } from "../messages";
import { getDb } from "@/lib/db";

describe("getMissionDialogue", () => {
  it("任務 801 有 complete 事件，且 step 涵蓋到 8", () => {
    const groups = getMissionDialogue(801);
    const allEvents = groups.flatMap((g) => g.entries.flatMap((e) => e.events));

    expect(allEvents.some((e) => e.event === "complete")).toBe(true);

    const steps = allEvents
      .map((e) => e.step)
      .filter((s): s is number => s !== null);
    expect(Math.max(...steps)).toBeGreaterThanOrEqual(8);
  });

  it("不會洩漏 is_gm=1 的事件（任務 1 在 msg 39026 有一筆 gm-only reset）", () => {
    const db = getDb();
    const gmRows = db
      .prepare(
        "SELECT file_no, msg_id FROM mission_events WHERE mission_id = 1 AND is_gm = 1",
      )
      .all() as Array<{ file_no: number; msg_id: number }>;
    expect(gmRows.length).toBeGreaterThan(0); // 前提：確實存在 gm-only 列可驗證過濾

    const groups = getMissionDialogue(1);
    const seenMsgIds = new Set(
      groups.flatMap((g) => g.entries.map((e) => `${g.fileNo}:${e.msgId}`)),
    );

    // 任務 1 的 gm-only 事件在 msg 39026（file_no=39），不應出現在任何 group
    // 的 entries 裡；同一 (file_no,msg_id) 沒有其他 is_gm=0 事件與之混在一起。
    for (const gm of gmRows) {
      expect(seenMsgIds.has(`${gm.file_no}:${gm.msg_id}`)).toBe(false);
    }
  });

  it("任務 1 的對話只包含 file_no=12（is_gm=0 事件全落在該檔）", () => {
    const groups = getMissionDialogue(1);
    expect(groups.map((g) => g.fileNo)).toEqual([12]);
  });
});
