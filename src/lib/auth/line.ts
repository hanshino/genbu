export const OAUTH_COOKIE = "__Host-genbu-line";
export const OAUTH_MAX_AGE = 10 * 60;

// 部署端必須讓受信任的反向代理覆寫 Host / X-Forwarded-Proto。
export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const protocol = request.headers.get("x-forwarded-proto") || url.protocol.slice(0, -1);
  const host = request.headers.get("host") || url.host;
  if (protocol !== "https" && protocol !== "http") throw new Error("無效的協定");
  const origin = new URL(`${protocol}://${host}`);
  if (origin.host !== host || origin.username || origin.password) {
    throw new Error("無效的主機名稱");
  }
  return origin.origin;
}

export function safeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  ) {
    return "/";
  }
  // 正規化點路徑後仍必須留在站內。
  const url = new URL(value, "https://genbu.invalid");
  return url.origin === "https://genbu.invalid" && !url.pathname.startsWith("//")
    ? `${url.pathname}${url.search}${url.hash}`
    : "/";
}

export function lineConfig() {
  const clientId = process.env.LINE_CHANNEL_ID;
  const clientSecret = process.env.LINE_CHANNEL_SECRET;
  if (!clientId || !clientSecret) throw new Error("缺少 LINE 登入設定");
  return { clientId, clientSecret };
}

export async function linePost(endpoint: "token" | "verify", body: URLSearchParams) {
  const response = await fetch(`https://api.line.me/oauth2/v2.1/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("LINE 登入驗證失敗");
  return response.json();
}

export function isSameOrigin(request: Request): boolean {
  try {
    return request.headers.get("origin") === requestOrigin(request);
  } catch {
    return false;
  }
}
