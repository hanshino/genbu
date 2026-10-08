import { getDb } from "@/lib/db";
import { getItemIconMap } from "@/lib/queries/images";
import type { DialogueGrant, DialogueItem, MapDialogueSource, NpcDialogueSource } from "@/lib/types/dialogue-rewards";

// 上游 tthol_data GM_STAGES。is_gm 只標了地圖事件本身，從測試圖呼叫的對話（如 stage 385 TEST）沒標。
const GM_STAGE_IDS = "371, 385, 386, 901, 902, 903, 904, 920, 996, 999";

/** covered_by='mission' 也包含隱藏旗標；只剔除任務區真的會顯示的列。 */
export const DIALOGUE_REWARD_FILTER = `d.is_gm = 0
  AND COALESCE(d.stage_id, d.entry_stage_id, 0) NOT IN (${GM_STAGE_IDS})
  AND (d.covered_by IS NULL OR d.covered_by <> 'item_box')
  AND (d.covered_by IS NULL OR d.covered_by <> 'mission' OR NOT EXISTS (
    SELECT 1 FROM mission_rewards mr
    WHERE mr.is_mission = 1 AND mr.is_gm = 0
      AND mr.msg_id = d.msg_id AND mr.trigger_idx = d.trigger_idx
      AND mr.ref_id = d.ref_id AND mr.reward_type = d.reward_type
  ))`;

interface SourceRow {
  grantId: number;
  rewardType: string;
  qty: number | null;
  durationMin: number | null;
  srcKind: string;
  entryKind: string;
  npcNameId: number | null;
  npcName: string | null;
  npcId: number | null;
  stageKind: MapDialogueSource["stageKind"] | null;
  stageId: number | null;
  stageName: string | null;
  bind: string | null;
  monsterId: number | null;
  monsterName: string | null;
}

/** 同一群組先合併 grant，再折疊相同數量、期限、代價（用途另比較換得的道具）。 */
function addGrant(rewards: DialogueGrant[], grant: DialogueGrant, use: boolean) {
  const same = rewards.find((r) =>
    r.grantId === grant.grantId ||
    (r.qty === grant.qty && r.durationMin === grant.durationMin &&
      JSON.stringify(r.costItems) === JSON.stringify(grant.costItems) && r.costGold === grant.costGold &&
      (!use || JSON.stringify(r.returns) === JSON.stringify(grant.returns))),
  );
  if (!same) rewards.push({ ...grant, triggers: [...grant.triggers] });
  else for (const trigger of grant.triggers) {
    if (!same.triggers.some((t) => t.bind === trigger.bind && t.monsterId === trigger.monsterId)) {
      same.triggers.push(trigger);
    }
  }
}

