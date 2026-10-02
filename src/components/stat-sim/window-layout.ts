import type { CSSProperties } from "react";
import type {
  AttributeKey,
  EquipSlot,
  PanelStatKey,
  UiControl,
  UiWindowLayout,
} from "@/lib/types/stat-sim";

/** 底圖原始 px。 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type AttrField =
  | { kind: "label"; box: Box; color: string; text: string }
  | {
      kind: "attr" | "next" | "add";
      box: Box;
      color: string;
      key: AttributeKey;
      iconUrl?: string | null;
    }
  | { kind: "stat"; box: Box; color: string; key: PanelStatKey; hiddenInGame: boolean }
  | { kind: "bar"; box: Box; color: string; key: "hp" | "mp" }
  | { kind: "points"; box: Box; color: string }
  | { kind: "text"; box: Box; color: string; key: "name" | "level" | "sect" | null };

const ATTR_BY_LABEL: Record<string, AttributeKey> = {
  外功: "str",
  內力: "pow",
  根骨: "vit",
  身法: "agi",
  技巧: "dex",
  玄學: "wis",
};
const STAT_BY_LABEL: Record<string, PanelStatKey> = {
  物攻: "atk",
  內勁: "matk",
  防禦: "def",
  護勁: "mdef",
  命中: "hit",
  閃躲: "dodge",
  攻速: "attack_speed",
  重擊: "critical",
  拆招: "uncanny_dodge",
  體力: "hp",
  真氣: "mp",
};
const TEXT_BY_LABEL: Record<string, "name" | "level" | "sect"> = {
  名字: "name",
  等級: "level",
  門派: "sect",
};
/** 遊戲裡蓋住命中／閃躲／重擊／拆招的擋板；網站不畫它，只用它的範圍標「遊戲中不顯示」。 */
const BLIND_CTRL_ID = 489;
const ROW_TOLERANCE = 3;

const px = (n: number) => `calc(var(--u) * ${n})`;
export const place = (b: Box, color?: string): CSSProperties => ({
  left: px(b.x),
  top: px(b.y),
  width: px(b.w),
  height: px(b.h),
  ...(color ? { color } : null),
});

const boxOf = (c: UiControl): Box => ({ x: c.x, y: c.y, w: c.width, h: c.height });

/** 同一列、在左邊最近的標籤。 */
function rowLabel(c: UiControl, labels: UiControl[]) {
  return labels
    .filter((l) => Math.abs(l.y - c.y) <= ROW_TOLERANCE && l.x < c.x)
    .sort((a, b) => b.x - a.x)[0];
}

/** 標籤在正上方（屬性點）優先，否則取同列左邊最近的標籤。 */
function labelFor(c: UiControl, labels: UiControl[]) {
  const above = labels
    .filter((l) => Math.abs(l.x - c.x) <= 6 && l.y < c.y && c.y - l.y <= 20)
    .sort((a, b) => b.y - a.y)[0];
  return above ?? rowLabel(c, labels);
}

/**
 * 標籤與數值依座標配對，不看 comment / field（DB 註解有錯字）。
 * 同一個六圍標籤右邊的第一格是數值，第二格是「再加 1 點的成本」。
 */
export function attributeFields(win: UiWindowLayout): AttrField[] {
  const labels = win.controls.filter((c) => c.class === "STATIC" && c.title);
  const blind = win.controls.find((c) => c.ctrlId === BLIND_CTRL_ID);
  const covered = (c: UiControl) =>
    !!blind &&
    c.x < blind.x + blind.width &&
    c.x + c.width > blind.x &&
    c.y < blind.y + blind.height &&
    c.y + c.height > blind.y;

  const fields: AttrField[] = labels.map((l) => ({
    kind: "label",
    box: boxOf(l),
    color: l.color ?? "#000000",
    text: l.title!,
  }));
  const values = win.controls
    .filter(
      (c) => ((c.class === "STATIC" || c.class === "EDIT") && !c.title) || c.class === "PROGRESS",
    )
    .sort((a, b) => a.x - b.x);
  const seen = new Map<number, number>();
  for (const c of values) {
    const label = labelFor(c, labels);
    if (!label) continue;
    const nth = seen.get(label.ctrlId) ?? 0;
    seen.set(label.ctrlId, nth + 1);
    const title = label.title!;
    const base = { box: boxOf(c), color: c.color ?? "#000000" };
    const attr = ATTR_BY_LABEL[title];
    const stat = STAT_BY_LABEL[title];
    if (attr) fields.push({ ...base, kind: nth === 0 ? "attr" : "next", key: attr });
    else if (stat === "hp" || stat === "mp") {
      if (c.class === "PROGRESS") fields.push({ ...base, kind: "bar", key: stat });
    } else if (stat) fields.push({ ...base, kind: "stat", key: stat, hiddenInGame: covered(c) });
    else if (title === "屬性點") fields.push({ ...base, kind: "points" });
    else fields.push({ ...base, kind: "text", key: TEXT_BY_LABEL[title] ?? null });
  }
  for (const c of win.controls) {
    if (c.class !== "BUTTON") continue;
    const key = ATTR_BY_LABEL[rowLabel(c, labels)?.title ?? ""];
    if (key) fields.push({ kind: "add", box: boxOf(c), color: "", key, iconUrl: c.iconUrl });
  }
  return fields;
}

export interface EquipFields {
  slots: { slot: EquipSlot; box: Box }[];
  /** 預備欄切換（accoutrements_B），v1 不開放。 */
  page: { box: Box; iconUrl: string | null } | null;
  /** 外裝欄切換，只影響外觀，v1 不做。 */
  extra: { box: Box; iconUrl: string | null } | null;
  title: Box | null;
  /** 紙娃娃腳底錨點。 */
  dollAnchor: { x: number; y: number } | null;
}

/** 裝備格使用 ui_equip_slots；預備／外裝切換仍由原控制項取得。 */
export function equipmentFields(win: UiWindowLayout): EquipFields {
  const buttons = win.controls.filter((c) => c.class === "BUTTON");
  const find = (suffix: string) => {
    const c = buttons.find((b) => b.comment?.endsWith(suffix));
    return c ? { box: boxOf(c), iconUrl: c.iconUrl } : null;
  };
  const title = win.controls.find((c) => c.class === "STATIC" && !c.title && !c.field);
  const anchor = win.controls.find((c) => c.class === "BASE" && c.width === 1 && c.height === 1);
  return {
    slots: (win.equipSlots ?? []).map((c) => ({
      slot: c.slot, box: { x: c.x, y: c.y, w: c.width, h: c.height },
    })),
    page: find("chang page"),
    extra: find("-accoutrements"),
    title: title ? boxOf(title) : null,
    dollAnchor: anchor ? { x: anchor.x, y: anchor.y } : null,
  };
}
