import { getDb } from "@/lib/db";

export type DollGender = "m" | "f";
export type DollSlot =
  | "head" | "cap" | "body" | "foot" | "horse" | "wing"
  | "ornament1" | "ornament2" | "right" | "left";

export interface DollSlotInfo {
  slot: DollSlot;
  label: string;
  sortOrder: number;
  replaces: DollSlot | null;
}

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

export interface DollLookItem {
  itemId: number;
  name: string;
  isExtra: boolean;
}

export interface DollLook {
  key: string;
  slot: DollSlot;
  layers: DollPart[];
  offhandLayers: DollPart[] | null;
  icon: string | null;
  items: DollLookItem[];
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

const DOLL_SLOTS: DollSlot[] = [
  "head", "cap", "body", "foot", "horse", "wing",
  "ornament1", "ornament2", "right", "left",
];
// 每塊最多 900 個 sequence，另留 gender / slot 的參數餘裕。
const CHUNK_SIZE = 900;

function isGender(gender: unknown): gender is DollGender {
  return gender === "m" || gender === "f";
}

function isSlot(slot: unknown): slot is DollSlot {
  return DOLL_SLOTS.some((value) => value === slot);
}

// ponytail: 舊 schema 相容，新 DB 上線後刪除
let schema: { slots: boolean; roles: boolean } | undefined;
function getSchema() {
  if (!schema) {
    const db = getDb();
    schema = {
      slots: db.prepare("PRAGMA table_info(doll_slots)").all().length > 0,
      roles: (db.prepare("PRAGMA table_info(item_doll)").all() as { name: string }[])
        .some((column) => column.name === "role"),
    };
  }
  return schema;
}

export function getDollSlots(): DollSlotInfo[] {
  // ponytail: 舊 schema 相容，新 DB 上線後刪除
  if (!getSchema().slots) {
    return ([
      ["cap", "帽子"], ["body", "衣服"], ["foot", "褲子"],
      ["wing", "背飾"], ["right", "武器"],
    ] as const).map(([slot, label], index) => ({
      slot, label, sortOrder: index + 1, replaces: null,
    }));
  }
  return (getDb().prepare(
    `SELECT slot, label, sort_order AS sortOrder, replaces
     FROM doll_slots WHERE slot != 'head'
     ORDER BY sort_order, slot`,
  ).all() as DollSlotInfo[]).filter((row) => isSlot(row.slot));
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

interface LookRow extends DollPart {
  itemId: number;
  name: string;
  role: "main" | "pair" | "offhand";
  equipSlot: string | null;
  icon: string | null;
  hasImage: number;
}

export function getDollLooks(gender: DollGender, slot: DollSlot): DollLook[] {
  if (!isGender(gender) || !isSlot(slot) || slot === "head") return [];
  // ponytail: 舊 schema 相容，新 DB 上線後刪除
  const roles = getSchema().roles;
  const rows = getDb()
    .prepare(
      `SELECT d.slot, d.item_id AS itemId, i.name, d.sequence,
              ${roles ? "d.role" : "'main'"} AS role,
              ${roles ? "d.equip_slot" : "i.equip_slot"} AS equipSlot,
              icon.url AS icon,
              EXISTS (
                SELECT 1 FROM doll_frame_images f
                WHERE f.gender = d.gender AND f.slot = d.slot
                  AND f.sequence = d.sequence AND f.action = 'wait'
              ) AS hasImage
       FROM item_doll d JOIN items i ON i.id = d.item_id
       LEFT JOIN item_images icon ON icon.item_id = d.item_id AND icon.kind = 'icon'
       WHERE d.gender = ? AND d.has_part = 1 AND d.item_id IN (
         SELECT item_id FROM item_doll
         WHERE gender = ? AND slot = ? AND has_part = 1
           ${roles ? "AND role = 'main'" : ""}
       )
       ORDER BY i.id, d.slot, d.sequence`,
    )
    .all(gender, gender, slot) as LookRow[];
  const byItem = new Map<number, LookRow[]>();
  for (const row of rows) {
    if (!isSlot(row.slot)) continue;
    const item = byItem.get(row.itemId) ?? [];
    item.push(row);
    byItem.set(row.itemId, item);
  }
  const looks = new Map<string, DollLook>();
  const toPart = ({ slot, sequence }: LookRow): DollPart => ({ slot, sequence });
  const signature = (parts: DollPart[]) => parts.map((part) => `${part.slot}:${part.sequence}`).join("+");
  for (const itemRows of byItem.values()) {
    const main = itemRows.find((row) => row.role === "main" && row.slot === slot);
    if (!main) continue;
    const layerRows = [main, ...itemRows.filter((row) => row.role === "pair")];
    const layers = layerRows.map(toPart);
    const offhand = itemRows.filter((row) => row.role === "offhand").map(toPart);
    const key = signature(layers) + (offhand.length ? `|offhand:${signature(offhand)}` : "");
    let look = looks.get(key);
    if (!look) {
      look = {
        key, slot, layers, offhandLayers: offhand.length ? offhand : null,
        icon: null, items: [], hasImage: layerRows.every((row) => Boolean(row.hasImage)),
      };
      looks.set(key, look);
    }
    look.icon ??= main.icon;
    look.items.push({
      itemId: main.itemId, name: main.name, isExtra: main.equipSlot?.startsWith("EXTRA_") ?? false,
    });
  }
  return [...looks.values()].sort((a, b) =>
    Number(b.hasImage) - Number(a.hasImage) || b.items.length - a.items.length ||
    a.items[0].itemId - b.items[0].itemId,
  );
}

export function getDollLookByItem(gender: DollGender, itemId: number): DollLook | null {
  if (!isGender(gender) || !Number.isSafeInteger(itemId) || itemId <= 0) return null;
  const row = getDb().prepare(
    `SELECT slot FROM item_doll WHERE gender = ? AND item_id = ? AND has_part = 1
     ${getSchema().roles ? "AND role = 'main'" : ""} ORDER BY slot LIMIT 1`,
  ).get(gender, itemId) as { slot: DollSlot } | undefined;
  return row ? getDollLooks(gender, row.slot).find((look) =>
    look.items.some((item) => item.itemId === itemId),
  ) ?? null : null;
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

export function getDollDefaults(
  gender: DollGender,
): { head: number; items: Partial<Record<DollSlot, number>> } {
  const head = getDollHeads(gender)[0]?.sequence ?? 0;
  const items: Partial<Record<DollSlot, number>> = {};
  if (!isGender(gender)) return { head, items };
  const bodyId = gender === "f" ? 21047 : 21045;
  if (getDollLookByItem(gender, bodyId)?.hasImage) items.body = bodyId;
  if (getDollLookByItem(gender, 21131)?.hasImage) items.foot = 21131;
  return { head, items };
}
