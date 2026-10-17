// 建立角色的輸入規則：名字、生日、屬性。純函式，瀏覽器（建立畫面）與伺服器（POST /api/idle/start）共用，
// 兩邊用同一份規則，畫面上能按的組合伺服器一定收。
import { NAME_MAX_BYTES, NAME_FORBIDDEN_CHARS } from "@/configs/idle";
import { levelPoints } from "@/lib/stat-sim";
import { ATTRIBUTE_KEYS, type Attributes } from "@/lib/types/stat-sim";
import type { IdleBirthday, IdleGender } from "./types";

// ---------------------------------------------------------------------------
// 名字
// ---------------------------------------------------------------------------

let big5Chars: Set<string> | null | undefined;

/**
 * Big5（cp950 的標準區，不含港澎擴充）能編碼的全形字元集合；執行環境不支援 big5 解碼時回傳 null。
 * 不用 iconv-lite（只是開發工具的間接相依，不會進 production），改用內建的 TextDecoder：
 * 把標準區的每一組雙位元組解碼一遍，能解出單一字元的就是 Big5 有的字。第一次用才建（約一萬四千次解碼）。
 */
function big5Set(): Set<string> | null {
  if (big5Chars !== undefined) return big5Chars;
  big5Chars = null;
  try {
    const decoder = new TextDecoder("big5", { fatal: true });
    const set = new Set<string>();
    const pair = new Uint8Array(2);
    for (let lead = 0xa1; lead <= 0xf9; lead++) {
      pair[0] = lead;
      for (let trail = 0x40; trail <= 0xfe; trail++) {
        if (trail > 0x7e && trail < 0xa1) continue;
        pair[1] = trail;
        try {
          const text = decoder.decode(pair);
          if ([...text].length === 1) set.add(text);
        } catch {
          // 這組位元組在 Big5 沒有字
        }
      }
    }
    // 解碼器壞掉或不是真的 Big5 時，不要拿來擋人。
    if (set.size > 10_000 && set.has("一") && set.has("，")) big5Chars = set;
  } catch {
    // 沒有 big5 解碼器
  }
  return big5Chars;
}

/** 名字存檔與驗證用的樣子：去掉頭尾空白。 */
export function normalizeName(name: string): string {
  return name.trim();
}

/** Big5 位元組數：ASCII 算 1，其他字元算 2（遊戲的名字欄位長度限制）。 */
export function nameBytes(name: string): number {
  let bytes = 0;
  for (const ch of name) bytes += ch.codePointAt(0)! < 0x80 ? 1 : 2;
  return bytes;
}

