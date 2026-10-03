import { SECTS } from "@/configs/stat-sim";
import { encodePlan } from "./meridian-sim";
import { createDefaultCharacter, parseCharacter } from "./stat-character";
import { computePanel, inferRebirthPoints } from "./stat-sim";
import { decomposeEquipment } from "./stat-sim-import-equipment";
import {
  ATTRIBUTE_KEYS, EQUIP_SLOTS, SUB_SECT_CLANS,
  type CharacterV1, type GameData, type PanelStatKey, type SectId, type StatValue, type SubSectClan,
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
    // 入門弟子技能轉職後不計入面板，不帶進角色。
    if (level === undefined || passive.clan === "CLASS_CHILD") continue;
    character.passiveLevels[passive.id] = Math.min(level, passive.maxLevel);
    if (level > passive.maxLevel) diagnostics.push({
      code: "passive-clamped", severity: "info",
      message: `被動 ${passive.name} Lv${level} 超過上限，已改為 Lv${passive.maxLevel}`,
    });
  }
  // 天師的陣法研究、靈甲等不影響面板，不在 passives 裡，所以優先看全部技能的 clan。
  const learnedClans: SubSectClan[] = data.subSectSkills
    ? Object.entries(payload.skills).flatMap(([id, level]) => {
      const clan = data.subSectSkills![Number(id)];
      return clan && level > 0 ? [clan] : [];
    })
    : data.passives.flatMap((passive) => passive.group === "sub" && SUB_SECT_CLANS.some((clan) => clan === passive.clan) &&
      (character.passiveLevels[passive.id] ?? 0) > 0 ? [passive.clan as SubSectClan] : []);
  const clans = SUB_SECT_CLANS.map((clan) => ({
    clan, count: learnedClans.filter((learned) => learned === clan).length,
  })).filter(({ count }) => count > 0).sort((a, b) => b.count - a.count);
  character.subSects = clans.slice(0, 2).map(({ clan }) => clan);
  if (clans.length > 2) diagnostics.push({
    code: "too-many-sub-sects", severity: "warning",
    message: "副門派技能超過兩個門派，已依學會技能數保留前兩個；同數依門派順序選擇",
  });

  const meridians = Object.fromEntries(data.meridianIds.flatMap((id) =>
    payload.skills[id] === undefined ? [] : [[id, payload.skills[id]]]));
  character.meridianPlan = encodePlan(meridians) || null;
  const passiveIds = new Set(data.passives.map((passive) => passive.id));
  const meridianIds = new Set(data.meridianIds);
  const learned = Object.entries(payload.skills).filter(([id, level]) =>
    level > 0 && !passiveIds.has(Number(id)) && !meridianIds.has(Number(id)));
  if (learned.length > 0) character.learnedSkills = Object.fromEntries(learned);
  for (const slot of EQUIP_SLOTS) {
    const entry = payload.equipment[slot];
    if (!entry) continue;
    const decomposed = decomposeEquipment(entry, slot, data);
    character.equipment[slot] = decomposed.equipment;
    diagnostics.push(...decomposed.diagnostics);
  }
  const parsed = parseCharacter(character);
  if (!parsed.ok) throw new ImportError("bad-format", "匯入角色資料不合法，請檢查配點、裝備與技能欄位");
  const hpGap = unexplainedHp(payload, parsed.character, data);
  if (hpGap > 0) {
    parsed.character.manual.other = { hp: hpGap };
    diagnostics.push({
      code: "other-hp-filled", severity: "info", stat: "hp",
      message: `體力比模擬多 ${hpGap}，其他數值都對得上，已填入「其他」手動加值（多半是伺服器端給角色的加成）`,
    });
  }
  return { character: parsed.character, renamed, diagnostics };
}

/**
 * 遊戲面板只有體力比模擬高、其他確定值全部吻合時，回傳差值；否則 0。
 * 估計值或無法計算的欄位（武器攻速、穿裝負重、遠程物攻）不當作反證，但至少要有一項其他欄位吻合。
 */
function unexplainedHp(payload: ImportPayloadV1, character: CharacterV1, data: GameData): number {
  const game = payload.panel;
  const gameHp = game?.stats?.hp;
  if (!game || gameHp === undefined) return 0;
  // 沒有經脈資料時經脈會把所有欄位標成估計值，比對時先拿掉；其他資料缺漏的估計原因照樣擋下。
  const result = computePanel(data.meridians ? character : { ...character, meridianPlan: null }, data);
  const hp = result.stats.hp;
  if (hp.value === null || hp.estimated || gameHp <= hp.value) return 0;
  let matched = 0;
  const checks: Array<[number | undefined, StatValue]> = [
    ...ATTRIBUTE_KEYS.map((key) => [game.attributes?.[key], result.attributes[key]] as [number | undefined, StatValue]),
    ...Object.entries(game.stats ?? {}).flatMap(([key, value]) => key === "hp" ? [] :
      [[value, result.stats[key as PanelStatKey]] as [number | undefined, StatValue]]),
  ];
  for (const [value, sim] of checks) {
    if (value === undefined || !sim || sim.value === null || sim.estimated) continue;
    if (value !== sim.value) return 0;
    matched++;
  }
  return matched > 0 ? gameHp - hp.value : 0;
}
