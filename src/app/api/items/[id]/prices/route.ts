import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireAuth } from "@/lib/auth/require-auth";
import { getDb } from "@/lib/db";
import { MAX_AWAKEN, MAX_BIND, MAX_ENHANCEMENTS, parseEnhance } from "@/lib/enhance";
import {
  createReport,
  getItemReports,
  hasReportedRecently,
  type CurrencyId,
  type ServerId,
} from "@/lib/queries/market-prices";

export const runtime = "nodejs";

const SERVERS: ServerId[] = ["fish", "flower"];
const CURRENCIES: CurrencyId[] = ["silver", "official", "twd"];
const MAX_AMOUNT = 1e15;
const REPORT_COOLDOWN_SECONDS = 5 * 60;

// 補充狀態全是選填欄位：沒填就是 null / 0。填了就一定要合法，不合法直接擋下來，
// 不要「盡量修好再存」——存進去的東西之後會被當成事實拿去算價。
const INVALID = Symbol("invalid");

function optionalInt(value: unknown, max: number): number | null | typeof INVALID {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > max) {
    return INVALID;
  }
  return value;
}

function parseItemId(id: string): number | null {
  const itemId = Number(id);
  return Number.isInteger(itemId) && itemId > 0 ? itemId : null;
}

function itemExists(itemId: number): boolean {
  const row = getDb().prepare("SELECT 1 FROM items WHERE id = ?").get(itemId);
  return row !== undefined;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const fail = (error: string) => NextResponse.json({ error }, { status: 400 });
  try {
    const { id } = await params;
    const itemId = parseItemId(id);
    if (itemId === null) return fail("物品編號無效。");

    const session = await getSession();
    const reports = getItemReports(itemId, session?.sub ?? null);
    return NextResponse.json({ reports }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail("無法取得市價資料，請稍後再試。");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const fail = (error: string) => NextResponse.json({ error }, { status: 400 });
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const { id } = await params;
    const itemId = parseItemId(id);
    if (itemId === null) return fail("物品編號無效。");
    if (!itemExists(itemId)) return fail("找不到這個物品。");

    const body = await request.json();
    if (!body) return fail("請提供回報內容。");

    const { amount, currency, server } = body;
    if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount <= 0 ||
      amount > MAX_AMOUNT
    ) {
      return fail("金額請輸入正整數。");
    }
    if (typeof currency !== "string" || !CURRENCIES.includes(currency as CurrencyId)) {
      return fail("幣別無效。");
    }
    if (typeof server !== "string" || !SERVERS.includes(server as ServerId)) {
      return fail("伺服器無效。");
    }

    const awaken = optionalInt(body.awaken, MAX_AWAKEN);
    if (awaken === INVALID) return fail(`覺醒階數請填 0 ~ ${MAX_AWAKEN} 的整數。`);
    const bindLeft = optionalInt(body.bindLeft, MAX_BIND);
    if (bindLeft === INVALID) return fail(`綁定次數請填 0 ~ ${MAX_BIND} 的整數。`);
    const bindExpand = optionalInt(body.bindExpand, MAX_BIND);
    if (bindExpand === INVALID) return fail(`可擴次數請填 0 ~ ${MAX_BIND} 的整數。`);

    const rawEnhance: unknown = body.enhance ?? [];
    if (!Array.isArray(rawEnhance) || rawEnhance.some((code) => typeof code !== "string")) {
      return fail("強化格式無效。");
    }
    if (rawEnhance.length > MAX_ENHANCEMENTS) {
      return fail(`強化最多填 ${MAX_ENHANCEMENTS} 項。`);
    }
    const enhance = rawEnhance as string[];
    const parsed = enhance.map(parseEnhance);
    if (parsed.some((item) => item === null)) return fail("強化項目無效。");
    if (new Set(parsed.map((item) => item!.key)).size !== parsed.length) {
      return fail("同一個屬性只能填一次。");
    }

    if (hasReportedRecently(itemId, server as ServerId, session.sub, REPORT_COOLDOWN_SECONDS)) {
      return fail("回報過於頻繁，請 5 分鐘後再試。");
    }

    const id_ = createReport({
      itemId,
      server: server as ServerId,
      currency: currency as CurrencyId,
      amount,
      authorSub: session.sub,
      awaken: awaken ?? 0,
      bindLeft,
      bindExpand,
      enhance,
    });
    return NextResponse.json({ id: id_ }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail("無法送出回報，請確認資料格式或稍後再試。");
  }
}