/** 一次取齊道具頁的 NPC／地圖給予與兌換用途，代價及回報依 grant_id 取同組列。 */
export function getItemDialogueSources(itemId: number): {
  npcSources: NpcDialogueSource[];
  mapSources: MapDialogueSource[];
  exchangeUses: NpcDialogueSource[];
} {
  const db = getDb();
  // entry_stage_id 沒有 kind；目前 stages 的 id 跨 stage/sestage 唯一，與 /maps/[id] 相同。
  const rows = db.prepare(
    `SELECT DISTINCT d.grant_id AS grantId, d.reward_type AS rewardType,
            d.qty, d.duration_min AS durationMin, d.src_kind AS srcKind, d.entry_kind AS entryKind,
            d.npc_name_id AS npcNameId, ns.name AS npcName,
            (SELECT MIN(n.id) FROM v_npc_string_npcs v JOIN npc n ON n.id = v.npc_id
             WHERE v.name_id = d.npc_name_id AND n.is_npc = 1 AND n.is_monster = 0
               AND EXISTS (SELECT 1 FROM map_placements p WHERE p.npc_id = n.id
                           AND p.category = 'npc' AND p.in_bounds = 1)) AS npcId,
            s.kind AS stageKind, s.id AS stageId, s.name AS stageName,
            d.bind, m.id AS monsterId, m.name AS monsterName
     FROM dialogue_rewards d
     LEFT JOIN npc_strings ns ON ns.id = d.npc_name_id
     LEFT JOIN stages s ON
       (d.src_kind = 'map_event' AND s.kind = d.stage_kind AND s.id = d.stage_id)
       OR (d.src_kind = 'msg' AND d.npc_name_id IS NULL
           AND d.entry_kind LIKE '%map_event%' AND s.id = d.entry_stage_id)
     LEFT JOIN v_map_event_bindings b ON b.event_id = d.event_id AND d.bind = 'death' AND b.via = 'death'
     LEFT JOIN monsters m ON m.id = b.npc_id
     WHERE d.ref_id = ? AND d.reward_type IN ('item', 'timed_item', 'take_item')
       AND ${DIALOGUE_REWARD_FILTER}
     ORDER BY npcName, s.kind, s.id, d.grant_id, monsterId`,
  ).all(itemId) as SourceRow[];

  const npcSources = new Map<string, NpcDialogueSource>();
  const mapSources = new Map<string, MapDialogueSource>();
  const exchangeUses = new Map<string, NpcDialogueSource>();
  if (rows.length === 0) return { npcSources: [], mapSources: [], exchangeUses: [] };

  const grantIds = [...new Set(rows.map((r) => r.grantId))];
  const details = db.prepare(
    `SELECT d.grant_id AS grantId, d.reward_type AS rewardType, d.ref_id AS itemId,
            i.name AS itemName, d.qty, d.duration_min AS durationMin
     FROM dialogue_rewards d LEFT JOIN items i ON i.id = d.ref_id
     WHERE d.grant_id IN (${grantIds.map(() => "?").join(",")}) AND d.is_gm = 0
       AND d.reward_type IN ('item', 'timed_item', 'take_item', 'pay_gold')
     ORDER BY d.grant_id, d.reward_type, d.ref_id, d.duration_min, d.id`,
  ).all(...grantIds) as Array<Omit<DialogueItem, "icon"> & { grantId: number; rewardType: string }>;
  const icons = getItemIconMap(details.filter((d) => d.rewardType !== "pay_gold").map((d) => d.itemId));
  const grants = new Map<number, Pick<DialogueGrant, "costItems" | "costGold" | "returns">>();
  for (const d of details) {
    let grant = grants.get(d.grantId);
    if (!grant) {
      grant = { costItems: [], costGold: null, returns: [] };
      grants.set(d.grantId, grant);
    }
    if (d.rewardType === "pay_gold") grant.costGold = (grant.costGold ?? 0) + (d.qty ?? 0);
    else {
      const item = { itemId: d.itemId, itemName: d.itemName, qty: d.qty, durationMin: d.durationMin, icon: icons.get(d.itemId) ?? null };
      (d.rewardType === "take_item" ? grant.costItems : grant.returns).push(item);
    }
  }

  for (const r of rows) {
    const use = r.rewardType === "take_item";
    const grant: DialogueGrant = {
      grantId: r.grantId, qty: r.qty, durationMin: r.durationMin,
      ...grants.get(r.grantId)!,
      triggers: [{ bind: r.bind, monsterId: r.monsterId, monsterName: r.monsterName }],
    };
    if (r.srcKind === "msg" && (r.npcNameId != null || r.entryKind === "orphan")) {
      const orphan = r.npcNameId == null;
      const key = orphan ? "orphan" : `npc:${r.npcName ?? ""}`;
      const groups = use ? exchangeUses : npcSources;
      let group = groups.get(key);
      if (!group) {
        group = { npcName: r.npcName, npcId: r.npcId, orphan, rewards: [] };
        groups.set(key, group);
      }
      addGrant(group.rewards, grant, use);
    } else if (r.stageId != null && r.stageKind != null) {
      if (use) {
        const key = `map:${r.stageKind}:${r.stageId}`;
        let group = exchangeUses.get(key);
        if (!group) {
          group = { npcName: `地圖事件：${r.stageName ?? r.stageId}`, npcId: null, orphan: false, rewards: [] };
          exchangeUses.set(key, group);
        }
        addGrant(group.rewards, grant, true);
      } else {
        const key = `${r.stageKind}:${r.stageId}`;
        let group = mapSources.get(key);
        if (!group) {
          group = { stageKind: r.stageKind, stageId: r.stageId, stageName: r.stageName, rewards: [] };
          mapSources.set(key, group);
        }
        addGrant(group.rewards, grant, false);
      }
    }
  }
  return { npcSources: [...npcSources.values()], mapSources: [...mapSources.values()], exchangeUses: [...exchangeUses.values()] };
}
