import { NextResponse } from "next/server";
import { authedBody, changeSave, idleJson, skillChoiceFor, writeResponse } from "@/lib/idle-saves";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await authedBody(request);
    if (auth instanceof NextResponse) return auth;
    const { saveCounter, skillId } = auth.body;
    if (typeof saveCounter !== "number" || !Number.isSafeInteger(saveCounter)) {
      return idleJson({ error: "缺少存檔計數。" }, 400);
    }
    // skillId 為 null = 改回自動（取期望傷害最高的招）。
    if (skillId !== null && (typeof skillId !== "number" || !Number.isSafeInteger(skillId))) {
      return idleJson({ error: "請選擇技能。" }, 400);
    }
    return writeResponse(
      changeSave(auth.sub, saveCounter, Date.now(), (state, data) => {
        if (skillId !== null && !skillChoiceFor(state, data).options.some((o) => o.skillId === skillId)) {
          return "目前的等級或武器不能使用這個技能。";
        }
        return { skillId };
      }),
    );
  } catch {
    return idleJson({ error: "無法更換技能，請稍後再試。" }, 500);
  }
}
