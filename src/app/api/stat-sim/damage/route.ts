import { NextResponse } from "next/server";
import { getDamageData } from "@/lib/queries/stat-sim";
import type { DamageData } from "@/lib/types/stat-sim";

export const runtime = "nodejs";

// DB 唯讀，換 DB 一定會重新部署，所以整份結果存在 module 裡就好。
let cached: DamageData | null = null;

export function GET() {
  try {
    cached ??= getDamageData();
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ error: "無法取得傷害試算資料，請稍後再試。" }, { status: 500 });
  }
}
