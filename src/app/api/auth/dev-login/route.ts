import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_OPTIONS,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
} from "@/lib/auth/session-token";
import { getUserDb } from "@/lib/user-db";

export const runtime = "nodejs";

// 本機開發用的假登入：只在 next dev 且從 localhost 連線時有效，正式環境一律 404。
const DEV_SUB = "U" + "0".repeat(31) + "1";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (process.env.NODE_ENV !== "development" || !LOCAL_HOSTS.has(url.hostname)) {
    return new NextResponse(null, { status: 404 });
  }
  getUserDb()
    .prepare(
      "INSERT INTO users (sub, nickname, created_at) VALUES (?, ?, ?) ON CONFLICT(sub) DO NOTHING",
    )
    .run(DEV_SUB, "本機測試俠", Math.floor(Date.now() / 1000));
  const returnTo = url.searchParams.get("returnTo");
  const target = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  const response = NextResponse.redirect(new URL(target, url.origin));
  response.cookies.set(
    SESSION_COOKIE,
    signSession(DEV_SUB, Math.floor(Date.now() / 1000) + SESSION_MAX_AGE),
    { ...AUTH_COOKIE_OPTIONS, maxAge: SESSION_MAX_AGE },
  );
  return response;
}
