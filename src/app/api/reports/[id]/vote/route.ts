import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { ReportNotFoundError, SelfVoteError, getNetVotes, setVote } from "@/lib/queries/market-prices";

export const runtime = "nodejs";

function parseReportId(id: string): number | null {
  const reportId = Number(id);
  return Number.isInteger(reportId) && reportId > 0 ? reportId : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const { id } = await params;
    const reportId = parseReportId(id);
    if (reportId === null) return fail("回報編號無效。");

    const body = await request.json();
    const { value } = body ?? {};
    if (value !== 1 && value !== -1 && value !== 0) {
      return fail("投票值無效。");
    }

    try {
      setVote(reportId, session.sub, value);
    } catch (error) {
      if (error instanceof ReportNotFoundError) return fail("找不到這筆回報。");
      if (error instanceof SelfVoteError) return fail("不能認同自己的回報。");
      throw error;
    }

    return NextResponse.json(
      { netVotes: getNetVotes(reportId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return fail("無法送出投票，請稍後再試。");
  }
}
