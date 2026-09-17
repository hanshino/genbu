import { NextRequest, NextResponse } from "next/server";
import { getUserDb } from "@/lib/user-db";
import {
  AUTH_COOKIE_OPTIONS,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
} from "@/lib/auth/session-token";
import { lineConfig, linePost, OAUTH_COOKIE, requestOrigin, safeReturnTo } from "@/lib/auth/line";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  let response: NextResponse;
  try {
    const flow = JSON.parse(request.cookies.get(OAUTH_COOKIE)?.value || "null");
    const params = request.nextUrl.searchParams;
    const code = params.get("code");
    const origin = requestOrigin(request);
    if (
      !flow ||
      params.has("error") ||
      !code ||
      typeof flow.state !== "string" ||
      !/^[a-f0-9]{64}$/.test(flow.state) ||
      flow.state !== params.get("state") ||
      typeof flow.nonce !== "string" ||
      !/^[a-f0-9]{64}$/.test(flow.nonce) ||
      !Number.isSafeInteger(flow.exp) ||
      flow.exp <= Math.floor(Date.now() / 1000) ||
      flow.redirectUri !== `${origin}/api/auth/line/callback`
    ) {
      throw new Error("登入請求無效或已過期");
    }
    const { clientId, clientSecret } = lineConfig();
    const token = await linePost(
      "token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: flow.redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    );
    if (!token || typeof token.id_token !== "string" || !token.id_token) {
      throw new Error("缺少 LINE 身分憑證");
    }
    const identity = await linePost(
      "verify",
      new URLSearchParams({
        id_token: token.id_token,
        client_id: clientId,
        nonce: flow.nonce,
      }),
    );
    if (!identity || typeof identity.sub !== "string" || !/^U[a-f0-9]{32}$/.test(identity.sub)) {
      throw new Error("LINE 身分驗證失敗");
    }
    // 衝突時不更新，保留玩家已設定的暱稱；並行首次登入也安全。
    getUserDb()
      .prepare(
        "INSERT INTO users (sub, nickname, created_at) VALUES (?, '英雄', ?) ON CONFLICT(sub) DO NOTHING",
      )
      .run(identity.sub, Math.floor(Date.now() / 1000));
    response = NextResponse.redirect(new URL(safeReturnTo(flow.returnTo), origin));
    response.cookies.set(
      SESSION_COOKIE,
      signSession(identity.sub, Math.floor(Date.now() / 1000) + SESSION_MAX_AGE),
      { ...AUTH_COOKIE_OPTIONS, maxAge: SESSION_MAX_AGE },
    );
  } catch {
    response = NextResponse.json(
      { error: "LINE 登入未完成或已過期，請回到原頁重新登入。" },
      { status: 400 },
    );
  }
  // 成功、拒絕授權、驗證失敗都清掉短效 cookie，不保留 LINE token。
  response.cookies.set(OAUTH_COOKIE, "", { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