/** 名字不合規則的原因（繁體中文）；合法回傳 null。呼叫端要先 normalizeName。 */
export function nameProblem(name: string): string | null {
  if (name === "") return "請輸入名字。";
  const chars = [...name];
  const control = chars.find((ch) => ch.codePointAt(0)! < 0x20 || ch.codePointAt(0) === 0x7f);
  if (control) return "名字不能包含控制字元。";
  const forbidden = chars.find((ch) => NAME_FORBIDDEN_CHARS.includes(ch));
  if (forbidden) return `名字不能包含「${forbidden}」。`;
  // NFKC 讓全形的 ＧＭ 也一起擋。
  if (name.normalize("NFKC").toLowerCase().includes("gm")) return "名字不能包含「GM」。";
  const known = big5Set();
  if (known) {
    const unsupported = chars.find((ch) => ch.codePointAt(0)! >= 0x80 && !known.has(ch));
    if (unsupported) return `遊戲不支援「${unsupported}」這個字元。`;
  }
  const bytes = nameBytes(name);
  if (bytes > NAME_MAX_BYTES) {
    return `名字最長 ${NAME_MAX_BYTES} 位元組（英數字算 1、中文字算 2），目前 ${bytes}。`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 生日（可不填）
// ---------------------------------------------------------------------------

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // 沒有年份，2/29 算有效

/** 月、日是否是真的日期；合法回傳 null。 */
export function birthdayProblem(month: number, day: number): string | null {
  if (!Number.isSafeInteger(month) || month < 1 || month > 12) return "生日的月份要在 1 到 12 之間。";
  if (!Number.isSafeInteger(day) || day < 1 || day > DAYS_IN_MONTH[month - 1]) {
    return `${month} 月沒有 ${Number.isSafeInteger(day) ? day : "這"} 日。`;
  }
  return null;
}

/** 畫面上兩個文字框 → 生日。兩格都空 = 不填；只填一格或不合法回傳錯誤。 */
export function parseBirthdayInput(
  monthText: string,
  dayText: string,
): { ok: true; birthday: IdleBirthday | null } | { ok: false; error: string } {
  const m = monthText.trim();
  const d = dayText.trim();
  if (m === "" && d === "") return { ok: true, birthday: null };
  if (m === "" || d === "") return { ok: false, error: "生日要同時填月和日，或兩格都留空。" };
  if (!/^\d{1,2}$/.test(m) || !/^\d{1,2}$/.test(d)) return { ok: false, error: "生日請填數字。" };
  const month = Number(m);
  const day = Number(d);
  const error = birthdayProblem(month, day);
  return error ? { ok: false, error } : { ok: true, birthday: { month, day } };
}

// ---------------------------------------------------------------------------
// 屬性
// ---------------------------------------------------------------------------

/** 新角色：六項都從 1 起跳，Lv1 的點數可以分配（加點成本到 10 為止都是 1）。 */
export const START_ATTRIBUTE = 1;
export const START_POINTS = levelPoints(1);

export function startAttributes(): Attributes {
  return { str: 1, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 };
}

/** 驗證建立角色時的屬性：六項都要有、整數、不低於 1，且多出來的點數不超過可分配的點數。 */
export function startAttributesProblem(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "請提供六項屬性。";
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !(ATTRIBUTE_KEYS as readonly string[]).includes(key))) {
    return "屬性名稱不正確。";
  }
  let spent = 0;
  for (const key of ATTRIBUTE_KEYS) {
    const v = record[key];
    if (v === undefined) return "請提供六項屬性。";
    if (typeof v !== "number" || !Number.isSafeInteger(v)) return "屬性必須是整數。";
    if (v < START_ATTRIBUTE) return `屬性不能低於 ${START_ATTRIBUTE}。`;
    spent += v - START_ATTRIBUTE;
  }
  if (spent > START_POINTS) return `屬性點最多只能用 ${START_POINTS} 點。`;
  return null;
}

// ---------------------------------------------------------------------------
// 整份請求
// ---------------------------------------------------------------------------

/** 驗證完的新角色資料。 */
export interface NewCharacter {
  name: string;
  gender: IdleGender;
  attributes: Attributes;
  /** 沒填就沒有這個欄位（存檔是純 JSON）。 */
  birthday?: IdleBirthday;
  unspentPoints: number;
}

/** POST /api/idle/start 的請求內容；失敗時回傳要給玩家看的錯誤。 */
export function parseNewCharacter(
  body: Record<string, unknown>,
): { ok: true; character: NewCharacter } | { ok: false; error: string } {
  const gender = body.gender;
  if (gender !== "m" && gender !== "f") return { ok: false, error: "請選擇性別。" };

  if (typeof body.name !== "string") return { ok: false, error: "請輸入名字。" };
  const name = normalizeName(body.name);
  const nameError = nameProblem(name);
  if (nameError) return { ok: false, error: nameError };

  const attributeError = startAttributesProblem(body.attributes);
  if (attributeError) return { ok: false, error: attributeError };
  const attributes = body.attributes as Attributes;
  const spent = ATTRIBUTE_KEYS.reduce((sum, key) => sum + attributes[key] - START_ATTRIBUTE, 0);

  let birthday: IdleBirthday | undefined;
  const given = body.birthday;
  if (given !== undefined && given !== null) {
    if (typeof given !== "object" || Array.isArray(given)) return { ok: false, error: "生日格式不正確。" };
    const { month, day } = given as Record<string, unknown>;
    if (typeof month !== "number" || typeof day !== "number") return { ok: false, error: "生日格式不正確。" };
    const birthdayError = birthdayProblem(month, day);
    if (birthdayError) return { ok: false, error: birthdayError };
    birthday = { month, day };
  }

  return {
    ok: true,
    character: {
      name,
      gender,
      attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, attributes[key]])) as Attributes,
      ...(birthday ? { birthday } : {}),
      unspentPoints: START_POINTS - spent,
    },
  };
}
