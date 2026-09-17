import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "./session-token";
import { safeReturnTo } from "./line";

const now = 1_800_000_000;
const sub = "U000000000000000000000000000a3f2c";

describe("session-token", () => {
  it("簽章後可正確驗回原本的 sub", () => {
    const token = signSession(sub, now + 60);
    expect(verifySession(token, now)).toEqual({ sub });
  });

  it("payload 被竄改時拒絕", () => {
    const token = signSession(sub, now + 60);
    const [, mac] = token.split(".");
    const tampered = Buffer.from(JSON.stringify({ sub: "attacker", exp: now + 60 })).toString(
      "base64url",
    );
    expect(verifySession(`${tampered}.${mac}`, now)).toBeNull();
  });

  it("mac 被竄改時拒絕", () => {
    const token = signSession(sub, now + 60);
    const [payload, mac] = token.split(".");
    expect(
      verifySession(`${payload}.${mac[0] === "A" ? "B" : "A"}${mac.slice(1)}`, now),
    ).toBeNull();
  });

  it("已過期時拒絕", () => {
    const token = signSession(sub, now + 60);
    expect(verifySession(token, now + 60)).toBeNull();
  });

  it("簽章時 exp 已在過去也拒絕", () => {
    expect(verifySession(signSession(sub, now - 1), now)).toBeNull();
  });

  it("格式不正確時拒絕", () => {
    expect(verifySession("invalid", now)).toBeNull();
  });

  it("多餘片段時拒絕", () => {
    const token = signSession(sub, now + 60);
    expect(verifySession(`${token}.extra`, now)).toBeNull();
  });
});

describe("safeReturnTo", () => {
  it("拒絕跨站或含控制字元的路徑，一律回退首頁", () => {
    for (const value of [
      "https://evil.test",
      "//evil.test",
      "/\\evil.test",
      "/\n/evil.test",
      "/x/..//evil.test",
    ]) {
      expect(safeReturnTo(value)).toBe("/");
    }
  });

  it("站內路徑原樣放行", () => {
    expect(safeReturnTo("/items/123?q=test#detail")).toBe("/items/123?q=test#detail");
  });
});
