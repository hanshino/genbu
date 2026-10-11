import { NextResponse } from "next/server";
import { searchAll } from "@/lib/queries/search";
import { isSearchType } from "@/lib/search-types";

export const runtime = "nodejs";

// 下拉選單用：每類只取少量命中，完整清單走 /search 頁面
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 20;

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  const limit = Number(params.get("limit") ?? DEFAULT_LIMIT);
  const result = searchAll(params.get("q") ?? "", {
    perType: Number.isFinite(limit)
      ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)))
      : DEFAULT_LIMIT,
    ...(isSearchType(type) ? { type } : {}),
  });
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
  });
}
