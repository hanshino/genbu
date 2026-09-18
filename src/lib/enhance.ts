import { itemAttributeNames } from "@/lib/constants/i18n";

/**
 * 裝備強化的屬性編碼。
 *
 * 一段強化編成 `<屬性key>:<加值>`（"matk:8"），一筆回報的全部強化用逗號串成一欄存進
 * price_reports.enhance（"matk:8,hit:7"）。存 key 不存中文，之後改譯名不會弄壞舊資料。
 *
 * 純函式，沒有 DB 依賴：Server Component、API handler 和 client 表單共用同一套解析。
 */

/**
 * 可強化的 20 種屬性；宣告順序即建議清單順序。
 * 與 queries/compound.ts 的 BONUS_TO_ATTR_KEY 是同一組，兩邊走鐘由測試擋。
 * 那邊有 DB 依賴，不能被 client 元件 import，所以這裡重列一份。
 */
export const ENHANCE_ATTR_KEYS = [
  "def",
  "mdef",
  "atk",
  "matk",
  "hp",
  "mp",
  "dodge",
  "hit",
  "critical",
  "uncanny_dodge",
  "str",
  "vit",
  "dex",
  "agi",
  "pow",
  "wis",
  "fire",
  "water",
  "tree",
  "thunder",
] as const;

export type EnhanceAttrKey = (typeof ENHANCE_ATTR_KEYS)[number];

export interface EnhanceAttr {
  key: EnhanceAttrKey;
  label: string;
}

export const ENHANCE_ATTRS: readonly EnhanceAttr[] = ENHANCE_ATTR_KEYS.map((key) => ({
  key,
  label: itemAttributeNames[key],
}));

/** 裝備最多 3 洞、一條配方可能含多個加成，6 段留了餘裕。 */
export const MAX_ENHANCEMENTS = 6;

/** 覺醒 +1 ~ +20；實際上限由該件裝備的覺醒路徑決定，這是絕對上界。 */
export const MAX_AWAKEN = 20;

/** 綁定次數／可擴次數的上界，純粹擋亂填，遊戲裡不會這麼大。 */
export const MAX_BIND = 99;

const LABEL_BY_KEY = new Map<string, string>(ENHANCE_ATTRS.map((a) => [a.key, a.label]));

export interface Enhancement {
  key: string;
  label: string;
  value: number;
}

/** "matk:8" → { key, label, value }。認不得的 key、非正整數的值一律 null。 */
export function parseEnhance(code: string): Enhancement | null {
  const [key, rawValue] = code.split(":");
  const label = LABEL_BY_KEY.get(key);
  if (!label) return null;
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0 || value > 999) return null;
  return { key, label, value };
}

/** 顯示用："內勁 +8"；認不得就原樣吐回去，不要因為一段壞資料就整列空白。 */
export function formatEnhance(code: string): string {
  const parsed = parseEnhance(code);
  return parsed ? `${parsed.label} +${parsed.value}` : code;
}

/**
 * DB 欄位 → 編碼陣列。壞掉的段落直接丟掉：舊資料或手動改過的列不該弄掛整頁。
 * 注意別用 LIKE '%atk:%' 篩選，那會連 matk 一起命中；篩選一律先 decode 再比。
 */
export function decodeEnhance(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => parseEnhance(part) !== null);
}

/** 編碼陣列 → DB 欄位；沒有強化就存 null，不存空字串。 */
export function encodeEnhance(codes: readonly string[]): string | null {
  const valid = codes.filter((code) => parseEnhance(code) !== null);
  return valid.length > 0 ? valid.join(",") : null;
}

export interface EnhanceSuggestion {
  /** 已經可以直接變成標籤的編碼（打了數值才會有）。 */
  codes: string[];
  /** 比對到的屬性名；還沒打數值時拿來提示「後面補數值」。 */
  labels: string[];
}

const MAX_SUGGESTIONS = 5;

/**
 * 玩家打的字 → 建議清單。「內勁8」「內勁 +8」都給 "matk:8"，只打「內」就先回屬性名。
 * 沒打數值不可能組出有效的標籤，所以 codes 會是空的，由呼叫端顯示 labels 當提示。
 */
export function suggestEnhance(query: string, taken: readonly string[] = []): EnhanceSuggestion {
  const cleaned = query.replace(/[\s+]/g, "");
  const match = /^(\D*)(\d{1,3})?$/.exec(cleaned);
  if (!match) return { codes: [], labels: [] };

  const [, namePart, valuePart] = match;
  if (!namePart) return { codes: [], labels: [] };

  const takenKeys = new Set(taken.map((code) => code.split(":")[0]));
  const matched = ENHANCE_ATTRS.filter(
    (attr) => attr.label.startsWith(namePart) && !takenKeys.has(attr.key),
  ).slice(0, MAX_SUGGESTIONS);

  const value = valuePart ? Number(valuePart) : null;
  return {
    codes: value != null && value > 0 ? matched.map((attr) => `${attr.key}:${value}`) : [],
    labels: matched.map((attr) => attr.label),
  };
}
