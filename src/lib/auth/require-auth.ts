import { NextResponse } from "next/server";
import { getSession } from "./session";
import { isSameOrigin } from "./line";

// 每個寫入類 route handler 都要先過 same-origin + session 檢查；
// 抽成 helper 讓呼叫端用 `instanceof NextResponse` 判斷要不要提早 return。
export async function requireAuth(request: Request): Promise<{ sub: string } | NextResponse> {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "請從本站操作。" }, { status: 400 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "登入已過期，請重新登入。" }, { status: 400 });
  }
  return session;
}
