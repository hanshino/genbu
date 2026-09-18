import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { deleteReport } from "@/lib/queries/market-prices";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const { id } = await params;
    const reportId = Number(id);
    if (!Number.isInteger(reportId) || reportId <= 0) return fail("回報編號無效。");

    // 不存在與不是你的回同一句：別讓人拿回應差異去探別人的回報歸屬。
    if (!deleteReport(reportId, session.sub)) return fail("找不到你的這筆回報。", 404);

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail("無法刪除回報，請稍後再試。");
  }
}
