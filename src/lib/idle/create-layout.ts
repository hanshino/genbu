// 「創造角色」視窗（ui_windows 'NewCreate-1'，404×364）的版面。
// 原作的控制項 id 是穩定的（座標也是視窗內的相對座標），所以直接用 id 對應用途，不靠註解或座標推測：
// 註解有錯字，右欄的標籤、數值與按鈕還有 1 px 的 y 差，用座標容差配對反而容易出錯。
import type { AttributeKey } from "@/lib/types/stat-sim";

export const CREATE_WINDOW = "NewCreate-1";

export type ButtonState = "normal" | "focus" | "down" | "disable";
/** 一個按鈕各狀態的圖（url）；沒有的狀態不會出現（例如方向鈕沒有 disable）。 */
export type ButtonIcons = Partial<Record<ButtonState, string>>;

/** 從資料庫讀出的控制項（座標是視窗內的相對座標）。 */
export interface CreateControl {
  id: number;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string | null;
  icons: ButtonIcons | null;
}

export interface CreateWindowData {
  width: number;
  height: number;
  backgroundUrl: string;
  controls: CreateControl[];
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImageButton {
  id: number;
  box: Box;
  icons: ButtonIcons;
}

export type PickerKey = "gender" | "hair" | "hairColor" | "portrait" | "story" | "birthplace";

export interface PickerRow {
  key: PickerKey;
  /** 列標題，例如「髮型：」 */
  label: string;
  value: Box;
  left: ImageButton;
  right: ImageButton;
}

export interface AttributeRow {
  key: AttributeKey;
  label: string;
  value: Box;
  plus: ImageButton;
  minus: ImageButton;
}

export interface CreateLayout {
  width: number;
  height: number;
  backgroundUrl: string;
  /** 視窗標題列的字（「創造角色」）。 */
  title: { box: Box; text: string };
  /** 其餘的靜態文字：標題欄位、月、日、屬性點、屬性說明。 */
  labels: { id: number; box: Box; text: string }[];
  name: Box;
  month: Box;
  day: Box;
  description: Box;
  points: Box;
  pickers: PickerRow[];
  attributes: AttributeRow[];
  finish: ImageButton;
  back: ImageButton;
  /** 紙娃娃腳底的錨點（控制項 77 的位置）。 */
  dollAnchor: { x: number; y: number };
  dollPrev: ImageButton;
  dollNext: ImageButton;
}

const TITLE_ID = 240;
/** 這些 STATIC 才是畫面上的文字；其餘 STATIC 是數值欄位，標題只是原作設計時的佔位字。 */
const LABEL_IDS = [125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 144, 145, 146, 147, 148, 149];
/**
 * 133 在原作的標題是「種族：」，但它放在「出生地」那一列（y 213，與 111 出生地數值、
 * 84 / 90 方向鈕同一列），原作的文字是設計時沒改的舊稱。這裡照實際用途改成「出生地：」。
 */
const LABEL_OVERRIDES: Record<number, string> = { 133: "出生地：" };

/** 選擇列：性別、髮型、髮色、頭像、劇情頭像、出生地；左鈕 79..84、右鈕 85..90。 */
const PICKERS: { key: PickerKey; value: number; label: number }[] = [
  { key: "gender", value: 155, label: 128 },
  { key: "hair", value: 107, label: 129 },
  { key: "hairColor", value: 108, label: 130 },
  { key: "portrait", value: 109, label: 131 },
  { key: "story", value: 110, label: 132 },
  { key: "birthplace", value: 111, label: 133 },
];

/** 屬性列：數值欄、標籤、加鈕、減鈕（左欄 91..93 / 97..99，右欄 94..96 / 100..102）。 */
const ATTRIBUTES: { key: AttributeKey; value: number; label: number; plus: number; minus: number }[] = [
  { key: "str", value: 113, label: 144, plus: 91, minus: 97 },
  { key: "vit", value: 114, label: 145, plus: 92, minus: 98 },
  { key: "agi", value: 115, label: 146, plus: 93, minus: 99 },
  { key: "dex", value: 116, label: 147, plus: 94, minus: 100 },
  { key: "wis", value: 123, label: 148, plus: 95, minus: 101 },
  { key: "pow", value: 124, label: 149, plus: 96, minus: 102 },
];

export function createLayout(win: CreateWindowData): CreateLayout {
  const byId = new Map(win.controls.map((c) => [c.id, c]));
  const need = (id: number): CreateControl => {
    const control = byId.get(id);
    if (!control) throw new Error(`${CREATE_WINDOW} 缺少控制項 ${id}`);
    return control;
  };
  const box = (id: number): Box => {
    const c = need(id);
    return { x: c.x, y: c.y, w: c.width, h: c.height };
  };
  const text = (id: number): string => LABEL_OVERRIDES[id] ?? need(id).title ?? "";
  const button = (id: number): ImageButton => {
    const c = need(id);
    if (!c.icons?.normal) throw new Error(`${CREATE_WINDOW} 控制項 ${id} 缺少按鈕圖`);
    return { id, box: box(id), icons: c.icons };
  };

  const anchor = need(77);
  return {
    width: win.width,
    height: win.height,
    backgroundUrl: win.backgroundUrl,
    title: { box: box(TITLE_ID), text: text(TITLE_ID) },
    labels: LABEL_IDS.map((id) => ({ id, box: box(id), text: text(id) })),
    name: box(150),
    month: box(151),
    day: box(152),
    description: box(153),
    points: box(112),
    pickers: PICKERS.map((p, i) => ({
      key: p.key,
      label: text(p.label),
      value: box(p.value),
      left: button(79 + i),
      right: button(85 + i),
    })),
    attributes: ATTRIBUTES.map((a) => ({
      key: a.key,
      label: text(a.label),
      value: box(a.value),
      plus: button(a.plus),
      minus: button(a.minus),
    })),
    finish: button(103),
    back: button(104),
    dollAnchor: { x: anchor.x, y: anchor.y },
    dollPrev: button(3014),
    dollNext: button(3015),
  };
}
