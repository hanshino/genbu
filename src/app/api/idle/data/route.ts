import { IDLE_STAGE_ID } from "@/configs/idle";
import { idleJson } from "@/lib/idle-saves";
import { presetProblem } from "@/lib/idle/character";
import { loadIdleData, loadIdleSceneAssets } from "@/lib/queries/idle";

export const runtime = "nodejs";

/** 引擎與場景需要的靜態資料（隨資料庫版本更新，不含個人資料，可以快取）。 */
export async function GET(request: Request) {
  const presetId = Number(new URL(request.url).searchParams.get("preset"));
  if (!Number.isSafeInteger(presetId)) return idleJson({ error: "請選擇角色。" }, 400);
  try {
    const data = loadIdleData(IDLE_STAGE_ID, presetId);
    if (!data || presetProblem(data)) return idleJson({ error: "找不到這個角色。" }, 404);
    return Response.json(
      { data, scene: loadIdleSceneAssets(data) },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
    );
  } catch {
    return idleJson({ error: "無法載入遊戲資料，請稍後再試。" }, 500);
  }
}
