// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  buildCurationPrompt,
  normalizeCuration,
  curateWithClaude,
  curationToAiLayer,
  resolveAiPlan,
  type CurationClient,
} from "../curate";
import type { AiDigest } from "../types";

const digest: AiDigest = {
  summary: { added: 2, changed: 100, removed: 0 },
  addedTables: [],
  removedTables: [],
  tables: [
    {
      table: "items",
      label: "道具",
      tier: "rich",
      counts: { added: 1, changed: 100, removed: 0 },
      addedSample: [{ name: "端午禮盒", fields: { 說明: "開箱可得晝夢冥鰩" } }],
      systematic: [{ label: "售價", from: "0", to: "1", count: 100 }],
    },
  ],
};

describe("buildCurationPrompt", () => {
  it("system 含 zh-tw / 不得杜撰 指示；user 內嵌 digest 事實", () => {
    const { system, user } = buildCurationPrompt(digest);
    expect(system).toContain("繁體中文");
    expect(system).toMatch(/不得杜撰|不得捏造/);
    expect(user).toContain("端午禮盒"); // digest 事實有進 prompt
    expect(user).toContain("售價");
  });
});

describe("normalizeCuration", () => {
  it("過濾不存在的表、限制 highlights 上限、保留 note", () => {
    const raw = {
      highlights: Array.from({ length: 20 }, (_, i) => `h${i}`),
      tables: [
        { table: "items", mode: "summary", note: "售價批量" },
        { table: "ghost", mode: "detail" }, // 不在 knownTables
      ],
    };
    const c = normalizeCuration(raw, ["items"]);
    expect(c.highlights.length).toBeLessThanOrEqual(12);
    expect(c.tables).toEqual([{ table: "items", mode: "summary", note: "售價批量" }]);
  });

  it("形狀壞掉丟錯（讓 CLI 降級）", () => {
    expect(() => normalizeCuration({ nope: true }, ["items"])).toThrow();
    expect(() => normalizeCuration(null, ["items"])).toThrow();
  });
});

describe("curateWithClaude", () => {
  it("用注入的假 client；回傳 normalize 後結果（不打真 API）", async () => {
    let seen: { model: string; system: string; user: string; schema: object } | undefined;
    const fake: CurationClient = {
      async curate(req) {
        seen = req;
        return {
          highlights: ["端午活動上線"],
          tables: [
            { table: "items", mode: "summary", note: "售價批量調整" },
            { table: "ghost", mode: "detail" },
          ],
        };
      },
    };
    const c = await curateWithClaude(digest, { client: fake, model: "claude-opus-4-8" });
    expect(seen!.model).toBe("claude-opus-4-8");
    expect(seen!.user).toContain("端午禮盒");
    expect(c.highlights).toEqual(["端午活動上線"]);
    expect(c.tables).toEqual([{ table: "items", mode: "summary", note: "售價批量調整" }]); // ghost 濾掉
  });

  it("model 預設 claude-opus-4-8", async () => {
    let model = "";
    const fake: CurationClient = {
      async curate(req) {
        model = req.model;
        return { highlights: [], tables: [] };
      },
    };
    await curateWithClaude(digest, { client: fake });
    expect(model).toBe("claude-opus-4-8");
  });
});

describe("curationToAiLayer", () => {
  it("tables 陣列 → 以 table 名為鍵的 Record；edited 預設 false", () => {
    const layer = curationToAiLayer(
      { highlights: ["a"], tables: [{ table: "items", mode: "summary", note: "n" }, { table: "npc", mode: "detail" }] },
      { model: "claude-opus-4-8" },
    );
    expect(layer).toEqual({
      model: "claude-opus-4-8",
      edited: false,
      highlights: ["a"],
      tables: { items: { mode: "summary", note: "n" }, npc: { mode: "detail" } },
    });
  });
});

describe("resolveAiPlan", () => {
  it("--no-ai → 不跑", () => {
    expect(resolveAiPlan({ noAi: true, apiKey: "sk-x" }).runAi).toBe(false);
  });
  it("無金鑰 → 不跑", () => {
    expect(resolveAiPlan({ noAi: false, apiKey: undefined }).runAi).toBe(false);
  });
  it("有金鑰且未停用 → 跑", () => {
    expect(resolveAiPlan({ noAi: false, apiKey: "sk-x" }).runAi).toBe(true);
  });
});
