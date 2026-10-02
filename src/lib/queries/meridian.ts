// 僅供 server 使用；client 的模擬邏輯在 lib/meridian-sim.ts。
import { getDb } from "@/lib/db";
import type {
  MeridianChannel, MeridianData, MeridianLevel, MeridianPoint, UiImage,
} from "@/lib/types/meridian";

let cached: MeridianData | undefined;

export function getMeridianData(): MeridianData {
  if (cached) return cached;
  const db = getDb();
  const points: MeridianPoint[] = (db.prepare(
    `SELECT mm.magic_id AS id, m.name, mm.channel_no AS channelNo,
            mm.max_level AS maxLevel, mm.is_root AS isRoot, mm.slot,
            mm.btn_x AS btnX, mm.btn_y AS btnY
     FROM magic_meridians mm
     JOIN magic m ON m.id = mm.magic_id AND m.level = 1
     ORDER BY mm.channel_no, mm.magic_id`,
  ).all() as (Omit<MeridianPoint, "levels" | "isRoot"> & { isRoot: number })[])
    .map((row) => ({ ...row, isRoot: Boolean(row.isRoot), levels: [] }));
  const byId = new Map(points.map((point) => [point.id, point]));
  const byLevel = new Map<string, MeridianLevel>();
  const levels = db.prepare(
    `SELECT l.magic_id AS id, l.level, l.spend_cost AS cost,
            l.success_prob AS prob, m.help
     FROM magic_learn l
     LEFT JOIN magic m ON m.id = l.magic_id AND m.level = l.level
     WHERE l.is_meridian = 1 ORDER BY l.magic_id, l.level`,
  ).all() as (Pick<MeridianLevel, "level" | "cost" | "prob" | "help"> & { id: number })[];
  for (const { id, ...row } of levels) {
    const level: MeridianLevel = { ...row, prereqs: [], stats: [] };
    byId.get(id)?.levels.push(level);
    byLevel.set(`${id}:${row.level}`, level);
  }
  const prereqs = db.prepare(
    `SELECT p.magic_id AS id, p.level, p.req_magic_id AS reqId, p.req_level AS reqLevel
     FROM magic_prereqs p JOIN magic_meridians mm ON mm.magic_id = p.magic_id
     WHERE p.req_magic_id <> p.magic_id ORDER BY p.magic_id, p.level, p.seq`,
  ).all() as { id: number; level: number; reqId: number; reqLevel: number }[];
  for (const row of prereqs) {
    byLevel.get(`${row.id}:${row.level}`)?.prereqs.push({ id: row.reqId, level: row.reqLevel });
  }
  const stats = db.prepare(
    `SELECT s.magic_id AS id, s.level, s.stat, s.value, s.flag
     FROM magic_stats s JOIN magic_meridians mm ON mm.magic_id = s.magic_id
     ORDER BY s.magic_id, s.level, s.stat`,
  ).all() as (MeridianLevel["stats"][number] & { id: number; level: number })[];
  for (const { id, level, ...stat } of stats) {
    byLevel.get(`${id}:${level}`)?.stats.push(stat);
  }
  const imageRows = db.prepare(
    `SELECT icon_id AS iconId, state, frame, url, width, height,
            pos_x AS posX, pos_y AS posY, anchor_x AS anchorX, anchor_y AS anchorY
     FROM ui_images WHERE "window" = 'AttribChannel' ORDER BY icon_id, state, frame`,
  ).all() as UiImage[];
  const images = Object.fromEntries(imageRows.map((image) => [
    `${image.iconId}:${image.state}:${image.frame}`, image,
  ]));
  const channelRows = db.prepare(
    `SELECT c.channel_no AS channelNo, c.channel AS name,
            c.base_x AS baseX, c.base_y AS baseY,
            t.icon_id AS tabIconId, b.icon_id AS baseIconId
     FROM meridian_channels c
     JOIN ui_images t ON t.icon_id = c.tab_icon_id AND t.state = 'disable' AND t.frame = 0
       AND t."window" = 'AttribChannel'
     JOIN ui_images b ON b.icon_id = c.base_icon_id AND b.state = 'normal' AND b.frame = 0
       AND b."window" = 'AttribChannel'
     ORDER BY c.channel_no`,
  ).all() as (Omit<MeridianChannel, "tabImage" | "baseImage"> & {
    tabIconId: number; baseIconId: number;
  })[];
  const channels = channelRows.map(({ tabIconId, baseIconId, ...row }) => ({
    ...row,
    tabImage: images[`${tabIconId}:disable:0`],
    baseImage: images[`${baseIconId}:normal:0`],
  }));
  cached = { points, channels, images };
  return cached;
}
