import { getDb } from "@/lib/db";
import { getItemIcon, getItemIconMap, type EntityImage } from "@/lib/queries/images";
import type {
  BoxContainingItem,
  ConditionKind,
  HeroTokenSource,
  ItemBoxGrant,
  ItemBoxOption,
  MissionCondition,
  MissionFlowStep,
  MissionLogic,
  MissionRequirementGroup,
  MissionRewardingItem,
  MissionTakingItem,
  MissionTimer,
  Reward,
  RewardResolved,
  RewardType,
} from "@/lib/types/mission-logic";

// =========================================================================
// 共用小工具
// =========================================================================

/** op → 條件粗分類。詳見 docs/msg-trigger-codes.md、上游 op_defs。 */
function conditionKind(op: number, a1: number | null): ConditionKind {
  if (op === 4) return "level";
  if (op === 7 || op === 8 || op === 9 || op === 10 || op === 55 || op === 56) return "stat";
  if (op === 73) return "charisma";
  if (op === 79) return "intimacy";
  if (op === 26) return "gold";
  if (op === 31) return "item";
  if (op === 2) return "faction";
  if (op === 3) return "gender";
  if (op === 34) return "skill";
  if (op === 28 && a1 === 15) return "prereq";
  return "other";
}

// =========================================================================
// getMissionLogic
// =========================================================================

interface EventRow {
  event: string;
  step: number | null;
  minutes: number | null;
  npcName: string | null;
  msgId: number;
}

function getEventRows(missionId: number): EventRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT e.event, e.step, e.minutes, e.msg_id AS msgId,
              ns.name AS npcName
       FROM mission_events e
       LEFT JOIN npc_strings ns ON ns.id = e.npc_name_id
       WHERE e.mission_id = ? AND e.is_mission = 1 AND e.is_gm = 0
       ORDER BY e.file_no, e.msg_id`,
    )
    .all(missionId) as EventRow[];
}

interface RequirementRow {
  msgId: number;
  triggerIdx: number;
  mode: 0 | 1;
  seq: number;
  op: number;
  negated: number;
  a0: number | null;
  a1: number | null;
  a2: number | null;
  a3: number | null;
  a4: number | null;
  summary: string;
  rejectMsgId: number | null;
}

function getRequirementRows(missionId: number): RequirementRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT msg_id AS msgId, trigger_idx AS triggerIdx, mode, seq, op, negated,
              a0, a1, a2, a3, a4, summary, reject_msg_id AS rejectMsgId
       FROM mission_requirements
       WHERE mission_id = ? AND is_mission = 1 AND is_gm = 0
       ORDER BY msg_id, trigger_idx, seq`,
    )
    .all(missionId) as RequirementRow[];
}

/** op_defs(kind='C') confidence 表，短小直接全撈快取查詢即可。 */
function getConditionOpConfidence(): Map<number, string> {
  const db = getDb();
  const rows = db
    .prepare(`SELECT op, confidence FROM op_defs WHERE kind = 'C'`)
    .all() as Array<{ op: number; confidence: string }>;
  return new Map(rows.map((r) => [r.op, r.confidence]));
}

