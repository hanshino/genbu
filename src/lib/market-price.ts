import type { CurrencyId, PriceReport, ServerId } from "@/lib/queries/market-prices";

/**
 * 市價的換算、參考價計算與顯示格式。
 *
 * 全部是純函式，放在一般模組（非 "use client"）讓測試和 Server Component 都能用。
 * DB 只存原始金額 + 幣別，換算一律在這裡做。
 */

/** 官幣與銀兩是同一條軸，1 官幣 = 100 萬銀兩，遊戲內固定匯率。 */
export const SILVER_PER_OFFICIAL = 1_000_000;

/** 參考價只看近 30 天，久到失去參考價值的回報不列入。 */
export const REFERENCE_WINDOW_DAYS = 30;

/** 回報表單與匯率設定都以「萬銀兩」為輸入單位，送出前換回銀兩。 */
export const SILVER_PER_WAN = 10_000;

export const SERVERS: readonly { id: ServerId; name: string; alias: string }[] = [
  { id: "fish", name: "莫愁谷", alias: "小魚兒" },
  { id: "flower", name: "飛雁山莊", alias: "花無缺" },
];

export const CURRENCY_LABELS: Record<CurrencyId, string> = {
  silver: "銀兩",
  official: "官幣",
  twd: "台幣",
};

/** 台幣匯率只存在玩家自己的瀏覽器：1 台幣 = N 銀兩。 */
const TWD_RATE_KEY = "genbu.twdRate";

export function readTwdRate(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TWD_RATE_KEY);
    const value = raw == null ? NaN : Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeTwdRate(rate: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TWD_RATE_KEY, String(rate));
  } catch {
    /* 無痕模式或容量滿：這一輪仍然套用，只是下次進來要重設 */
  }
}

/** 正規化成銀兩。台幣在玩家沒設匯率時回 null，代表「無法比較」而不是 0。 */
export function toSilver(amount: number, currency: CurrencyId, rate: number | null): number | null {
  if (currency === "silver") return amount;
  if (currency === "official") return amount * SILVER_PER_OFFICIAL;
  return rate != null && rate > 0 ? amount * rate : null;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * 乾淨裝：沒覺醒也沒強化，才是可以互相比較的同一種東西。
 *
 * 覺醒過或強化過的是一物一價——每個屬性組合的樣本數都是 1，混進中位數只會讓參考價失真，
 * 所以這種回報照樣收、照樣顯示，但不進計算。綁定次數不在判斷內：它的價差等於解綁／擴充
 * 道具的成本，那些道具自己在站上也有市價，讓看的人自己加減。
 */
export function isClean(report: PriceReport): boolean {
  return report.awaken === 0 && report.enhance.length === 0;
}

export interface ReferencePrice {
  /** 中位數，單位銀兩；沒有可用回報時為 null。 */
  silver: number | null;
  /** 實際納入計算的筆數。 */
  count: number;
  /** 範圍內的現金（台幣）回報筆數。沒設匯率時這些都沒算進中位數。 */
  cash: number;
}

/**
 * 篩出當前伺服器 → 近 30 天 → 認同數不為負 → 乾淨裝 → 正規化成銀兩 → 取中位數。
 *
 * 用中位數不是平均，一筆離譜價不會把結果整個拉歪。
 */
export function referencePrice(
  reports: readonly PriceReport[],
  server: ServerId,
  rate: number | null,
  now: number = Date.now(),
): ReferencePrice {
  const since = now / 1000 - REFERENCE_WINDOW_DAYS * 86_400;
  const values: number[] = [];
  let cash = 0;

  for (const report of reports) {
    if (report.server !== server) continue;
    if (report.createdAt < since) continue;
    if (report.netVotes < 0) continue;
    if (!isClean(report)) continue;
    if (report.currency === "twd") cash++;
    const silver = toSilver(report.amount, report.currency, rate);
    if (silver != null) values.push(silver);
  }

  return { silver: median(values), count: values.length, cash };
}

function localized(n: number): string {
  return n.toLocaleString("zh-TW", { maximumFractionDigits: 2 });
}

export interface Money {
  value: string;
  unit: string;
}

/** 台灣玩家習慣讀「萬 / 億」，數字與單位分開回傳讓版面能各自排字級。 */
export function formatSilver(silver: number): Money {
  if (silver >= 100_000_000) return { value: localized(silver / 100_000_000), unit: "億銀兩" };
  if (silver >= SILVER_PER_WAN)
    return { value: localized(silver / SILVER_PER_WAN), unit: "萬銀兩" };
  return { value: localized(silver), unit: "銀兩" };
}

/** 參考價主數字。台幣沒設匯率時給「—」，絕不推估。 */
export function formatReference(silver: number | null, currency: CurrencyId, rate: number | null) {
  if (silver == null) return { value: "—", unit: CURRENCY_LABELS[currency] };
  if (currency === "silver") return formatSilver(silver);
  if (currency === "official")
    return { value: localized(silver / SILVER_PER_OFFICIAL), unit: "官幣" };
  return rate != null && rate > 0
    ? { value: localized(silver / rate), unit: "台幣" }
    : { value: "—", unit: "台幣" };
}

/** 單筆回報照玩家當初填的幣別顯示，不換算，免得他認不出自己報的數字。 */
export function formatAmount(amount: number, currency: CurrencyId): Money {
  if (currency === "silver") return formatSilver(amount);
  return { value: localized(amount), unit: CURRENCY_LABELS[currency] };
}

const RELATIVE = new Intl.RelativeTimeFormat("zh-TW", { numeric: "auto" });
const RELATIVE_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

export function relativeTime(unixSeconds: number, now: number = Date.now()): string {
  // 未來時間只可能是時鐘誤差，不要顯示「3 小時後」。
  const diff = Math.min(unixSeconds * 1000 - now, 0);
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (-diff >= ms) return RELATIVE.format(Math.round(diff / ms), unit);
  }
  return "剛剛";
}
