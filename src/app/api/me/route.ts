import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/auth/line";
import { getUserDb } from "@/lib/user-db";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const fail = (error: string) => NextResponse.json({ error }, { status: 400 });
  try {
    if (!isSameOrigin(request)) return fail("請從本站修改暱稱。");
    const session = await getSession();
    if (!session) return fail("登入已過期，請重新登入。");
    const body = await request.json();
    if (!body || typeof body.nickname !== "string") return fail("請輸入暱稱。");
    const nickname = body.nickname.trim();
    if (nickname.length < 1 || nickname.length > 20) {
      return fail("暱稱請輸入 1–20 字。");
    }
    const result = getUserDb()
      .prepare("UPDATE users SET nickname = ? WHERE sub = ?")
      .run(nickname, session.sub);
    if (!result.changes) return fail("找不到玩家資料，請重新登入。");
    return NextResponse.json({ nickname }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail("無法更新暱稱，請確認資料格式或稍後再試。");
  }
}