/** reject_msg_id 對 messages.msg_id 全域唯一（無跨檔重複），不用帶 file_no。 */
function getRejectTexts(rejectMsgIds: number[]): Map<number, string> {
  const result = new Map<number, string>();
  if (rejectMsgIds.length === 0) return result;
  const db = getDb();
  const unique = [...new Set(rejectMsgIds)];
  const ph = unique.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT msg_id AS msgId, msg FROM messages WHERE msg_id IN (${ph}) AND msg IS NOT NULL`)
    .all(...unique) as Array<{ msgId: number; msg: string }>;
  for (const r of rows) result.set(r.msgId, r.msg);
  return result;
}

function buildRequirementGroups(missionId: number): MissionRequirementGroup[] {
  const rows = getRequirementRows(missionId);
  if (rows.length === 0) return [];

  const opConfidence = getConditionOpConfidence();
  const rejectTexts = getRejectTexts(
    rows.map((r) => r.rejectMsgId).filter((id): id is number => id !== null),
  );

  const itemIds = [...new Set(rows.filter((r) => r.op === 31 && r.a0 != null).map((r) => r.a0 as number))];
  const itemNames = getItemNames(itemIds);

  const missionIds = [
    ...new Set(rows.filter((r) => r.op === 28 && r.a1 === 15 && r.a0 != null).map((r) => r.a0 as number)),
  ];
  const missionNames = getMissionNames(missionIds);

  const skillCodes = [...new Set(rows.filter((r) => r.op === 34 && r.a0 != null).map((r) => r.a0 as number))];
  const skillNames = getSkillNamesByCode(skillCodes);

  const groups = new Map<string, MissionRequirementGroup>();
  for (const r of rows) {
    const key = `${r.msgId}:${r.triggerIdx}`;
    let group = groups.get(key);
    if (!group) {
      group = { msgId: r.msgId, triggerIdx: r.triggerIdx, mode: r.mode, conditions: [] };
      groups.set(key, group);
    }

    const kind = conditionKind(r.op, r.a1);
    const summaryEndsWithDegree = r.summary.endsWith("°") || r.summary.endsWith("°]");
    const summary = summaryEndsWithDegree
      ? r.summary.replace(/°(\])?$/, "$1")
      : r.summary;
    const likely = summaryEndsWithDegree || opConfidence.get(r.op) !== "confirmed";

    let item: MissionCondition["item"] = null;
    if (kind === "item" && r.a0 != null && r.a1 != null) {
      const name = itemNames.get(r.a0);
      if (name) {
        item = { itemId: r.a0, itemName: name, qty: r.a1, icon: getItemIcon(r.a0) };
      }
    }

    let skill: MissionCondition["skill"] = null;
    if (kind === "skill" && r.a0 != null) {
      const magicId = Math.floor(r.a0 / 100);
      const level = r.a0 % 100;
      skill = { magicId, level, magicName: skillNames.get(r.a0) ?? null };
    }

    let prereq: MissionCondition["prereq"] = null;
    if (kind === "prereq" && r.a0 != null) {
      prereq = { missionId: r.a0, missionName: missionNames.get(r.a0) ?? null };
    }

    group.conditions.push({
      op: r.op,
      negated: r.negated === 1,
      a0: r.a0,
      a1: r.a1,
      a2: r.a2,
      a3: r.a3,
      a4: r.a4,
      summary,
      likely,
      kind,
      rejectText: r.rejectMsgId != null ? (rejectTexts.get(r.rejectMsgId) ?? null) : null,
      item,
      skill,
      prereq,
    });
  }

  return [...groups.values()];
}

function getItemNames(ids: number[]): Map<number, string> {
  const map = new Map<number, string>();
  if (ids.length === 0) return map;
  const db = getDb();
  const ph = ids.map(() => "?").join(",");
  const rows = db.prepare(`SELECT id, name FROM items WHERE id IN (${ph})`).all(...ids) as Array<{
    id: number;
    name: string;
  }>;
  for (const r of rows) map.set(r.id, r.name);
  return map;
}

function getMissionNames(ids: number[]): Map<number, string> {
  const map = new Map<number, string>();
  if (ids.length === 0) return map;
  const db = getDb();
  const ph = ids.map(() => "?").join(",");
  const rows = db.prepare(`SELECT id, name FROM missions WHERE id IN (${ph})`).all(...ids) as Array<{
    id: number;
    name: string | null;
  }>;
  for (const r of rows) if (r.name) map.set(r.id, r.name);
  return map;
}

/** skillCode = magic.id*100+level，逐碼拆開查 (id, level) 再組回 Map<skillCode, name>。 */
function getSkillNamesByCode(skillCodes: number[]): Map<number, string> {
  const map = new Map<number, string>();
  if (skillCodes.length === 0) return map;
  const db = getDb();
  for (const code of skillCodes) {
    const magicId = Math.floor(code / 100);
    const level = code % 100;
    const row = db
      .prepare(`SELECT name FROM magic WHERE id = ? AND level = ?`)
      .get(magicId, level) as { name: string } | undefined;
    if (row) map.set(code, row.name);
  }
  return map;
}

/** getMissionLogic 主查詢：接取/完成、限時、接取條件、流程、獎勵、交付。 */
export function getMissionLogic(missionId: number): MissionLogic {
  const eventRows = getEventRows(missionId);

  const acceptNpcs = [
    ...new Set(eventRows.filter((r) => r.event === "accept" && r.npcName).map((r) => r.npcName as string)),
  ];
  const completeNpcs = [
    ...new Set(eventRows.filter((r) => r.event === "complete" && r.npcName).map((r) => r.npcName as string)),
  ];
  const timers: MissionTimer[] = [
    ...new Set(
      eventRows
        .filter((r) => (r.event === "timer35" || r.event === "timer36") && r.minutes != null && r.minutes > 0)
        .map((r) => r.minutes as number),
    ),
  ].map((minutes) => ({ minutes }));

  // flow：對每個相關 msgId 一次撈訊息原文（保留 FONT 標記，截斷交給 <GameText maxChars>）
  const flowMsgIds = [
    ...new Set(
      eventRows
        .filter((r) => r.event === "accept" || r.event === "step_done" || r.event === "complete")
        .map((r) => r.msgId),
    ),
  ];
  const dialogueByMsgId = getMessageTexts(flowMsgIds);

  const byStep = new Map<number, { npcs: Set<string>; dialogue: string | null }>();
  const ensure = (step: number) => {
    let entry = byStep.get(step);
    if (!entry) {
      entry = { npcs: new Set(), dialogue: null };
      byStep.set(step, entry);
    }
    return entry;
  };
  for (const r of eventRows) {
    if (r.event !== "accept" && r.event !== "step_done" && r.event !== "complete") continue;
    const step = r.event === "accept" ? 0 : (r.step ?? 0);
    const entry = ensure(step);
    if (r.npcName) entry.npcs.add(r.npcName);
    if (entry.dialogue === null) {
      const text = dialogueByMsgId.get(r.msgId);
      if (text) entry.dialogue = text;
    }
  }
  const flow: MissionFlowStep[] = [...byStep.entries()]
    .sort(([a], [b]) => a - b)
    .map(([step, entry]) => ({ step, npcs: [...entry.npcs], dialogue: entry.dialogue }));

  const requirementGroups = buildRequirementGroups(missionId);

  const rewardRows = getMissionRewardRows(missionId);
  const rewards: Reward[] = [];
  const deliveries: Reward[] = [];
  const DELIVERY_TYPES = new Set<RewardType>(["take_item", "pay_gold", "pay_charisma"]);
  const seen = new Set<string>();
  for (const row of rewardRows) {
    const key = `${row.rewardType}:${row.refId}:${row.qty}:${row.durationMin}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const reward = resolveReward(row.rewardType as RewardType, row.refId, row.qty, row.durationMin);
    if (DELIVERY_TYPES.has(reward.type)) deliveries.push(reward);
    else rewards.push(reward);
  }

  const npcImages = Object.fromEntries(
    getNpcImagesByName([...acceptNpcs, ...completeNpcs, ...flow.flatMap((f) => f.npcs)]),
  );

  return { acceptNpcs, completeNpcs, timers, requirementGroups, flow, rewards, deliveries, npcImages };
}

