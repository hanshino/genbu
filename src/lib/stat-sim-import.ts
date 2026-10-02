import { SECTS } from "@/configs/stat-sim";
import { encodePlan } from "./meridian-sim";
import { createDefaultCharacter, parseCharacter } from "./stat-character";
import { inferRebirthPoints } from "./stat-sim";
import { decomposeEquipment } from "./stat-sim-import-equipment";
import {
  EQUIP_SLOTS, SUB_SECT_CLANS,
  type CharacterV1, type GameData, type SectId,
} from "./types/stat-sim";
import { ImportError, type ImportDiagnostic, type ImportPayloadV1 } from "./types/stat-sim-import";

export function assembleImport(
  payload: ImportPayloadV1,
  data: GameData,
  seed: { id: string },
  existingNames: string[],
): { character: CharacterV1; renamed: boolean; diagnostics: ImportDiagnostic[] } {
  if (!Object.hasOwn(SECTS, payload.sect)) {
    throw new ImportError("unsupported-sect", [1, 256, 1024].includes(payload.sect)
      ? "v1 尚未支援轉職前門派" : `v1 尚未支援此門派：${payload.sect}`);
  }
  const diagnostics: ImportDiagnostic[] = [];
  let name = payload.name;
  const renamed = existingNames.includes(name);
  if (renamed) {
    name = `${payload.name}（匯入）`;
    for (let n = 2; existingNames.includes(name); n++) name = `${payload.name}（匯入 ${n}）`;
  }
  const character = createDefaultCharacter(name, payload.sect as SectId);
  character.id = seed.id;
  character.level = payload.level;
  character.attributes = { ...payload.bare };
  const rebirth = inferRebirthPoints({
    level: payload.level, attributes: payload.bare, remaining: payload.remainingPoints,
  });
  if (rebirth.status === "ok") character.rebirthPoints = rebirth.total!;
  else diagnostics.push({
    code: "rebirth-inference", severity: "warning",
    message: `轉生點數無法推算，已填 0：${rebirth.reasons.join("；")}`,
  });

  for (const passive of data.passives) {
    const level = payload.skills[passive.id];
    if (level === undefined) continue;
    character.passiveLevels[passive.id] = Math.min(level, passive.maxLevel);
    if (level > passive.maxLevel) diagnostics.push({
      code: "passive-clamped", severity: "info",
      message: `被動 ${passive.name} Lv${level} 超過上限，已改為 Lv${passive.maxLevel}`,
    });
  }
  const clans = SUB_SECT_CLANS.map((clan) => ({
    clan,
    count: data.passives.filter((passive) => passive.group === "sub" && passive.clan === clan &&
      (character.passiveLevels[passive.id] ?? 0) > 0).length,
  })).filter(({ count }) => count > 0).sort((a, b) => b.count - a.count);
  character.subSects = clans.slice(0, 2).map(({ clan }) => clan);
  if (clans.length > 2) diagnostics.push({
    code: "too-many-sub-sects", severity: "warning",
    message: "副門派技能超過兩個門派，已依學會技能數保留前兩個；同數依門派順序選擇",
  });

  const meridians = Object.fromEntries(data.meridianIds.flatMap((id) =>
    payload.skills[id] === undefined ? [] : [[id, payload.skills[id]]]));
  character.meridianPlan = encodePlan(meridians) || null;
  for (const slot of EQUIP_SLOTS) {
    const entry = payload.equipment[slot];
    if (!entry) continue;
    const decomposed = decomposeEquipment(entry, slot, data);
    character.equipment[slot] = decomposed.equipment;
    diagnostics.push(...decomposed.diagnostics);
  }
  const parsed = parseCharacter(character);
  if (!parsed.ok) throw new ImportError("bad-format", "匯入角色資料不合法，請檢查配點、裝備與技能欄位");
  return { character: parsed.character, renamed, diagnostics };
}
