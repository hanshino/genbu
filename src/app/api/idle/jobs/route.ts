import { IDLE_STAGE_ID, JOB_CHANGE_SECT_IDS, WEAPON_STYLES } from "@/configs/idle";
import { SECTS } from "@/configs/stat-sim";
import { idleJson } from "@/lib/idle-saves";
import { buildCombatant, presetProblem } from "@/lib/idle/character";
import { lockedSkills } from "@/lib/idle/skills";
import { loadIdleData, loadIdleSceneAssets } from "@/lib/queries/idle";
import type { JobChoice } from "@/lib/idle/job";

export const runtime = "nodejs";

/** 每個門派預覽幾招（依可學等級由低到高）。 */
const SKILL_PREVIEW = 3;

/** 轉職視窗要顯示的三個門派（依性別挑外觀）。靜態資料，可以快取。 */
export async function GET(request: Request) {
  const gender = new URL(request.url).searchParams.get("gender");
  if (gender !== "m" && gender !== "f") return idleJson({ error: "請提供性別。" }, 400);
  try {
    const jobs: JobChoice[] = [];
    for (const sectId of JOB_CHANGE_SECT_IDS) {
      const style = WEAPON_STYLES[sectId][0];
      const presetId = style.presetIds[gender];
      const data = loadIdleData(IDLE_STAGE_ID, presetId, style.weaponItemId);
      if (!data || presetProblem(data)) return idleJson({ error: "找不到轉職的門派資料。" }, 404);
      const combatant = buildCombatant(
        { sectId, level: 1, attributes: { str: 1, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 } },
        data,
      );
      const wait = loadIdleSceneAssets(data).casterStrips.wait;
      jobs.push({
        sectId,
        sectName: SECTS[sectId].name,
        presetId,
        presetLabel: loadIdleSceneAssets(data).presetLabel,
        weaponName: data.weapon?.name ?? "空手",
        // 武器不符的招（例如拿劍的移花宮掌法）不列。等級 0：列出所有之後會學到的招。
        styles: WEAPON_STYLES[sectId].map((s) => ({
          key: s.key,
          label: s.label,
          weaponName: s.weaponName,
          weaponShort: s.weaponShort,
          enabled: s.enabled,
        })),
        skills: lockedSkills(data, 0, combatant)
          .slice(0, SKILL_PREVIEW)
          .map((s) => ({ name: s.name, learnLevel: s.learnLevel })),
        sprite: wait
          ? {
              url: wait.url,
              cellW: wait.cellW,
              cellH: wait.cellH,
              frames: wait.frames,
              anchorX: wait.anchorX,
              anchorY: wait.anchorY,
            }
          : null,
      });
    }
    return Response.json({ jobs }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
  } catch {
    return idleJson({ error: "無法載入門派資料，請稍後再試。" }, 500);
  }
}