/**
 * NPC 名稱 → 立繪。npc_strings 與 npc 沒有 FK，只能用名字對；同名多筆 npc 時取有圖、id 最小的一筆。
 * 回傳的 Map 對每個傳入名字都有 key，查無圖為 null。一次查詢。
 * ponytail: 名字 < 數十個，不分塊；若拿來撈全表再改用 images.ts 的 chunk。
 */
export function getNpcImagesByName(names: string[]): Map<string, EntityImage | null> {
  const unique = [...new Set(names)];
  const map = new Map<string, EntityImage | null>(unique.map((n) => [n, null]));
  if (unique.length === 0) return map;
  const ph = unique.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `SELECT n.name, i.url, i.width, i.height
       FROM npc n JOIN npc_images i ON i.npc_id = n.id
       WHERE n.name IN (${ph})
       ORDER BY n.id`,
    )
    .all(...unique) as Array<{ name: string } & EntityImage>;
  for (const r of rows) {
    if (map.get(r.name) == null) map.set(r.name, { url: r.url, width: r.width, height: r.height });
  }
  return map;
}

function getMessageTexts(msgIds: number[]): Map<number, string> {
  const map = new Map<number, string>();
  if (msgIds.length === 0) return map;
  const db = getDb();
  const ph = msgIds.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT msg_id AS msgId, msg FROM messages WHERE msg_id IN (${ph}) AND msg IS NOT NULL`)
    .all(...msgIds) as Array<{ msgId: number; msg: string }>;
  for (const r of rows) map.set(r.msgId, r.msg);
  return map;
}

interface RewardRow {
  rewardType: string;
  refId: number | null;
  qty: number | null;
  durationMin: number | null;
}

function getMissionRewardRows(missionId: number): RewardRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT reward_type AS rewardType, ref_id AS refId, qty, duration_min AS durationMin
       FROM mission_rewards
       WHERE mission_id = ? AND is_mission = 1 AND is_gm = 0`,
    )
    .all(missionId) as RewardRow[];
}

