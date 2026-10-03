import { NextResponse } from "next/server";
import { getDamageData } from "@/lib/queries/stat-sim";

export const runtime = "nodejs";
// SQLite 是部署時另外掛載的，build 時不能去讀。
export const dynamic = "force-dynamic";

export function GET() {
  try {
    // 跟首頁的 getStatSimData 一樣每次都查：DB 可能不經重新部署就換掉。
    return NextResponse.json(getDamageData(), {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ error: "無法取得傷害試算資料，請稍後再試。" }, { status: 500 });
  }
}
