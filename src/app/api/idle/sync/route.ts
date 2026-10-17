import { NextResponse } from "next/server";
import { authedBody, idleJson, syncSave, writeResponse } from "@/lib/idle-saves";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await authedBody(request);
    if (auth instanceof NextResponse) return auth;
    const { saveCounter, clientTicks } = auth.body;
    if (typeof saveCounter !== "number" || !Number.isSafeInteger(saveCounter)) {
      return idleJson({ error: "缺少存檔計數。" }, 400);
    }
    if (typeof clientTicks !== "number" || !Number.isSafeInteger(clientTicks) || clientTicks < 0) {
      return idleJson({ error: "經過的時間必須是大於等於 0 的整數。" }, 400);
    }
    return writeResponse(syncSave(auth.sub, saveCounter, clientTicks, Date.now()));
  } catch {
    return idleJson({ error: "無法同步存檔，請稍後再試。" }, 500);
  }
}