/** 單筆 reward 依 type 補上顯示用的連結資料（道具名+icon／英雄名／技能名）。 */
function resolveReward(
  type: RewardType,
  refId: number | null,
  qty: number | null,
  durationMin: number | null,
): Reward {
  const resolved: RewardResolved = {};

  if ((type === "item" || type === "timed_item" || type === "take_item") && refId != null) {
    const db = getDb();
    const row = db.prepare(`SELECT name FROM items WHERE id = ?`).get(refId) as
      | { name: string }
      | undefined;
    if (row) resolved.itemName = row.name;
    resolved.itemIcon = getItemIcon(refId);
  } else if (type === "hero_token" && refId != null) {
    const db = getDb();
    const code = db
      .prepare(`SELECT hero_id AS heroId, name FROM hero_codes WHERE id = ?`)
      .get(refId) as { heroId: number | null; name: string } | undefined;
    if (code?.heroId != null) {
      resolved.heroId = code.heroId;
      const hero = db.prepare(`SELECT name FROM hero WHERE id = ?`).get(code.heroId) as
        | { name: string }
        | undefined;
      resolved.heroName = hero?.name ?? code.name;
    } else if (code) {
      resolved.heroName = code.name;
    }
  } else if (type === "skill" && refId != null) {
    const magicId = Math.floor(refId / 100);
    const level = refId % 100;
    resolved.magicId = magicId;
    resolved.level = level;
    const db = getDb();
    const row = db
      .prepare(`SELECT name FROM magic WHERE id = ? AND level = ?`)
      .get(magicId, level) as { name: string } | undefined;
    resolved.magicName = row?.name ?? null;
  }

  return { type, refId, qty, durationMin, resolved };
}

// =========================================================================
// item_box_rewards（道具開箱結果）—— 後續 phase 用，先提供小巧查詢
// =========================================================================

interface BoxRewardRow {
  grantMsgId: number;
  grantTriggerIdx: number;
  choicePath: string | null;
  rewardType: string;
  refId: number | null;
  qty: number | null;
  durationMin: number | null;
}

