import { idleJson } from "@/lib/idle-saves";
import { loadCreateAssets } from "@/lib/queries/idle";

export const runtime = "nodejs";

/** 建立角色畫面需要的靜態資料（遊戲視窗版面、按鈕圖、紙娃娃動作圖）；不含個人資料，可以快取。 */
export async function GET() {
  try {
    return Response.json(loadCreateAssets(), {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  } catch {
    return idleJson({ error: "無法載入建立角色畫面，請稍後再試。" }, 500);
  }
}
