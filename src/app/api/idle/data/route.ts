import { IDLE_STAGE_ID } from "@/configs/idle";
import { idleJson } from "@/lib/idle-saves";
import { presetProblem } from "@/lib/idle/character";
import { isStyleWeapon } from "@/lib/idle/job";
import { loadIdleData, loadIdleSceneAssets } from "@/lib/queries/idle";

export const runtime = "nodejs";

/** 引擎與場景需要的靜態資料（隨資料庫版本更新，不含個人資料，可以快取）。 */
export async function GET(request: Request) {
  const presetId = Number(new URL(request.url).searchParams.get("preset"));
  if (!Number.isSafeInteger(presetId)) return idleJson({ error: "請選擇角色。" }, 400);
  // weapon 是可選的：空手外觀的預設角色沒有武器，由存檔指定；只接受該門派的武器流派用的組合。
  const weaponParam = new URL(request.url).searchParams.get("weapon");
  const weaponItemId = weaponParam == null ? null : Number(weaponParam);
  if (weaponItemId != null && !Number.isSafeInteger(weaponItemId)) return idleJson({ error: "請選擇武器。" }, 400);
  try {
    const data = loadIdleData(IDLE_STAGE_ID, presetId, weaponItemId);
    if (!data || presetProblem(data)) return idleJson({ error: "找不到這個角色。" }, 404);
    if (weaponItemId != null && !isStyleWeapon(data.sectId, data.presetId, weaponItemId)) {
      return idleJson({ error: "找不到這個角色。" }, 404);
    }
    return Response.json(
      { data, scene: loadIdleSceneAssets(data) },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
    );
  } catch {
    return idleJson({ error: "無法載入遊戲資料，請稍後再試。" }, 500);
  }
}
