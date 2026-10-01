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
  attachTo: "root" | "body" | null;
  attachPoint: number | null;
}

export interface DollFrame {
  slot: DollSlot;
  sequence: number;
  action: "wait" | "prepare";
  color: number;
  dir: number;
  url: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  points: ([number, number] | null)[] | null;
}

export interface DollHead {
  sequence: number;
  label: string;
  itemId: number;
}

export interface DollHairColor {
  sequence: number;
  color: number;
  label: string;
  r: number;
  g: number;
  b: number;
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

export function getDollSlots(): DollSlotInfo[] {
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
              attach_to AS attachTo, attach_point AS attachPoint
       FROM doll_slot_rules ORDER BY dir, z_order, slot`,
    )
    .all() as DollRule[];
}

export function getDollHeads(gender: DollGender): DollHead[] {
  if (!isGender(gender)) return [];
  const rows = getDb()
    .prepare(
      `SELECT p.sequence, p.item_id AS itemId FROM item_doll p
       WHERE p.gender = ? AND p.slot = 'head' AND p.role = 'base'
         AND p.has_part = 1
         AND EXISTS (
           SELECT 1 FROM doll_frame_images f
           WHERE f.gender = p.gender AND f.slot = p.slot
             AND f.color = 0
             AND f.sequence = p.sequence AND f.action IN ('wait', 'prepare')
         )
       ORDER BY p.item_id`,
    )
    .all(gender) as { sequence: number; itemId: number }[];
  return rows.map((row, index) => ({
    sequence: row.sequence,
    itemId: row.itemId,
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

export function getDollHairColors(gender: DollGender): DollHairColor[] {
  if (!isGender(gender)) return [];
  return getDb().prepare(
    `SELECT sequence, color, label, r, g, b FROM doll_hair_colors
     WHERE gender = ? ORDER BY sequence, color`,
  ).all(gender) as DollHairColor[];
}

export function getDollLooks(gender: DollGender, slot: DollSlot): DollLook[] {
  if (!isGender(gender) || !isSlot(slot) || slot === "head") return [];
  // items.id 沒有索引；先掃 items，再查 item_doll 的主鍵，避免每個部位列重掃 items。
  const rows = getDb()
    .prepare(
      `SELECT d.slot, d.item_id AS itemId, i.name, d.sequence,
              d.role, d.equip_slot AS equipSlot,
              icon.url AS icon,
              EXISTS (
                SELECT 1 FROM doll_frame_images f
                WHERE f.gender = d.gender AND f.slot = d.slot
                  AND f.color = 0
                  AND f.sequence = d.sequence AND f.action IN ('wait', 'prepare')
              ) AS hasImage
       FROM items i CROSS JOIN item_doll d ON d.item_id = i.id
       LEFT JOIN item_images icon ON icon.item_id = d.item_id AND icon.kind = 'icon'
       WHERE d.gender = ? AND d.has_part = 1
         AND d.role IN ('main', 'pair', 'offhand') AND i.id IN (
         SELECT item_id FROM item_doll
         WHERE gender = ? AND slot = ? AND has_part = 1
           AND role = 'main'
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
     AND role = 'main' ORDER BY slot LIMIT 1`,
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
      const rows = db
        .prepare(
          `SELECT slot, sequence, action, color, dir, url, width, height,
                  anchor_x AS anchorX, anchor_y AS anchorY, points
           FROM doll_frame_images
           WHERE gender = ? AND slot = ? AND action IN ('wait', 'prepare')
             AND ${slot === "head" ? "color BETWEEN 0 AND 10" : "color = 0"}
             AND sequence IN (${placeholders})
           ORDER BY sequence, color, action, dir`,
        )
        .all(gender, slot, ...chunk) as (Omit<DollFrame, "points"> & { points: string | null })[];
      frames.push(...rows.map((row) => ({
        ...row,
        points: row.points === null ? null : JSON.parse(row.points) as DollFrame["points"],
      })));
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
                  AND f.color = 0
                  AND f.sequence = d.sequence AND f.action IN ('wait', 'prepare')
              )) AS hasImage
       FROM item_doll d WHERE d.item_id = ? ORDER BY d.gender, d.slot`,
    )
    .all(itemId) as (Omit<ItemDoll, "hasImage"> & { hasImage: number })[];
  return rows
    .filter((row) => isGender(row.gender) && isSlot(row.slot))
    .map((row) => ({ ...row, hasImage: Boolean(row.hasImage) }));
}

export function getDollBase(gender: DollGender): Partial<Record<DollSlot, DollPart>> {
  const base: Partial<Record<DollSlot, DollPart>> = {};
  if (!isGender(gender)) return base;
  const ids = gender === "m" ? [29101, 29201] : [29151, 29251];
  const rows = getDb().prepare(
    `SELECT d.slot, d.sequence FROM item_doll d
     WHERE d.gender = ? AND d.item_id IN (?, ?) AND d.role = 'base'
       AND d.slot IN ('body', 'foot') AND d.has_part = 1
       AND EXISTS (
         SELECT 1 FROM doll_frame_images f
         WHERE f.gender = d.gender AND f.slot = d.slot AND f.sequence = d.sequence
           AND f.color = 0
           AND f.action IN ('wait', 'prepare')
       ) ORDER BY d.item_id`,
  ).all(gender, ...ids) as DollPart[];
  for (const part of rows) base[part.slot] = part;
  return base;
}

export function getDollDefaults(
  gender: DollGender,
): { head: number; items: Partial<Record<DollSlot, number>> } {
  return { head: getDollHeads(gender)[0]?.sequence ?? 0, items: {} };
}
