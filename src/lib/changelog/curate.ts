// AI 策展層：把 digest 變成 highlights + 逐表 mode/note。
// 刻意不 import @anthropic-ai/sdk：真 client 由 CLI 注入（見 scripts/db-changelog.ts）。
// 測試注入假 client，不打真 API、不需金鑰。
import type { AiCuration, AiDigest, ChangelogEntry } from "./types";

const DEFAULT_MODEL = "claude-opus-4-8";
const MAX_HIGHLIGHTS = 12;

// SDK 抽象：CLI 用真 Anthropic 實作，測試用假物件。
export interface CurationClient {
  curate(req: { model: string; system: string; user: string; schema: object }): Promise<unknown>;
}

// Claude structured output schema（json_schema；動態鍵不友善，故 tables 用陣列）。
export const CURATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["highlights", "tables"],
  properties: {
    highlights: { type: "array", items: { type: "string" }, maxItems: MAX_HIGHLIGHTS },
    tables: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["table", "mode"],
        properties: {
          table: { type: "string" },
          mode: { type: "string", enum: ["detail", "summary"] },
          note: { type: "string" },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = [
  "你在為武林同萌傳（TTHOL）玩家寫「更新日誌」，用繁體中文（zh-tw）、遊戲圈口語。",
  "只根據提供的 diff 摘要（digest）下判斷；不得杜撰 digest 沒有的道具、數值或名稱。",
  "逐表判定 detail（有玩法新聞、值得攤開逐列）或 summary（批量／建置噪音，一句帶過）。",
  "把「保留N」「敬請期待」之類佔位符被填入，理解為『新內容上線』而非單純修改。",
  "禮盒／道具說明點名的內容物，照說明轉述（如「開箱可得…」），不得斷言那些內容物本身是新道具。",
  "系統性摺疊、售價批量、上千筆計數變更 → 收成一句，點出是建置調整而非玩法變更。",
  "highlights 3–12 條，聚焦本版真正重點；tables 只列你想標成 summary 或特別要 detail 的表。",
  "每個 tables 項目的 table 欄，務必填 digest 中該表的機器鍵（例如 items、npc），不可填中文標籤（例如 道具）。",
].join("\n");

export function buildCurationPrompt(digest: AiDigest): { system: string; user: string } {
  const user =
    "以下是本次改版的確定性 diff 摘要（JSON）。請據此產出更新日誌策展結果：\n\n" +
    "```json\n" +
    JSON.stringify(digest, null, 2) +
    "\n```";
  return { system: SYSTEM_PROMPT, user };
}

export function normalizeCuration(raw: unknown, knownTables: string[]): AiCuration {
  if (!raw || typeof raw !== "object") throw new Error("AI 回傳非物件");
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.highlights)) throw new Error("AI 回傳缺 highlights 陣列");
  const known = new Set(knownTables);
  const highlights = r.highlights
    .filter((h): h is string => typeof h === "string" && h.trim() !== "")
    .slice(0, MAX_HIGHLIGHTS);
  const tablesRaw = Array.isArray(r.tables) ? r.tables : [];
  const tables: AiCuration["tables"] = [];
  for (const t of tablesRaw) {
    if (!t || typeof t !== "object") continue;
    const o = t as Record<string, unknown>;
    if (typeof o.table !== "string" || !known.has(o.table)) continue;
    if (o.mode !== "detail" && o.mode !== "summary") continue;
    const entry: AiCuration["tables"][number] = { table: o.table, mode: o.mode };
    if (typeof o.note === "string" && o.note.trim() !== "") entry.note = o.note;
    tables.push(entry);
  }
  return { highlights, tables };
}

export async function curateWithClaude(
  digest: AiDigest,
  opts: { client: CurationClient; model?: string },
): Promise<AiCuration> {
  const model = opts.model ?? DEFAULT_MODEL;
  const { system, user } = buildCurationPrompt(digest);
  const raw = await opts.client.curate({ model, system, user, schema: CURATION_SCHEMA });
  return normalizeCuration(raw, digest.tables.map((t) => t.table));
}

export function curationToAiLayer(
  curation: AiCuration,
  meta: { model: string; edited?: boolean },
): NonNullable<ChangelogEntry["ai"]> {
  const tables: Record<string, { mode: "detail" | "summary"; note?: string }> = {};
  for (const t of curation.tables) tables[t.table] = t.note ? { mode: t.mode, note: t.note } : { mode: t.mode };
  return { model: meta.model, edited: meta.edited ?? false, highlights: curation.highlights, tables };
}

export function resolveAiPlan(env: {
  noAi: boolean;
  apiKey: string | undefined;
}): { runAi: boolean; reason: string } {
  if (env.noAi) return { runAi: false, reason: "--no-ai" };
  if (!env.apiKey) return { runAi: false, reason: "未設定 ANTHROPIC_API_KEY" };
  return { runAi: true, reason: "" };
}
