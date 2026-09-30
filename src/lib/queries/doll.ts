import { getDb } from "@/lib/db";

export type DollGender = "m" | "f";
export type DollSlot = "head" | "cap" | "body" | "foot" | "wing" | "right";
export type DollEquipSlot = "cap" | "body" | "foot" | "wing";
export const DOLL_EQUIP_SLOTS: DollEquipSlot[] = ["cap", "body", "foot", "wing"];

export interface DollRule {
  slot: DollSlot;
  dir: number;
  mirrorOf: number | null;
  zOrder: number;
  offsetX: number;
  offsetY: number;
}

export interface DollFrame {
  slot: DollSlot;
  sequence: number;
  dir: number;
  url: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

export interface DollHead {
  sequence: number;
  label: string;
}

export interface DollCatalogItem {
  itemId: number;
  name: string;
  sequence: number;
  hasImage: boolean;
}

export interface DollPart {
  slot: DollSlot;
  sequence: number;
}

export interface ItemDoll {
  gender: DollGender;
  slot: DollSlot;
  sequence: number;
  hasImage: boolean;
}

const DOLL_SLOTS: DollSlot[] = ["head", "cap", "body", "foot", "wing", "right"];
// 每塊最多 900 個 sequence，另留 gender / slot 的參數餘裕。
const CHUNK_SIZE = 900;

function isGender(gender: unknown): gender is DollGender {
  return gender === "m" || gender === "f";
}

function isSlot(slot: unknown): slot is DollSlot {
  return DOLL_SLOTS.some((value) => value === slot);
}

export function getDollRules(): DollRule[] {
  return getDb()
    .prepare(
      `SELECT slot, dir, mirror_of AS mirrorOf, z_order AS zOrder,
              offset_x AS offsetX, offset_y AS offsetY
       FROM doll_slot_rules ORDER BY dir, z_order, slot`,
    )
    .all() as DollRule[];
}

export function getDollHeads(gender: DollGender): DollHead[] {
  if (!isGender(gender)) return [];
  const rows = getDb()
    .prepare(
      `SELECT p.sequence FROM doll_parts p
       WHERE p.gender = ? AND p.slot = 'head'
         AND EXISTS (
           SELECT 1 FROM doll_frame_images f
           WHERE f.gender = p.gender AND f.slot = p.slot
             AND f.sequence = p.sequence AND f.action = 'wait'
         )
       ORDER BY p.sequence`,
    )
    .all(gender) as { sequence: number }[];
  return rows.map((row, index) => ({
    sequence: row.sequence,
    label: `頭型 ${index + 1}`,
  }));
}

export function getDollCatalog(
  gender: DollGender,
): Record<DollEquipSlot, DollCatalogItem[]> {
  const catalog: Record<DollEquipSlot, DollCatalogItem[]> = {
    cap: [],
    body: [],
    foot: [],
    wing: [],
  };
  if (!isGender(gender)) return catalog;
  const rows = getDb()
    .prepare(
      `SELECT d.slot, d.item_id AS itemId, i.name, d.sequence,
              EXISTS (
                SELECT 1 FROM doll_frame_images f
                WHERE f.gender = d.gender AND f.slot = d.slot
                  AND f.sequence = d.sequence AND f.action = 'wait'
              ) AS hasImage
       FROM item_doll d JOIN items i ON i.id = d.item_id
       WHERE d.gender = ? AND d.has_part = 1 AND d.slot IN (?, ?, ?, ?)
       ORDER BY hasImage DESC, i.id`,
    )
    .all(gender, ...DOLL_EQUIP_SLOTS) as (Omit<DollCatalogItem, "hasImage"> & {
      slot: DollEquipSlot;
      hasImage: number;
    })[];
  for (const { slot, ...row } of rows) {
    catalog[slot].push({ ...row, hasImage: Boolean(row.hasImage) });
  }
  return catalog;
}

export function getDollFrames(gender: DollGender, parts: DollPart[]): DollFrame[] {
  if (!isGender(gender) || parts.length === 0) return [];
  const valid = parts.filter(
    (part) =>
      part && isSlot(part.slot) && Number.isSafeInteger(part.sequence) && part.sequence > 0,
  );
  if (valid.length === 0) return [];
  const db = getDb();
  const frames: DollFrame[] = [];
  for (const slot of DOLL_SLOTS) {
    const sequences = [
      ...new Set(valid.filter((part) => part.slot === slot).map((part) => part.sequence)),
    ];
    for (let i = 0; i < sequences.length; i += CHUNK_SIZE) {
      const chunk = sequences.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => "?").join(",");
      frames.push(
        ...(db
          .prepare(
            `SELECT slot, sequence, dir, url, width, height,
                  anchor_x AS anchorX, anchor_y AS anchorY
           FROM doll_frame_images
           WHERE gender = ? AND slot = ? AND action = 'wait'
             AND sequence IN (${placeholders})
           ORDER BY sequence, dir`,
          )
          .all(gender, slot, ...chunk) as DollFrame[]),
      );
    }
  }
  return frames;
}

export function getItemDoll(itemId: number): ItemDoll[] {
  if (!Number.isSafeInteger(itemId) || itemId <= 0) return [];
  const rows = getDb()
    .prepare(
      `SELECT d.gender, d.slot, d.sequence,
              (d.has_part = 1 AND EXISTS (
                SELECT 1 FROM doll_frame_images f
                WHERE f.gender = d.gender AND f.slot = d.slot
                  AND f.sequence = d.sequence AND f.action = 'wait'
              )) AS hasImage
       FROM item_doll d WHERE d.item_id = ? ORDER BY d.gender, d.slot`,
    )
    .all(itemId) as (Omit<ItemDoll, "hasImage"> & { hasImage: number })[];
  return rows
    .filter((row) => isGender(row.gender) && isSlot(row.slot))
    .map((row) => ({ ...row, hasImage: Boolean(row.hasImage) }));
}

export function getDefaultDollOutfit(
  gender: DollGender,
): { head: number; body: number | null; foot: number | null } {
  const head = getDollHeads(gender)[0]?.sequence ?? 0;
  const hasImage = (itemId: number, slot: DollSlot) =>
    getItemDoll(itemId).some(
      (part) => part.gender === gender && part.slot === slot && part.hasImage,
    );
  // 青錦布甲只有男版圖，女版改用同級的藍錦布甲；藍布鞋男女都有。
  const bodyId = gender === "f" ? 21047 : 21045;
  return {
    head,
    body: isGender(gender) && hasImage(bodyId, "body") ? bodyId : null,
    foot: isGender(gender) && hasImage(21131, "foot") ? 21131 : null,
  };
}
