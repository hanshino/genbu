// @vitest-environment node
import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeImport, encodeImport, extractImportCode } from "../stat-sim-import-codec";
import { ImportError } from "../types/stat-sim-import";
import { ATTRIBUTE_KEYS, EQUIP_SLOTS } from "../types/stat-sim";

function payload() {
  return {
    v: 1,
    app: "proto",
    at: "2026-10-03T00:00:00Z",
    name: "測試角色",
    sect: 8,
    level: 190,
    bare: Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, 1])),
    remainingPoints: 0,
    equipment: Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, null as null | {
      id: number; plus: number; inlays: number[]; stats: Record<string, unknown>;
    }])),
    skills: {} as Record<string, number>,
    panel: undefined as Record<string, unknown> | undefined,
  };
}

function rawCode(json: string | Uint8Array): string {
  return `TTHOL1.${deflateRawSync(json).toString("base64url")}`;
}

async function expectError(code: string, errorCode: string, message?: string) {
  await expect(decodeImport(code)).rejects.toBeInstanceOf(ImportError);
  await expect(decodeImport(code)).rejects.toMatchObject({
    code: errorCode,
    ...(message ? { message: expect.stringContaining(message) } : {}),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("TTHOL1 匯入 codec", () => {
  it.each(["止戰詩園-Lv190", "晨曦破空-Lv192"])("解碼實機樣本 %s 並正規化 panel", async (name) => {
    const base = `docs/plans/stat-sim-import-samples/${name}`;
    const code = readFileSync(`${base}.txt`, "utf8");
    const raw = JSON.parse(readFileSync(`${base}.json`, "utf8"));
    const { attributes, ...stats } = raw.panel;
    const expected = { ...raw, panel: { attributes, stats } };
    expect(await decodeImport(code)).toEqual(expected);
    const encoded = await encodeImport(raw);
    expect(encoded).toMatch(/^TTHOL1\.[A-Za-z0-9_-]+$/);
    expect(await decodeImport(encoded)).toEqual(expected);
  });

  it("接受含前後空白的完整 URL 與 URL-encoded fragment", async () => {
    const raw = payload();
    const code = await encodeImport(raw);
    const url = `  https://genbu.hanshino.dev/tools/stat-sim#import=${encodeURIComponent(code)}&other=1\n`;
    expect(extractImportCode(url)).toBe(code);
    expect(extractImportCode(` \n${code} `)).toBe(code);
    expect(await decodeImport(url)).toEqual({ ...raw, panel: undefined });
    expect(extractImportCode(`https://genbu.hanshino.dev/tools/stat-sim?import=${code}`)).toBe("");
  });

  it("拒絕未知前綴版號與 JSON 版號", async () => {
    await expectError("TTHOL2.AAAA", "unsupported-version", "這個字串的格式版本是 v2，請更新網站");
    await expectError(await encodeImport({ ...payload(), v: 3 }), "unsupported-version", "v3");
  });

  it.each(["garbage", "TTHOL1.", "TTHOL1.!!!!", "TTHOL1.A", "TTHOL1.AAAA", "TTHOL1.AAAA="])(
    "拒絕損壞字串 %s", async (code) => {
      await expectError(code, "bad-format", "字串不完整，請重新複製");
    },
  );

  it("拒絕無效 JSON 與非嚴格 UTF-8", async () => {
    await expectError(rawCode("{invalid json"), "bad-format");
    await expectError(rawCode(new Uint8Array([0xff])), "bad-format");
  });

  it("缺少 DecompressionStream 時提示更新瀏覽器", async () => {
    const code = await encodeImport(payload());
    vi.stubGlobal("DecompressionStream", undefined);
    await expectError(code, "no-decompression", "瀏覽器不支援解壓縮，請更新瀏覽器");
  });

  it("十格裝備必填，但可以全為 null", async () => {
    const raw = payload();
    expect((await decodeImport(await encodeImport(raw))).equipment).toEqual(raw.equipment);
    delete raw.equipment.left;
    await expectError(await encodeImport(raw), "bad-format", "equipment.left");
  });

  it.each([
    ["id", 0],
    ["plus", 21],
    ["plus", -1],
    ["inlays", [0, 0, 0]],
    ["inlays", [0, 0, 0, -1]],
    ["stats", { extra_def: 10 }],
    ["stats", { magic_def: 10 }],
    ["stats", { critical_hit: 10 }],
    ["stats", { weight: 10 }],
    ["stats", { hp: "10" }],
  ])("驗證裝備 %s = %j 並標示欄位", async (key, value) => {
    const raw = payload();
    raw.equipment.cap = { id: 1, plus: 0, inlays: [0, 0, 0, 0], stats: {}, [key]: value };
    await expectError(await encodeImport(raw), "bad-format", `equipment.cap.${key}`);
  });

  it.each([
    ["app", 1], ["at", null], ["name", []], ["sect", 1.5],
    ["level", 0], ["level", 301], ["remainingPoints", -1],
    ["bare", { str: 1 }], ["bare", { str: 0, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 }],
    ["equipment", []], ["skills", { "1.5": 1 }], ["skills", { abc: 1 }],
    ["skills", { "1": -1 }], ["skills", { "1": 0.5 }],
    ["panel", { hp: "10" }], ["panel", { attributes: { str: 0 } }],
  ])("驗證結構欄位 %s = %j", async (field, value) => {
    await expectError(await encodeImport({ ...payload(), [field]: value }), "bad-format", field);
  });

  it("僅檢查 sect 是整數，不檢查門派合法值", async () => {
    const raw = { ...payload(), sect: 256 };
    expect((await decodeImport(await encodeImport(raw))).sect).toBe(256);
  });

  it("技能 key 正規化成數字且接受零級", async () => {
    const raw = payload();
    raw.skills = { "0021": 10, "1151": 0 };
    expect((await decodeImport(await encodeImport(raw))).skills).toEqual({ 21: 10, 1151: 0 });
  });

  it("接受部分 panel，忽略未知 key，保留已知數值", async () => {
    const raw = payload();
    raw.panel = { attributes: { str: 10, unknown: "ignored" }, hp: 123, run_speed: 2, weight_cap: 300, unknown: {} };
    expect((await decodeImport(await encodeImport(raw))).panel).toEqual({
      attributes: { str: 10 }, stats: { hp: 123, run_speed: 2, weight_cap: 300 },
    });
    raw.panel = { hp: 123 };
    expect((await decodeImport(await encodeImport(raw))).panel).toEqual({ stats: { hp: 123 } });
    raw.panel = { attributes: { dex: 10 } };
    expect((await decodeImport(await encodeImport(raw))).panel).toEqual({ attributes: { dex: 10 } });
    raw.panel = {};
    expect((await decodeImport(await encodeImport(raw))).panel).toEqual({});
  });

  it("拒絕超過 64 KiB 的輸入與超過 256 KiB 的解壓輸出", async () => {
    await expectError(`TTHOL1.${"A".repeat(64 * 1024)}`, "too-large");
    await expectError("漢".repeat(22 * 1024), "too-large");
    const code = await encodeImport({ ...payload(), name: "A".repeat(256 * 1024) });
    expect(code.length).toBeLessThan(64 * 1024);
    await expectError(code, "too-large");
  });
});