/** 使用道具 itemId 後，依 (grant_msg_id, grant_trigger_idx) 分組的每一種開箱結果。 */
export function getItemBoxRewards(itemId: number): ItemBoxGrant[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT grant_msg_id AS grantMsgId, grant_trigger_idx AS grantTriggerIdx, choice_path AS choicePath,
              reward_type AS rewardType, ref_id AS refId, qty, duration_min AS durationMin
       FROM item_box_rewards
       WHERE box_item_id = ? AND is_gm = 0
       ORDER BY grant_msg_id, grant_trigger_idx`,
    )
    .all(itemId) as BoxRewardRow[];

  const groups = new Map<string, ItemBoxGrant>();
  for (const r of rows) {
    const key = `${r.grantMsgId}:${r.grantTriggerIdx}`;
    let group = groups.get(key);
    if (!group) {
      group = { choicePath: r.choicePath, rewards: [] };
      groups.set(key, group);
    }
    group.rewards.push(resolveReward(r.rewardType as RewardType, r.refId, r.qty, r.durationMin));
  }
  return [...groups.values()];
}

/** 在 ids 中，哪些本身是可開啟的禮盒（item_box_rewards 有其內容）。一次查詢。 */
export function getBoxItemIds(ids: number[]): Set<number> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Set();
  const db = getDb();
  const ph = unique.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT DISTINCT box_item_id AS id FROM item_box_rewards WHERE is_gm = 0 AND box_item_id IN (${ph})`)
    .all(...unique) as Array<{ id: number }>;
  return new Set(rows.map((r) => r.id));
}

const isItemReward = (r: Reward) => (r.type === "item" || r.type === "timed_item") && r.refId != null;

/**
 * 道具頁「使用後可獲得」：getItemBoxRewards 再整理成選項，並展開巢狀禮盒。
 * - 同 choicePath 的 grant 合併（上游同一選項常拆成多個 trigger）；null choicePath 各自一組。
 * - 同一選項內相同獎勵（type/ref/duration）數量加總（上游常以多次 ×1 給同一道具）。
 * - 巢狀：maxDepth 層（含本層）＋祖先集合防循環；超出或循環時 contents = null。
 */
export function getItemBoxContents(itemId: number, maxDepth = 3): ItemBoxOption[] {
  return buildBoxOptions(itemId, 1, maxDepth, new Set([itemId]));
}

function buildBoxOptions(itemId: number, depth: number, maxDepth: number, ancestors: Set<number>): ItemBoxOption[] {
  const options: ItemBoxOption[] = [];
  const byPath = new Map<string, ItemBoxOption>();
  for (const g of getItemBoxRewards(itemId)) {
    let opt = g.choicePath != null ? byPath.get(g.choicePath) : undefined;
    if (!opt) {
      opt = { choicePath: g.choicePath, rewards: [] };
      options.push(opt);
      if (g.choicePath != null) byPath.set(g.choicePath, opt);
    }
    for (const r of g.rewards) {
      const same = opt.rewards.find(
        (x) => x.type === r.type && x.refId === r.refId && x.durationMin === r.durationMin && r.refId != null,
      );
      if (same && same.qty != null && r.qty != null) same.qty += r.qty;
      else opt.rewards.push({ ...r, contents: null });
    }
  }

  if (depth >= maxDepth) return options;
  const all = options.flatMap((o) => o.rewards).filter(isItemReward);
  const boxes = getBoxItemIds(all.map((r) => r.refId as number));
  for (const r of all) {
    const id = r.refId as number;
    if (!boxes.has(id) || ancestors.has(id)) continue;
    r.contents = buildBoxOptions(id, depth + 1, maxDepth, new Set([...ancestors, id]));
  }
  return options;
}

