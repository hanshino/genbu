import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { DIALOGUE_REWARD_FILTER, getItemDialogueSources } from "../dialogue-rewards";
import { getNpcDetail } from "../npcs";
import { summarizeSourceRoutes } from "@/components/items/item-section-group";

describe("道具頁：完整對話給予與兌換用途", () => {
  it("披風 21204：珍品商人以三種道具兌換，含 A66 兄弟 trigger 的代價", () => {
    const npc = getItemDialogueSources(21204).npcSources.find((n) => n.npcName === "珍品商人");
    const reward = npc?.rewards.find((r) => r.costItems.some((c) => c.itemId === 28332));
    expect(reward?.qty).toBe(1);
    expect(reward?.costItems.map((c) => [c.itemId, c.qty])).toEqual([[25002, 1], [26096, 50], [28332, 13]]);
    expect(reward?.costItems.every((c) => c.itemName)).toBe(true);
  });

  it("三生石 28581：covered_by=mission 但 is_mission=0 的擲杯聖者來源不消失", () => {
    const npc = getItemDialogueSources(28581).npcSources.find((n) => n.npcName === "擲杯聖者");
    expect(npc?.npcId).toBeNull();
    expect(npc?.rewards).toHaveLength(1);
    expect(npc?.rewards[0]).toMatchObject({ qty: 1, durationMin: null });
  });

  it("目前 DB 有 44 筆、26 種道具的隱藏旗標給予需要保留（非 46 筆）", () => {
    expect(getDb().prepare(
      `SELECT COUNT(*) AS rows, COUNT(DISTINCT d.ref_id) AS items FROM dialogue_rewards d
       WHERE d.covered_by = 'mission' AND d.reward_type IN ('item', 'timed_item')
         AND ${DIALOGUE_REWARD_FILTER}`,
    ).get()).toEqual({ rows: 44, items: 26 });
    expect(getDb().prepare(
      `SELECT d.is_gm, COUNT(*) AS n FROM dialogue_rewards d
       WHERE d.covered_by = 'mission' AND d.reward_type IN ('item', 'timed_item')
         AND EXISTS (SELECT 1 FROM mission_rewards mr WHERE mr.is_mission = 0
           AND mr.msg_id = d.msg_id AND mr.trigger_idx = d.trigger_idx
           AND mr.ref_id = d.ref_id AND mr.reward_type = d.reward_type)
       GROUP BY d.is_gm`,
    ).all()).toEqual([{ is_gm: 0, n: 44 }, { is_gm: 1, n: 2 }]);
  });

  it("真正任務／禮盒已涵蓋的列被剔除", () => {
    const db = getDb();
    const remaining = db.prepare(`SELECT COUNT(*) AS n FROM dialogue_rewards d
      WHERE ${DIALOGUE_REWARD_FILTER} AND (d.covered_by = 'item_box' OR EXISTS (
        SELECT 1 FROM mission_rewards mr WHERE d.covered_by = 'mission'
          AND mr.is_mission = 1 AND mr.is_gm = 0 AND mr.msg_id = d.msg_id
          AND mr.trigger_idx = d.trigger_idx AND mr.ref_id = d.ref_id AND mr.reward_type = d.reward_type
      ))`).get();
    expect(remaining).toEqual({ n: 0 });
  });

  it("印記 28332：列出印記商人與珍品商人的兌換用途及回報", () => {
    const uses = getItemDialogueSources(28332).exchangeUses;
    expect(uses.map((u) => u.npcName)).toEqual(expect.arrayContaining(["印記商人", "珍品商人"]));
    const cloak = uses.find((u) => u.npcName === "珍品商人")?.rewards.find((r) => r.returns.some((i) => i.itemId === 21204));
    expect(cloak?.qty).toBe(13);
    expect(cloak?.returns).toContainEqual(expect.objectContaining({ itemId: 21204, qty: 1 }));
  });

  it("赤玄謎寶箱 24200：玄謎窟盡頭區域觸發", () => {
    const map = getItemDialogueSources(24200).mapSources.find((s) => s.stageId === 317);
    expect(map).toMatchObject({ stageKind: "stage", stageName: "玄謎窟盡頭" });
    expect(map?.rewards[0]).toMatchObject({ qty: 1, triggers: [{ bind: "zone", monsterId: null, monsterName: null }] });
  });

  it("木人巷 24440：限時 3 分鐘，怪物死亡觸發", () => {
    const map = getItemDialogueSources(24440).mapSources.find((s) => s.stageId === 307);
    expect(map?.rewards).toContainEqual(expect.objectContaining({
      qty: 1, durationMin: 3, triggers: [{ bind: "death", monsterId: 8136, monsterName: "●金牌木頭人" }],
    }));
  });

  it("無 NPC 的 msg 給予依 entry_stage_id 歸入 sestage，跨 kind 的 id 唯一", () => {
    expect(getDb().prepare("SELECT id FROM stages GROUP BY id HAVING COUNT(*) > 1").all()).toEqual([]);
    const map = getItemDialogueSources(24091).mapSources.find((s) => s.stageId === 1501);
    expect(map).toMatchObject({ stageKind: "sestage", stageName: "愛的試煉場" });
    expect(map?.rewards).toHaveLength(1);
  });

  it("只有銀兩的兌換也帶出代價", () => {
    const npc = getItemDialogueSources(21302).npcSources.find((s) => s.npcName === "藏海村馬販子");
    expect(npc?.rewards).toContainEqual(expect.objectContaining({ costItems: [], costGold: 100000 }));
  });

  it("sestage 24496：依地圖、grant 去重，保留同一事件的三隻怪物", () => {
    const map = getItemDialogueSources(24496).mapSources.find((s) => s.stageId === 1901);
    expect(map?.stageKind).toBe("sestage");
    expect(map?.rewards).toHaveLength(1);
    expect(map?.rewards[0].triggers.map((t) => t.monsterId)).toEqual([13508, 13509, 13510]);
  });

  it("GM MSG39 專用道具 20045 不列為來源／用途", () => {
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM dialogue_rewards WHERE ref_id=20045 AND file_no=39 AND is_gm=1").get()).toEqual({ n: 1 });
    expect(getItemDialogueSources(20045)).toEqual({ npcSources: [], mapSources: [], exchangeUses: [] });
    expect(getItemDialogueSources(20001).mapSources).toEqual([]);
  });

  it("入口未明的無 NPC 對話仍顯示，僅有 orphan 時摘要也非空", () => {
    expect(getItemDialogueSources(22246).npcSources).toContainEqual(expect.objectContaining({ npcId: null, orphan: true }));
    expect(summarizeSourceRoutes({ drops: 0, shops: 0, compounds: 0, otherDialogues: true })).toBe("其他對話（入口未明）");
  });

  it("NPC 連結沿用詳情頁條件，查無道具回空", () => {
    const npc = getItemDialogueSources(28954).npcSources.find((n) => n.npcName === "掃地僧");
    expect(npc?.npcId).toBe(7060);
    expect(getNpcDetail(npc!.npcId!)?.name).toBe(npc?.npcName);
    expect(getItemDialogueSources(999999999)).toEqual({ npcSources: [], mapSources: [], exchangeUses: [] });
  });
});
