import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/auth/line";
import { AUTH_COOKIE_OPTIONS, SESSION_COOKIE } from "@/lib/auth/session-token";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "請從本站登出。" }, { status: 400 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
