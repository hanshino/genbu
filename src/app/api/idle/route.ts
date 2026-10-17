import { getSession } from "@/lib/auth/session";
import { idleJson, loadAndSettle, viewOf } from "@/lib/idle-saves";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return idleJson({ error: "請先登入。" }, 401);
    const loaded = loadAndSettle(session.sub, Date.now());
    if (loaded.state === null) return idleJson({ state: null });
    return idleJson({ ...viewOf(loaded.state, loaded.data), offlineSummary: loaded.summary });
  } catch {
    return idleJson({ error: "無法載入存檔，請稍後再試。" }, 500);
  }
}