/** 反查：哪些禮盒含此道具（item/timed_item 類獎勵）？（道具頁用；同禮盒多個選項各一列） */
export function getBoxesContainingItem(itemId: number): BoxContainingItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT box.id AS boxItemId, box.name AS boxItemName,
              ibr.qty, ibr.duration_min AS durationMin, ibr.choice_path AS choicePath
       FROM item_box_rewards ibr
       JOIN items box ON box.id = ibr.box_item_id
       WHERE ibr.is_gm = 0 AND ibr.reward_type IN ('item', 'timed_item') AND ibr.ref_id = ?
       ORDER BY box.id`,
    )
    .all(itemId) as Omit<BoxContainingItem, "boxIcon">[];
  const icons = getItemIconMap(rows.map((r) => r.boxItemId));
  return rows.map((r) => ({ ...r, boxIcon: icons.get(r.boxItemId) ?? null }));
}

/** 反查：哪些任務把此道具當獎勵（item/timed_item）？（道具頁用） */
export function getMissionsRewardingItem(itemId: number): MissionRewardingItem[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT DISTINCT mr.mission_id AS missionId, m.name AS missionName,
              mr.qty, mr.duration_min AS durationMin
       FROM mission_rewards mr
       JOIN missions m ON m.id = mr.mission_id
       WHERE mr.is_mission = 1 AND mr.is_gm = 0
         AND mr.reward_type IN ('item', 'timed_item') AND mr.ref_id = ?
       ORDER BY mr.mission_id`,
    )
    .all(itemId) as MissionRewardingItem[];
}

/** 反查：哪些任務會收走此道具（take_item）？（道具頁用） */
export function getMissionsTakingItem(itemId: number): MissionTakingItem[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT DISTINCT mr.mission_id AS missionId, m.name AS missionName, mr.qty
       FROM mission_rewards mr
       JOIN missions m ON m.id = mr.mission_id
       WHERE mr.is_mission = 1 AND mr.is_gm = 0
         AND mr.reward_type = 'take_item' AND mr.ref_id = ?
       ORDER BY mr.mission_id`,
    )
    .all(itemId) as MissionTakingItem[];
}

/** 英雄符令來源：禮盒（item_box_rewards.hero_token）＋任務獎勵（mission_rewards.hero_token）。 */
export function getHeroTokenSources(heroId: number): HeroTokenSource[] {
  const db = getDb();
  const codeRows = db.prepare(`SELECT id FROM hero_codes WHERE hero_id = ?`).all(heroId) as Array<{
    id: number;
  }>;
  if (codeRows.length === 0) return [];
  const codeIds = codeRows.map((r) => r.id);
  const ph = codeIds.map(() => "?").join(",");

  const boxRows = db
    .prepare(
      `SELECT box.id AS id, box.name AS name, ibr.qty, ibr.choice_path AS choicePath
       FROM item_box_rewards ibr
       JOIN items box ON box.id = ibr.box_item_id
       WHERE ibr.is_gm = 0 AND ibr.reward_type = 'hero_token' AND ibr.ref_id IN (${ph})
       ORDER BY box.id`,
    )
    .all(...codeIds) as Array<{ id: number; name: string | null; qty: number | null; choicePath: string | null }>;

  const missionRows = db
    .prepare(
      `SELECT m.id AS id, m.name AS name, mr.qty
       FROM mission_rewards mr
       JOIN missions m ON m.id = mr.mission_id
       WHERE mr.is_mission = 1 AND mr.is_gm = 0 AND mr.reward_type = 'hero_token' AND mr.ref_id IN (${ph})
       ORDER BY m.id`,
    )
    .all(...codeIds) as Array<{ id: number; name: string | null; qty: number | null }>;

  return [
    ...boxRows.map((r): HeroTokenSource => ({ kind: "box", id: r.id, name: r.name, qty: r.qty, choicePath: r.choicePath })),
    ...missionRows.map((r): HeroTokenSource => ({ kind: "mission", id: r.id, name: r.name, qty: r.qty, choicePath: null })),
  ];
}
