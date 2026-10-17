import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { IDLE_STAGE_ID } from "@/configs/idle";
import { authedBody, idleJson, startSave, viewOf } from "@/lib/idle-saves";
import { presetProblem } from "@/lib/idle/character";
import { loadIdleData } from "@/lib/queries/idle";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await authedBody(request);
    if (auth instanceof NextResponse) return auth;
    const presetId = auth.body.presetId;
    if (typeof presetId !== "number" || !Number.isSafeInteger(presetId)) {
      return idleJson({ error: "請選擇角色。" }, 400);
    }
    const data = loadIdleData(IDLE_STAGE_ID, presetId);
    if (!data) return idleJson({ error: "找不到這個角色。" }, 400);
    const problem = presetProblem(data);
    if (problem) return idleJson({ error: problem }, 400);
    const result = startSave(auth.sub, data, randomBytes(4).readUInt32BE(0), Date.now());
    if (!result.ok) return idleJson({ error: result.error }, result.status);
    return idleJson(viewOf(result.state, result.data));
  } catch {
    return idleJson({ error: "無法建立存檔，請稍後再試。" }, 500);
  }
}
