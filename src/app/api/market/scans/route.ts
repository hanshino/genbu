import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ingestScan, parseScanInput, type ScanInput } from "@/lib/queries/market-scans";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = process.env.GENBU_INGEST_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "掃描匯入服務尚未設定。" }, { status: 503 });
  }

  const authorization = request.headers.get("Authorization");
  const supplied = Buffer.from(authorization?.match(/^Bearer (\S+)$/)?.[1] ?? "");
  const expected = Buffer.from(token);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return NextResponse.json({ error: "掃描匯入憑證無效。" }, { status: 401 });
  }

  let input: ScanInput;
  try {
    input = parseScanInput(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof SyntaxError ? "JSON 格式無效。" : (error as Error).message },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(ingestScan(input));
  } catch {
    return NextResponse.json({ error: "無法匯入掃描資料，請稍後再試。" }, { status: 500 });
  }
}
