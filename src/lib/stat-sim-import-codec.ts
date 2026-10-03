import {
  IMPORT_PREFIX,
  IMPORT_STAT_KEYS,
  ImportError,
  type ImportEquipEntry,
  type ImportPanel,
  type ImportPayloadV1,
  type ImportStats,
} from "./types/stat-sim-import";
import {
  ATTRIBUTE_KEYS,
  EQUIP_SLOTS,
  type Attributes,
  type PanelStatKey,
} from "./types/stat-sim";

const MAX_INPUT_BYTES = 64 * 1024;
const MAX_OUTPUT_BYTES = 256 * 1024;
const PANEL_STAT_KEYS = [
  ...IMPORT_STAT_KEYS.filter((key) => !ATTRIBUTE_KEYS.some((attribute) => attribute === key)),
  "weight_cap",
] as PanelStatKey[];

function badFormat(): ImportError {
  return new ImportError("bad-format", "字串不完整，請重新複製");
}

function tooLarge(): ImportError {
  return new ImportError("too-large", "匯入字串過大，請重新複製");
}

function unsupportedVersion(version: unknown): never {
  throw new ImportError("unsupported-version", `這個字串的格式版本是 v${String(version)}，請更新網站`);
}

function invalidField(field: string, rule: string): never {
  throw new ImportError("bad-format", `欄位 ${field} ${rule}`);
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    invalidField(field, "必須是物件");
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, field: string): string {
  if (typeof value !== "string") invalidField(field, "必須是字串");
  return value;
}

function integer(value: unknown, field: string, min = -Infinity, max = Infinity): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    const rule = Number.isFinite(max)
      ? `必須是 ${min}～${max} 範圍內的整數`
      : Number.isFinite(min) ? `必須是 ≥ ${min} 的整數` : "必須是整數";
    invalidField(field, rule);
  }
  return value;
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) invalidField(field, "必須是有限數值");
  return value;
}

function validatePayload(value: unknown): ImportPayloadV1 {
  const raw = object(value, "JSON");
  if (raw.v !== 1) unsupportedVersion(raw.v);
  const bare = object(raw.bare, "bare");
  const attributes = {} as Attributes;
  for (const key of ATTRIBUTE_KEYS) attributes[key] = integer(bare[key], `bare.${key}`, 1);

  const rawEquipment = object(raw.equipment, "equipment");
  const equipment = {} as ImportPayloadV1["equipment"];
  for (const slot of EQUIP_SLOTS) {
    const field = `equipment.${slot}`;
    if (!Object.hasOwn(rawEquipment, slot)) invalidField(field, "為必填欄位");
    if (rawEquipment[slot] === null) {
      equipment[slot] = null;
      continue;
    }
    const entry = object(rawEquipment[slot], field);
    if (!Array.isArray(entry.inlays) || entry.inlays.length !== 4) {
      invalidField(`${field}.inlays`, "必須是長度 4 的陣列");
    }
    const inlays = entry.inlays.map((id, index) => integer(id, `${field}.inlays[${index}]`, 0)) as ImportEquipEntry["inlays"];
    const rawStats = object(entry.stats, `${field}.stats`);
    const stats: ImportStats = {};
    for (const [key, amount] of Object.entries(rawStats)) {
      if (!IMPORT_STAT_KEYS.some((stat) => stat === key)) {
        invalidField(`${field}.stats.${key}`, "是未知的數值 key，請使用 genbu 數值 key");
      }
      stats[key as keyof ImportStats] = finiteNumber(amount, `${field}.stats.${key}`);
    }
    equipment[slot] = {
      id: integer(entry.id, `${field}.id`, 1),
      plus: integer(entry.plus, `${field}.plus`, 0, 20),
      inlays,
      stats,
    };
  }

  const rawSkills = object(raw.skills, "skills");
  const skills: Record<number, number> = {};
  for (const [key, level] of Object.entries(rawSkills)) {
    if (!/^\d+$/.test(key) || !Number.isSafeInteger(Number(key))) {
      invalidField(`skills.${key}`, "的 key 必須是十進位整數字串");
    }
    skills[Number(key)] = integer(level, `skills.${key}`, 0);
  }

  const result: ImportPayloadV1 = {
    v: 1,
    app: string(raw.app, "app"),
    at: string(raw.at, "at"),
    name: string(raw.name, "name"),
    sect: integer(raw.sect, "sect"),
    level: integer(raw.level, "level", 1, 300),
    bare: attributes,
    remainingPoints: integer(raw.remainingPoints, "remainingPoints", 0),
    equipment,
    skills,
  };
  if (Object.hasOwn(raw, "panel")) {
    const rawPanel = object(raw.panel, "panel");
    const panel: ImportPanel = {};
    if (Object.hasOwn(rawPanel, "attributes")) {
      const rawAttributes = object(rawPanel.attributes, "panel.attributes");
      panel.attributes = {};
      for (const key of ATTRIBUTE_KEYS) {
        if (Object.hasOwn(rawAttributes, key)) {
          panel.attributes[key] = integer(rawAttributes[key], `panel.attributes.${key}`, 1);
        }
      }
    }
    for (const key of PANEL_STAT_KEYS) {
      if (Object.hasOwn(rawPanel, key)) {
        panel.stats ??= {};
        panel.stats[key] = finiteNumber(rawPanel[key], `panel.${key}`);
      }
    }
    result.panel = panel;
  }
  return result;
}

/** 接受純匯入字串或含有 #import= 的連結；不發出網路請求。 */
export function extractImportCode(text: string): string {
  const trimmed = text.trim();
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) return trimmed;
  try {
    return new URLSearchParams(new URL(trimmed).hash.slice(1)).get("import") ?? "";
  } catch {
    throw badFormat();
  }
}

export async function decodeImport(text: string): Promise<ImportPayloadV1> {
  if (text.length > MAX_INPUT_BYTES || new TextEncoder().encode(text).byteLength > MAX_INPUT_BYTES) {
    throw tooLarge();
  }
  const code = extractImportCode(text);
  const version = /^TTHOL(\d+)\./.exec(code)?.[1];
  if (version !== undefined && version !== "1") unsupportedVersion(version);
  if (!code.startsWith(`${IMPORT_PREFIX}.`)) throw badFormat();
  const encoded = code.slice(IMPORT_PREFIX.length + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length % 4 === 1) throw badFormat();

  try {
    const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    if (btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") !== encoded) {
      throw badFormat();
    }
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (typeof DecompressionStream === "undefined") {
      throw new ImportError("no-decompression", "瀏覽器不支援解壓縮，請更新瀏覽器");
    }
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_OUTPUT_BYTES) {
          await reader.cancel().catch(() => {});
          throw tooLarge();
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const output = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return validatePayload(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(output)));
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw badFormat();
  }
}

/** 將原始（panel 尚未正規化）JSON 壓縮成 TTHOL1 字串，供 roundtrip 測試使用。 */
export async function encodeImport(payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const compressed = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const output = new Uint8Array(await new Response(compressed).arrayBuffer());
  const binary = Array.from(output, (byte) => String.fromCharCode(byte)).join("");
  return `${IMPORT_PREFIX}.${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}
