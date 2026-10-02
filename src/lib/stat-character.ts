import {
  ATTRIBUTE_KEYS,
  EQUIP_SLOTS,
  STAT_KEYS,
  SUB_SECT_CLANS,
  type CharacterStore,
  type CharacterV1,
  type SectId,
} from "@/lib/types/stat-sim";

const SECT_IDS: readonly SectId[] = [2, 4, 8, 512, 2048, 4096, 8192];
type Invalid = { ok: false; reason: "corrupt" | "unknown-version" };

function characterId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
  );
}

export function createDefaultCharacter(name = "新角色", sectId: SectId = 2): CharacterV1 {
  return {
    version: 1,
    id: characterId(),
    name,
    sectId,
    subSects: [],
    level: 1,
    rebirthPoints: 0,
    attributes: { str: 1, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 },
    equipment: Object.fromEntries(
      EQUIP_SLOTS.map((slot) => [slot, null]),
    ) as CharacterV1["equipment"],
    passiveLevels: {},
    meridianPlan: null,
    manual: { hero: {}, formation: {} },
  };
}

export function duplicateCharacter(character: CharacterV1): CharacterV1 {
  return {
    ...JSON.parse(JSON.stringify(character)),
    id: characterId(),
    name: `${character.name}（副本）`,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}

function integer(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

function bonus(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([key, amount]) =>
        STAT_KEYS.some((stat) => stat === key) &&
        typeof amount === "number" &&
        Number.isFinite(amount),
    )
  );
}

function versionError(value: Record<string, unknown>): Invalid | null {
  if (value.version === 1) return null;
  return { ok: false, reason: integer(value.version, 2) ? "unknown-version" : "corrupt" };
}

export function parseCharacter(raw: unknown): { ok: true; character: CharacterV1 } | Invalid {
  if (!isRecord(raw)) return { ok: false, reason: "corrupt" };
  const invalidVersion = versionError(raw);
  if (invalidVersion) return invalidVersion;
  if (
    typeof raw.id !== "string" ||
    raw.id.length === 0 ||
    typeof raw.name !== "string" ||
    !SECT_IDS.some((id) => id === raw.sectId) ||
    !integer(raw.level, 1) ||
    !integer(raw.rebirthPoints, 0, 140) ||
    !Array.isArray(raw.subSects) ||
    raw.subSects.length > 2 ||
    new Set(raw.subSects).size !== raw.subSects.length ||
    !Array.from(raw.subSects).every((clan) => SUB_SECT_CLANS.some((allowed) => allowed === clan)) ||
    (raw.rebirthLevels !== undefined &&
      (!Array.isArray(raw.rebirthLevels) ||
        raw.rebirthLevels.length > 4 ||
        !Array.from(raw.rebirthLevels).every((level) => integer(level, 100, 140)))) ||
    !isRecord(raw.attributes) ||
    Object.keys(raw.attributes).length !== ATTRIBUTE_KEYS.length ||
    !ATTRIBUTE_KEYS.every((key) => isRecord(raw.attributes) && integer(raw.attributes[key], 1)) ||
    !isRecord(raw.equipment) ||
    Object.keys(raw.equipment).length !== EQUIP_SLOTS.length ||
    !EQUIP_SLOTS.every((slot) => {
      if (!isRecord(raw.equipment)) return false;
      const item = raw.equipment[slot];
      return (
        item === null ||
        (isRecord(item) &&
          integer(item.itemId, 1) &&
          integer(item.enhancementLevel, 0, 30) &&
          bonus(item.manualBonuses))
      );
    }) ||
    !isRecord(raw.passiveLevels) ||
    !Object.entries(raw.passiveLevels).every(
      ([id, level]) => integer(Number(id), 1) && String(Number(id)) === id && integer(level, 0),
    ) ||
    (raw.meridianPlan !== null && typeof raw.meridianPlan !== "string") ||
    !isRecord(raw.manual) ||
    !bonus(raw.manual.hero) ||
    !bonus(raw.manual.formation)
  )
    return { ok: false, reason: "corrupt" };
  return { ok: true, character: raw as unknown as CharacterV1 };
}

export function parseCharacterStore(raw: unknown): { ok: true; store: CharacterStore } | Invalid {
  if (!isRecord(raw)) return { ok: false, reason: "corrupt" };
  const invalidVersion = versionError(raw);
  if (invalidVersion) return invalidVersion;
  if (!Array.isArray(raw.characters)) return { ok: false, reason: "corrupt" };
  const ids = new Set<string>();
  for (const character of raw.characters) {
    const parsed = parseCharacter(character);
    if (!parsed.ok) return parsed;
    if (ids.has(parsed.character.id)) return { ok: false, reason: "corrupt" };
    ids.add(parsed.character.id);
  }
  if (
    ids.size === 0
      ? raw.activeCharacterId !== null
      : typeof raw.activeCharacterId !== "string" || !ids.has(raw.activeCharacterId)
  ) {
    return { ok: false, reason: "corrupt" };
  }
  return { ok: true, store: raw as unknown as CharacterStore };
}
