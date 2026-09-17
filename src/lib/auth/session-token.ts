import { createHmac, timingSafeEqual } from "node:crypto";

const secret = process.env.SESSION_SECRET;
if (!secret) throw new Error("缺少 SESSION_SECRET，無法啟動登入功能。");
const sessionSecret: string = secret;

export const SESSION_MAX_AGE = 90 * 24 * 60 * 60;
export const SESSION_COOKIE = "__Host-genbu-session";
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};

function signature(payload: string): Buffer {
  return createHmac("sha256", sessionSecret).update(payload).digest();
}

export function signSession(sub: string, exp: number): string {
  const payload = Buffer.from(JSON.stringify({ sub, exp })).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}

export function verifySession(
  token: string,
  now = Math.floor(Date.now() / 1000),
): { sub: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, mac] = parts;
  if (!/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]{43}$/.test(mac)) {
    return null;
  }
  const actual = Buffer.from(mac, "base64url");
  const expected = signature(payload);
  if (
    actual.toString("base64url") !== mac ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  ) {
    return null;
  }
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      !value ||
      typeof value.sub !== "string" ||
      !value.sub ||
      !Number.isSafeInteger(value.exp) ||
      value.exp <= now
    ) {
      return null;
    }
    return { sub: value.sub };
  } catch {
    return null;
  }
}
