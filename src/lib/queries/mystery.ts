import { getDb } from "@/lib/db";
import { getItemIconMap } from "@/lib/queries/images";
import type { MysteryBoxContents, MysteryBoxInfo, MysteryEntry, MysterySource } from "@/lib/types/mystery";

const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(",");

interface InfoRow {
  boxItemId: number;
  boxName: string | null;
  mysteryId: number | null;
  hasData: number;
  minDrop: number | null;
  maxDrop: number | null;
  entries: number | null;
}

/** 批次查：ids 中哪些是隨機寶箱道具，回傳其寶箱表資訊。 */
export function getMysteryBoxInfoMap(itemIds: number[]): Map<number, MysteryBoxInfo> {
  const map = new Map<number, MysteryBoxInfo>();
  const ids = [...new Set(itemIds)];
  if (ids.length === 0) return map;
  const rows = getDb()
    .prepare(
      `SELECT box_item_id AS boxItemId, box_name AS boxName, mystery_id AS mysteryId, has_data AS hasData,
              min_drop AS minDrop, max_drop AS maxDrop, entries
       FROM v_item_mystery WHERE box_item_id IN (${placeholders(ids.length)})`,
    )
    .all(...ids) as InfoRow[];
  for (const r of rows) map.set(r.boxItemId, { ...r, hasData: r.hasData === 1 });
  return map;
}

export function getMysteryBoxInfo(itemId: number): MysteryBoxInfo | null {
  return getMysteryBoxInfoMap([itemId]).get(itemId) ?? null;
}

interface EntryRow {
  seq: number;
  rewardType: "item" | "hero_token";
  refId: number;
  qty: number;
  prob: number;
}

function getEntryRows(mysteryId: number): EntryRow[] {
  return getDb()
    .prepare(
      `SELECT seq, reward_type AS rewardType, ref_id AS refId, qty, prob
       FROM mystery_box_items WHERE mystery_id = ?
       ORDER BY prob DESC, seq`,
    )
    .all(mysteryId) as EntryRow[];
}

function getNameMap(ids: number[]): Map<number, string> {
  const map = new Map<number, string>();
  if (ids.length === 0) return map;
  const rows = getDb()
    .prepare(`SELECT id, name FROM items WHERE id IN (${placeholders(ids.length)})`)
    .all(...ids) as Array<{ id: number; name: string }>;
  for (const r of rows) map.set(r.id, r.name);
  return map;
}

/** 英雄代碼 → 英雄（hero_codes.hero_id → hero.name）；代碼不在 hero_codes 時不會出現在 Map。 */
function getHeroCodeMap(codes: number[]): Map<number, { heroId: number | null; heroName: string | null }> {
  const map = new Map<number, { heroId: number | null; heroName: string | null }>();
  if (codes.length === 0) return map;
  const rows = getDb()
    .prepare(
      `SELECT hc.id AS code, hc.hero_id AS heroId, COALESCE(h.name, hc.name) AS heroName
       FROM hero_codes hc LEFT JOIN hero h ON h.id = hc.hero_id
       WHERE hc.id IN (${placeholders(codes.length)})`,
    )
    .all(...codes) as Array<{ code: number; heroId: number | null; heroName: string | null }>;
  for (const r of rows) map.set(r.code, { heroId: r.heroId, heroName: r.heroName });
  return map;
}

/**
 * 隨機寶箱道具的開箱內容；不是隨機寶箱時回傳 null。
 * 開出的道具也是寶箱時遞迴展開：最多 maxDepth 層（含本層），並以祖先寶箱表防迴圈
 * （例如 24059 紅包 → 27157 紅包）。
 */
export function getMysteryContents(itemId: number, maxDepth = 3): MysteryBoxContents | null {
  const info = getMysteryBoxInfo(itemId);
  if (!info) return null;
  return build(info, 1, maxDepth, new Set());
}

function build(info: MysteryBoxInfo, depth: number, maxDepth: number, ancestors: Set<number>): MysteryBoxContents {
  if (!info.hasData || info.mysteryId == null) return { info, entries: [] };
  const rows = getEntryRows(info.mysteryId);
  const itemIds = [...new Set(rows.filter((r) => r.rewardType === "item").map((r) => r.refId))];
  const heroCodes = [...new Set(rows.filter((r) => r.rewardType === "hero_token").map((r) => r.refId))];
  const names = getNameMap(itemIds);
  const icons = getItemIconMap(itemIds);
  const heroes = getHeroCodeMap(heroCodes);
  const boxes = depth < maxDepth ? getMysteryBoxInfoMap(itemIds) : new Map<number, MysteryBoxInfo>();
  const path = new Set(ancestors).add(info.mysteryId);

  const entries = rows.map((r): MysteryEntry => {
    const isItem = r.rewardType === "item";
    const hero = isItem ? undefined : heroes.get(r.refId);
    const box = isItem ? boxes.get(r.refId) : undefined;
    return {
      ...r,
      itemName: isItem ? (names.get(r.refId) ?? null) : null,
      itemIcon: isItem ? (icons.get(r.refId) ?? null) : null,
      heroId: hero?.heroId ?? null,
      heroName: hero?.heroName ?? null,
      contents:
        box && box.mysteryId != null && !path.has(box.mysteryId) ? build(box, depth + 1, maxDepth, path) : null,
    };
  });
  return { info, entries };
}

/**
 * 反查：哪些隨機寶箱道具會開出 itemId。一張表被多個寶箱道具共用時每個都列；
 * 同一寶箱多個 seq（數量不同）逐列回傳，由呈現端合併。依 prob 由高到低。
 */
export function getMysterySources(itemId: number): MysterySource[] {
  const rows = getDb()
    .prepare(
      `SELECT v.box_item_id AS boxItemId, v.box_name AS boxName, v.mystery_id AS mysteryId,
              m.seq, m.qty, m.prob
       FROM mystery_box_items m
       JOIN v_item_mystery v ON v.mystery_id = m.mystery_id
       WHERE m.reward_type = 'item' AND m.ref_id = ?
       ORDER BY m.prob DESC, v.box_item_id, m.seq`,
    )
    .all(itemId) as Omit<MysterySource, "boxIcon">[];
  const icons = getItemIconMap(rows.map((r) => r.boxItemId));
  return rows.map((r) => ({ ...r, boxIcon: icons.get(r.boxItemId) ?? null }));
}
