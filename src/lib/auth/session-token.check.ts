import assert from "node:assert/strict";
import { signSession, verifySession } from "./session-token";
import { safeReturnTo } from "./line";

const now = 1_800_000_000;
const sub = "U000000000000000000000000000a3f2c";
const token = signSession(sub, now + 60);
assert.deepEqual(verifySession(token, now), { sub });
const [payload, mac] = token.split(".");
const tampered = Buffer.from(JSON.stringify({ sub: "attacker", exp: now + 60 })).toString(
  "base64url",
);
assert.equal(verifySession(`${tampered}.${mac}`, now), null);
assert.equal(verifySession(`${payload}.${mac[0] === "A" ? "B" : "A"}${mac.slice(1)}`, now), null);
assert.equal(verifySession(token, now + 60), null);
assert.equal(verifySession(signSession(sub, now - 1), now), null);
assert.equal(verifySession("invalid", now), null);
assert.equal(verifySession(`${token}.extra`, now), null);
for (const value of [
  "https://evil.test",
  "//evil.test",
  "/\\evil.test",
  "/\n/evil.test",
  "/x/..//evil.test",
]) {
  assert.equal(safeReturnTo(value), "/");
}
assert.equal(safeReturnTo("/items/123?q=test#detail"), "/items/123?q=test#detail");
console.log("Session 簽章、過期與 returnTo 檢查通過。");
