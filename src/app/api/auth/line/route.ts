import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_OPTIONS } from "@/lib/auth/session-token";
import {
  lineConfig,
  OAUTH_COOKIE,
  OAUTH_MAX_AGE,
  requestOrigin,
  safeReturnTo,
} from "@/lib/auth/line";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { clientId } = lineConfig();
    const state = randomBytes(32).toString("hex");
    const nonce = randomBytes(32).toString("hex");
    const redirectUri = `${requestOrigin(request)}/api/auth/line/callback`;
    const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
    const authorize = new URL("https://access.line.me/oauth2/v2.1/authorize");
    authorize.search = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "openid",
      state,
      nonce,
    }).toString();
    const response = NextResponse.redirect(authorize);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(
      OAUTH_COOKIE,
      JSON.stringify({
        state,
        nonce,
        returnTo,
        redirectUri,
        exp: Math.floor(Date.now() / 1000) + OAUTH_MAX_AGE,
      }),
      { ...AUTH_COOKIE_OPTIONS, maxAge: OAUTH_MAX_AGE },
    );
    return response;
  } catch {
    return NextResponse.json({ error: "目前無法使用 LINE 登入，請稍後再試。" }, { status: 503 });
  }
}
