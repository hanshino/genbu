// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as scans from "@/lib/queries/market-scans";
import { POST } from "./route";

const body = {
  scanId: 1,
  server: "fish",
  started: 1_800_000_000.25,
  ended: null,
  items: [{ owner: "0123abcd", itemId: 100, count: 1, price: 500, strengthen: 0, data: null }],
};

function request(payload: unknown = body, authorization: string | null = "Bearer test-token") {
  return new Request("http://localhost/api/market/scans", {
    method: "POST",
    headers: authorization === null ? {} : { Authorization: authorization },
    body: JSON.stringify(payload),
  });
}

beforeEach(() => {
  vi.stubEnv("GENBU_INGEST_TOKEN", "test-token");
  vi.spyOn(scans, "ingestScan").mockReturnValue({ scanId: 1, inserted: 1, duplicate: false });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/market/scans", () => {
  it("未設定 token 回傳 503", async () => {
    vi.stubEnv("GENBU_INGEST_TOKEN", undefined);
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toHaveProperty("error");
    expect(scans.ingestScan).not.toHaveBeenCalled();
  });

  it.each([null, "Basic test-token", "Bearer bad", "Bearer wrong-token", "Bearer "])(
    "憑證缺少或不符（%s）回傳 401，不存取 DB",
    async (authorization) => {
      const response = await POST(request(body, authorization));
      expect(response.status).toBe(401);
      expect(await response.json()).toHaveProperty("error");
      expect(scans.ingestScan).not.toHaveBeenCalled();
    },
  );

  it("僅需 Bearer token，不需要 cookie 或 Origin", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ scanId: 1, inserted: 1, duplicate: false });
    expect(scans.ingestScan).toHaveBeenCalledWith(body);
  });

  it.each([
    null,
    [],
    { ...body, scanId: 0 },
    { ...body, scanId: 1.5 },
    { ...body, scanId: "1" },
    { ...body, scanId: Number.MAX_SAFE_INTEGER + 1 },
    { ...body, server: "unknown" },
    { ...body, started: "100" },
    { ...body, started: null },
    { ...body, ended: "100" },
    { ...body, ended: undefined },
    { ...body, items: null },
    { ...body, items: Array(50_001).fill(body.items[0]) },
    ...[
      null,
      [],
      { ...body.items[0], owner: "" },
      { ...body.items[0], owner: "not-hex" },
      { ...body.items[0], owner: 123 },
      { ...body.items[0], itemId: 0 },
      { ...body.items[0], itemId: 1.5 },
      { ...body.items[0], count: 0 },
      { ...body.items[0], count: "1" },
      { ...body.items[0], price: -1 },
      { ...body.items[0], price: 1.5 },
      { ...body.items[0], strengthen: -1 },
      { ...body.items[0], strengthen: undefined },
      { ...body.items[0], data: [] },
      { ...body.items[0], data: "{}" },
      { ...body.items[0], data: undefined },
    ].map((item) => ({ ...body, items: [item] })),
  ])("不合法欄位回傳 400（案例 %#）", async (payload) => {
    const response = await POST(request(payload));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.stringMatching(/[\u4e00-\u9fff]/) });
    expect(scans.ingestScan).not.toHaveBeenCalled();
  });

  it.each(["{", JSON.stringify(body).replace("1800000000.25", "1e400")])(
    "JSON 損壞或時間非有限數值回傳 400",
    async (payload) => {
      const response = await POST(
        new Request("http://localhost/api/market/scans", {
          method: "POST",
          headers: { Authorization: "Bearer test-token" },
          body: payload,
        }),
      );
      expect(response.status).toBe(400);
      expect(scans.ingestScan).not.toHaveBeenCalled();
    },
  );
});
